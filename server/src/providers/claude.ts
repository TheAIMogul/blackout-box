// Claude through Micah's Cloudflare AI Gateway, Anthropic Messages format (Unified Billing, no Anthropic key).
// POST https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/v1/messages
// headers: Authorization: Bearer <CF_API_TOKEN>, cf-aig-gateway-id: <CF_GATEWAY_ID>
// Images go in an `image` content block (source.type base64). The OpenAI-style /ai/v1/chat/completions endpoint drops
// images for Anthropic models (verified Oct 10 morning), so vision must use this endpoint. Verified 12:03 ET: both
// anthropic/claude-fable-5.1 and anthropic/claude-sonnet-5.5 return HTTP 200 here.
import { config } from '../config.js';
import { ModelRequest, ProviderError, ProviderReply, postJson } from './types.js';

export const claudeConfigured = () => Boolean(config.gateway.accountId && config.gateway.token);

export async function callClaude(model: string, req: ModelRequest, timeoutMs: number): Promise<ProviderReply> {
  const { accountId, token, gatewayId } = config.gateway;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/messages`;
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
  const body = { model, max_tokens: req.maxTokens ?? 1200, system: req.system, messages };
  let json: any;
  try {
    json = await postJson(
      'claude',
      url,
      { Authorization: `Bearer ${token}`, 'cf-aig-gateway-id': gatewayId, 'anthropic-version': '2023-06-01' },
      body,
      timeoutMs,
    );
  } catch (e) {
    if (e instanceof ProviderError) e.model = model;
    throw e;
  }
  const text = (json?.content || [])
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('');
  if (!text) throw new ProviderError('claude', 502, `empty reply (stop_reason ${json?.stop_reason ?? 'none'})`, model);
  return { text, model, finishReason: json?.stop_reason, usage: json?.usage };
}
