// Disk cache for external GETs: server/.cache/<sha1(url)>.json, default TTL 24 h.
// On network failure a stale entry is served (stale-if-error) so the box keeps working offline.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CACHE_DIR } from './config.js';
import { HttpError } from './errors.js';

export const DAY = 24 * 3600_000;
const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');

type Entry = { url: string; fetchedAt: string; status: number; body: unknown };

async function readEntry(key: string): Promise<Entry | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(CACHE_DIR, key + '.json'), 'utf8')) as Entry;
  } catch {
    return null;
  }
}
async function writeEntry(key: string, e: Entry) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, key + '.json'), JSON.stringify(e));
}

export type FetchOpts = {
  ttlMs?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** HTTP statuses that are a valid "empty" answer (e.g. openFDA 404 NOT_FOUND) and should be cached. */
  okStatuses?: number[];
};

export type Cached<T> = { body: T; status: number; fetchedAt: string; cached: boolean; stale?: boolean };

/** GET JSON with disk cache. Cache key is sha1(url); headers (keys) are never part of the key or the file. */
export async function cachedJson<T = any>(url: string, opts: FetchOpts = {}): Promise<Cached<T>> {
  const ttl = opts.ttlMs ?? DAY;
  const key = sha1(url);
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
    await writeEntry(key, entry);
    return { body: body as T, status: res.status, fetchedAt: entry.fetchedAt, cached: false };
  } catch (err) {
    if (hit) return { body: hit.body as T, status: hit.status, fetchedAt: hit.fetchedAt, cached: true, stale: true };
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'UPSTREAM_UNREACHABLE', `Could not reach ${new URL(url).host}: ${(err as Error).message}`);
  }
}
