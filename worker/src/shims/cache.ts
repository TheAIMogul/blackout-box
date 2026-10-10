// Worker replacement for server/src/cache.ts: same API (cachedJson, DAY, FetchOpts, Cached) on the Workers
// Cache API (caches.default) instead of server/.cache/. Same TTL semantics: an entry is fresh for opts.ttlMs
// (default 24 h) measured from fetchedAt; entries are kept for at least 7 days so a stale copy can be
// served when the upstream is down (stale-if-error). The cache is per Cloudflare data center.
import { HttpError } from '../../../server/src/errors.ts';

export const DAY = 24 * 3600_000;
const KEEP_MS = 7 * DAY;
const KEY_ORIGIN = 'https://blackoutbox.micahberkley.com/__cache/';

type Entry = { url: string; fetchedAt: string; status: number; body: unknown };

async function keyFor(url: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(url));
  return KEY_ORIGIN + [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const store = () => (globalThis as any).caches?.default as Cache | undefined;

async function readEntry(key: string): Promise<Entry | null> {
  try {
    const r = await store()?.match(key);
    return r ? ((await r.json()) as Entry) : null;
  } catch {
    return null;
  }
}
async function writeEntry(key: string, e: Entry, ttlMs: number) {
  try {
    const maxAge = Math.ceil(Math.max(ttlMs, KEEP_MS) / 1000);
    await store()?.put(key, new Response(JSON.stringify(e), { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${maxAge}` } }));
  } catch {
    /* cache is best-effort */
  }
}

export type FetchOpts = {
  ttlMs?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** HTTP statuses that are a valid "empty" answer (e.g. openFDA 404 NOT_FOUND) and should be cached. */
  okStatuses?: number[];
};

export type Cached<T> = { body: T; status: number; fetchedAt: string; cached: boolean; stale?: boolean };

/** GET JSON with the Cache API. Key is sha1(url); headers (keys) are never part of the key or the stored entry. */
export async function cachedJson<T = any>(url: string, opts: FetchOpts = {}): Promise<Cached<T>> {
  const ttl = opts.ttlMs ?? DAY;
  const key = await keyFor(url);
  const hit = await readEntry(key);
  if (hit && Date.now() - Date.parse(hit.fetchedAt) < ttl) {
    return { body: hit.body as T, status: hit.status, fetchedAt: hit.fetchedAt, cached: true };
  }
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...(opts.headers || {}) },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new HttpError(502, 'UPSTREAM_BAD_JSON', `Non-JSON from ${new URL(url).host} (HTTP ${res.status})`);
    }
    if (!res.ok && !(opts.okStatuses || []).includes(res.status)) {
      throw new HttpError(502, 'UPSTREAM_ERROR', `${new URL(url).host} returned HTTP ${res.status}`);
    }
    const entry: Entry = { url, fetchedAt: new Date().toISOString(), status: res.status, body };
    await writeEntry(key, entry, ttl);
    return { body: body as T, status: res.status, fetchedAt: entry.fetchedAt, cached: false };
  } catch (err) {
    if (hit) return { body: hit.body as T, status: hit.status, fetchedAt: hit.fetchedAt, cached: true, stale: true };
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'UPSTREAM_UNREACHABLE', `Could not reach ${new URL(url).host}: ${(err as Error).message}`);
  }
}
