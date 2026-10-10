// Worker replacement for server/src/providers/claude.ts. Two transports, same exports:
//  - rest:    the unchanged server implementation (POST api.cloudflare.com/.../ai/v1/messages with CF_API_TOKEN),
//             used whenever CF_ACCOUNT_ID + CF_API_TOKEN are set.
//  - binding: the Worker AI binding (env.AI.run(model, AnthropicMessagesBody, { gateway: { id } })), used when no
//             token is configured. No credential lives in the Worker in this mode.
import { env } from 'cloudflare:workers';
import * as rest from '../../../server/src/providers/claude.ts';
import { ModelRequest, ProviderError, ProviderReply } from '../../../server/src/providers/types.ts';
import { config } from './config';

const AI = (env as any).AI as { run: (model: string, input: unknown, opts?: unknown) => Promise<any> } | undefined;

export const transport = (): 'rest' | 'binding' | 'none' => (rest.claudeConfigured() ? 'rest' : AI ? 'binding' : 'none');
export const claudeConfigured = () => transport() !== 'none';

function replyText(json: any): string {
  if (Array.isArray(json?.content)) {
    return json.content.filter((b: any) => b?.type === 'text' && typeof b.text === 'string').map((b: any) => b.text).join('');
  }
  const msg = json?.choices?.[0]?.message;
  const choice = msg?.content;
  if (typeof choice === 'string' && choice.trim()) return choice;
  if (Array.isArray(choice)) return choice.map((c: any) => (typeof c === 'string' ? c : c?.text ?? '')).join('');
  // Gemma on Workers AI can return the answer in reasoning_content when content is empty; keep the last JSON object in it.
  const rc = msg?.reasoning_content;
  if (typeof rc === 'string' && rc.trim()) {
    const m = rc.match(/\{[\s\S]*\}(?![\s\S]*\{)/);
    if (m) return m[0];
  }
  if (typeof json?.response === 'string') return json.response;
  return '';
}

export async function callClaude(model: string, req: ModelRequest, timeoutMs: number): Promise<ProviderReply> {
  if (transport() === 'rest') return rest.callClaude(model, req, timeoutMs);
  if (!AI) throw new ProviderError('claude', 503, 'no AI binding and no CF_API_TOKEN', model);
  const firstUser = req.messages.findIndex((m) => m.role === 'user');
  const messages = req.messages.map((m, i) => ({
    role: m.role,
    content:
      i === firstUser && req.imageBase64
        ? [
            { type: 'image', source: { type: 'base64', media_type: req.mime || 'image/jpeg', data: req.imageBase64 } },
            { type: 'text', text: m.content },
          ]
        : m.content,
  }));
  // Non-Anthropic models (Gemini) take the OpenAI chat shape through the binding: system as a message, image as image_url.
  const body = model.startsWith('anthropic/')
    ? { max_tokens: req.maxTokens ?? 1200, system: req.system, messages }
    : {
        max_tokens: req.maxTokens ?? 1200,
        ...(model.startsWith('@cf/') ? {} : { reasoning_effort: 'minimal' }), // ~2 s photo reads instead of ~10 s; Workers AI models reject it
        messages: [
          ...(req.system ? [{ role: 'system', content: req.system }] : []),
          ...req.messages.map((m, i) => ({
            role: m.role,
            content:
              i === firstUser && req.imageBase64
                ? [
                    { type: 'image_url', image_url: { url: `data:${req.mime || 'image/jpeg'};base64,${req.imageBase64}` } },
                    { type: 'text', text: m.content },
                  ]
                : m.content,
          })),
        ],
      };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let json: any;
  try {
    json = await Promise.race([
      AI.run(model, body, { gateway: { id: config.gateway.gatewayId } }),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new ProviderError('claude', 504, `timed out after ${timeoutMs / 1000}s`, model)), timeoutMs);
      }),
    ]);
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError('claude', 502, `AI binding: ${e instanceof Error ? e.message : String(e)}`, model);
  } finally {
    if (timer) clearTimeout(timer);
  }
  const text = replyText(json);
  if (!text) throw new ProviderError('claude', 502, `empty reply via AI binding: ${JSON.stringify(json?.choices?.[0] ?? json).slice(0, 400)}`, model);
  return { text, model: typeof json?.model === 'string' && json.model.includes('/') ? json.model : model, finishReason: json?.stop_reason ?? json?.choices?.[0]?.finish_reason, usage: json?.usage };
}
