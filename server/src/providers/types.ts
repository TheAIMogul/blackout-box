export type ProviderName = 'claude';
export type Task = 'vision' | 'chat' | 'translate';
export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export type ModelRequest = {
  /** vision -> VISION_MODEL (Sonnet 5.5); chat -> CHAT_MODEL (Fable 5.1) with Sonnet fallback on timeout. */
  task: Task;
  system: string;
  /** Conversation turns; the image (if any) is attached to the FIRST user turn. */
  messages: ChatMsg[];
  imageBase64?: string; // bare base64, no data: prefix
  mime?: string;
  maxTokens?: number;
  timeoutMs?: number;
};

export type ProviderReply = { text: string; model: string; finishReason?: string; usage?: unknown };

export class ProviderError extends Error {
  constructor(public provider: ProviderName, public status: number, message: string, public model?: string) {
    super(message);
  }
}

export async function postJson(provider: ProviderName, url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const err = e as Error;
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    throw new ProviderError(provider, timedOut ? 504 : 0, timedOut ? `timed out after ${timeoutMs / 1000}s` : `unreachable (${err.message})`);
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.errors?.[0]?.message || json?.error || text.slice(0, 200);
    throw new ProviderError(provider, res.status, `HTTP ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  if (json == null) throw new ProviderError(provider, 502, 'non-JSON response');
  return json;
}
