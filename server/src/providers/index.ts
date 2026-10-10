// One provider: Claude via Cloudflare AI Gateway (CONTRACT.md "Model", decided 12:05 PM).
//  vision -> VISION_MODEL (anthropic/claude-sonnet-5.5), 60 s
//  chat/translate -> CHAT_MODEL (anthropic/claude-fable-5.1), falls back to VISION_MODEL on timeout / 429 / 5xx
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { parseModelJson } from '../json.js';
import { callClaude, claudeConfigured } from './claude.js';
import { ModelRequest, ProviderError, ProviderReply } from './types.js';

export type ModelResult = ProviderReply & { provider: 'claude'; latencyMs: number; fellBack?: boolean };

let lastOk: { at: string; model: string } | null = null;
let lastError: { at: string; message: string } | null = null;
export const providerStatus = () => ({ lastOk, lastError });
export const isConfigured = claudeConfigured;

const CHAT_PRIMARY_TIMEOUT = 35_000;
const FALLBACK_TIMEOUT = 45_000;
const retryable = (e: unknown) => e instanceof ProviderError && (e.status === 504 || e.status === 429 || e.status === 0 || e.status >= 500);

export async function callModel(req: ModelRequest): Promise<ModelResult> {
  if (!claudeConfigured()) throw new HttpError(503, 'NO_PROVIDER', 'Model gateway not configured: set CF_ACCOUNT_ID and CF_API_TOKEN (or run with DEMO_MODE=1)');
  const t0 = Date.now();
  const attempts: { model: string; timeout: number }[] =
    req.task === 'vision'
      ? [{ model: config.visionModel, timeout: req.timeoutMs ?? config.modelTimeoutMs }]
      : [
          { model: config.chatModel, timeout: req.timeoutMs ?? CHAT_PRIMARY_TIMEOUT },
          ...(config.visionModel !== config.chatModel ? [{ model: config.visionModel, timeout: FALLBACK_TIMEOUT }] : []),
        ];
  const errors: string[] = [];
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    try {
      const r = await callClaude(a.model, req, a.timeout);
      lastOk = { at: new Date().toISOString(), model: a.model };
      return { ...r, provider: 'claude', latencyMs: Date.now() - t0, fellBack: i > 0 || undefined };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${a.model}: ${msg}`);
      lastError = { at: new Date().toISOString(), message: `${a.model}: ${msg}` };
      console.warn(`[model] ${a.model} failed: ${msg}`);
      if (!retryable(e)) break;
    }
  }
  throw new HttpError(503, 'MODEL_UNAVAILABLE', `Claude via AI Gateway failed: ${errors.join(' | ')}`);
}

/** Call, strip fences, JSON.parse; on failure retry once with the brief's retry line. */
export async function callModelJson<T = any>(req: ModelRequest, retryText: string): Promise<{ data: T; result: ModelResult; retried: boolean }> {
  const r1 = await callModel(req);
  const d1 = parseModelJson<T>(r1.text);
  if (d1 != null) return { data: d1, result: r1, retried: false };
  const r2 = await callModel({
    ...req,
    messages: [...req.messages, { role: 'assistant', content: r1.text.slice(0, 4000) }, { role: 'user', content: retryText }],
  });
  const d2 = parseModelJson<T>(r2.text);
  if (d2 != null) return { data: d2, result: { ...r2, latencyMs: r1.latencyMs + r2.latencyMs }, retried: true };
  throw new HttpError(502, 'MODEL_BAD_JSON', 'Model reply was not valid JSON after one retry');
}

let probe: { at: number; ok: boolean; p: Promise<boolean> } | null = null;
/** Cheap reachability check (a 16-token Fable call), cached 10 minutes. */
export function probeModel(force = false): Promise<boolean> {
  if (!claudeConfigured()) return Promise.resolve(false);
  if (!force && probe && Date.now() - probe.at < 10 * 60_000) return probe.p;
  const p = callClaude(config.chatModel, { task: 'chat', system: 'Reply with OK.', messages: [{ role: 'user', content: 'ping' }], maxTokens: 16 }, 30_000)
    .then(() => {
      lastOk = { at: new Date().toISOString(), model: config.chatModel };
      return true;
    })
    .catch((e) => {
      lastError = { at: new Date().toISOString(), message: e instanceof Error ? e.message : String(e) };
      // A real call that succeeded in the last 10 minutes still counts as reachable.
      return Boolean(lastOk && Date.now() - Date.parse(lastOk.at) < 10 * 60_000);
    });
  probe = { at: Date.now(), ok: false, p };
  return p;
}
