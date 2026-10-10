// Blackout Box on Cloudflare Workers: the unchanged Express app from server/src/index.ts, run under
// httpServerHandler (cloudflare:node). Static web assets (web/dist) are served by Workers Static Assets;
// only /api/* reaches this code (assets.run_worker_first in wrangler.jsonc).
// build.mjs swaps server/src/{config,cache,demo,engine,providers/claude}.ts for the Worker versions in ./shims.
import { httpServerHandler } from 'cloudflare:node';
import '../../server/src/index.ts'; // side effect: app.listen(config.port) — port comes from shims/config.ts
import { config, WORKER_PORT } from './shims/config';

type Ctx = { waitUntil(p: Promise<unknown>): void };
const express = httpServerHandler({ port: WORKER_PORT }) as unknown as { fetch(req: Request, env: unknown, ctx: Ctx): Promise<Response> };

/*
 * /api/health: the Express handler makes a live Claude probe on a cold isolate (~4-6 s), but the web app gives
 * health 3.5 s before it shows "No server". Workers spread requests over many isolates, so the per-isolate probe
 * cache in providers/index.ts is often cold. Here the last real health body is kept in the colo's Cache API:
 * fresh (< 60 s) -> served as is; older -> served immediately while a live check refreshes it (waitUntil);
 * none at all -> a live check gets 2.5 s, then a provisional body (modelReachable: null, probing: true) is
 * returned and the live result lands in the cache for the next poll.
 */
const HEALTH_KEY = 'https://blackoutbox.micahberkley.com/__cache/api-health';
const FRESH_MS = 60_000;
const FAST_MS = 2_500;
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function health(req: Request, env: unknown, ctx: Ctx): Promise<Response> {
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const hit = await cache?.match(HEALTH_KEY).catch(() => undefined);
  const storedAt = Number(hit?.headers.get('x-stored-at') || 0);
  const age = hit ? Date.now() - storedAt : Infinity;
  const cachedBody = hit ? ((await hit.json().catch(() => null)) as Record<string, unknown> | null) : null;
  if (cachedBody && age < FRESH_MS) return json({ ...cachedBody, _cachedAgeMs: age });

  const live = (async () => {
    const r = await express.fetch(new Request(req.url, { method: 'GET', headers: req.headers }), env, ctx);
    const body = (await r.json()) as Record<string, unknown>;
    if (r.ok && body?.ok) {
      await cache?.put(HEALTH_KEY, new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=900', 'x-stored-at': String(Date.now()) } }));
    }
    return { status: r.status, body };
  })();
  ctx.waitUntil(live.catch(() => undefined));

  if (cachedBody) return json({ ...cachedBody, _cachedAgeMs: age, _refreshing: true });
  const quick = await Promise.race([live.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), FAST_MS))]);
  if (quick) return new Response(JSON.stringify(quick.body), { status: quick.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  return json({
    ok: true,
    online: true,
    demo: config.demo || config.provider === 'demo',
    provider: config.demo || config.provider === 'demo' ? 'demo' : 'claude',
    models: { vision: config.visionModel, chat: config.chatModel },
    modelReachable: null,
    probing: true,
    gateway: 'Cloudflare AI Gateway',
    _model: config.chatModel,
  });
}

export default {
  fetch(req: Request, env: unknown, ctx: Ctx): Promise<Response> {
    const url = new URL(req.url);
    // bb.micahberkley.com is a short link: send it to the one canonical origin (keeps the PWA install and offline data in one place).
    if (url.hostname === 'bb.micahberkley.com') {
      return Promise.resolve(Response.redirect(`https://blackoutbox.micahberkley.com${url.pathname}${url.search}${url.hash}`, 301));
    }
    if (req.method === 'GET' && url.pathname === '/api/health') return health(req, env, ctx);
    return express.fetch(req, env, ctx);
  },
};
