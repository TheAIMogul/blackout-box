# Blackout Box on Cloudflare Workers

Live at **https://blackoutbox.micahberkley.com** (Worker `blackout-box`, account `Micahberkley@gmail.com's Account`).
Debug URL: https://blackout-box.micahberkley.workers.dev (same Worker; the Cache API is a no-op there).

One Worker serves both halves of the app:

- **Web**: `../web/dist` through Workers Static Assets (`not_found_handling: single-page-application`).
- **API**: `/api/*` only (`assets.run_worker_first: ["/api/*"]`) goes to the **unchanged Express app** from
  `../server/src/index.ts`, run under `httpServerHandler` from `cloudflare:node` (`nodejs_compat`).

## How the server code runs here

`build.mjs` bundles `src/index.ts` + `../server/src/**` + the engine (`../modules/four-hour-rule/src`) into
`dist/worker.js` with esbuild and swaps five server modules for Worker versions (an esbuild resolve plugin; the
server files themselves are not edited):

| Server module | Worker version | Why |
| --- | --- | --- |
| `config.ts` | `src/shims/config.ts` | env from `cloudflare:workers` (vars + secrets), no file paths |
| `cache.ts` | `src/shims/cache.ts` | Workers Cache API (`caches.default`) instead of `server/.cache/`; same TTLs, entries kept 7 days for stale-if-error |
| `demo.ts` | `src/shims/demo.ts` | `fixtures/*.json` bundled at build time (`DEMO_MODE=1` works) |
| `engine.ts` | `src/shims/engine.ts` | engine imported statically instead of loaded from disk |
| `providers/claude.ts` | `src/shims/claude.ts` | **Workers AI binding** (`env.AI.run(model, AnthropicMessagesBody, { gateway: { id } })`) when no token is set; the original REST code when `CF_ACCOUNT_ID` + `CF_API_TOKEN` are set |

`data/prep.ts` gets a no-op `node:fs` (the last prep bundle stays in memory). npm packages (`express`, `cors`)
are bundled by wrangler from `worker/node_modules`.

`src/index.ts` also fronts `GET /api/health`: the Express handler makes a live Claude probe (4 to 6 s on a cold
isolate) and the web app waits only 3.5 s, so the last good health body is kept in the Cache API (fresh 60 s,
then served while a refresh runs in `waitUntil`; with nothing cached a live check gets 2.5 s, then a provisional
body with `modelReachable: null, probing: true` is returned).

## Models

Claude Sonnet 5.5 (vision) and Claude Fable 5.1 (chat/translate) through the **AI binding** routed via the
`default` AI Gateway with Unified Billing. No Cloudflare API token is stored in the Worker.

## Config

| Name | Kind | Value |
| --- | --- | --- |
| `AI` | AI binding | `wrangler.jsonc` `ai.binding` |
| `CF_GATEWAY_ID` | var | `default` |
| `MODEL_PROVIDER` | var | `claude` (`demo` = model routes from fixtures) |
| `DATA_GOV_API_KEY` | secret | api.data.gov key (NREL/NLR EV chargers, openFDA) |
| `DEMO_MODE` | optional var | `1` = every route from bundled fixtures |
| `CF_ACCOUNT_ID`, `CF_API_TOKEN` | optional secrets | only to force the REST transport instead of the binding (not set) |

## Deploy

```bash
cd worker
npm install
cd ../web && npm run build && cd ../worker          # web/dist must be current
export CLOUDFLARE_API_TOKEN=$(cat ~/.config/cloudflare/claude-api-token) CLOUDFLARE_ACCOUNT_ID=$(cat ~/.config/cloudflare/account-id)
npx wrangler whoami                                    # expect account a6a9f59c...
npx wrangler deploy                                    # runs build.mjs (build.command), uploads web/dist + Worker
# secrets (piped from files, never echoed):
tr -d '\n' < ~/.config/data-gov/api-key | npx wrangler secret put DATA_GOV_API_KEY
npx wrangler secret list
```

Local run in workerd (port 8788, AI binding is remote): `npx wrangler dev --port 8788`. Put local-only secrets in
`worker/.dev.vars` (git-ignored).

## Smoke test

```bash
B=https://blackoutbox.micahberkley.com
curl -s $B/api/health                                   # provider claude, modelReachable true
curl -s "$B/api/evac-zone?lat=25.77&lon=-80.19"         # zone B
curl -s $B/api/tide                                     # 8 predictions
curl -s "$B/api/openfda/label?q=Lantus"                 # 28 days / 86 F
curl -s "$B/api/flood311?year=2023" | head -c 200       # 2,736 features
```
