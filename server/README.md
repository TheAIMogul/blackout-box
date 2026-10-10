# Blackout Box server

Express 5 + TypeScript (run with `tsx`, no build step). Implements the API table in `../CONTRACT.md`.
Keys stay on the server; every external GET is cached to `server/.cache/` (sha1 of the URL, 24 h by default,
weather 10 min / tide 6 min / FEMA 6 h, stale copy served if the network is down). `DEMO_MODE=1` answers every
route from `../fixtures/*.json` with no network and no keys.

## Environment

See `../.env.example` (names only; never commit values). The server reads `process.env` directly; it does not load a
`.env` file, so export variables in your shell or use `node --env-file`.

| Var | Use |
| --- | --- |
| `PORT` | default `3001` |
| `DEMO_MODE` | `1` = all routes from `fixtures/` (no network, no keys) |
| `MODEL_PROVIDER` | `claude` (default) or `demo` (model routes from fixtures, data routes live) |
| `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_GATEWAY_ID` | Cloudflare AI Gateway (Claude via Unified Billing); gateway default `default` |
| `VISION_MODEL` | default `anthropic/claude-sonnet-5.5` (`/api/vision/*`, Anthropic `/ai/v1/messages` with an `image` block) |
| `CHAT_MODEL` | default `anthropic/claude-fable-5.1` (`/api/chat`, `/api/translate`; falls back to `VISION_MODEL` on timeout/429/5xx) |
| `DATA_GOV_API_KEY` | api.data.gov key: openFDA (`X-Api-Key`, optional) and NREL/NLR (required for `places?kind=power`) |
| `NWS_USER_AGENT` | optional, default `BlackoutBox (hackathon)` |
| `CORS_ORIGINS` | optional, default `http://localhost:5173,http://127.0.0.1:5173` |

## Run

```bash
cd server
npm run typecheck
DEMO_MODE=1 npm start                       # offline demo, fixtures only
# live (keys from local files, never printed):
export CF_API_TOKEN=$(cat ~/.config/cloudflare/claude-api-token) CF_ACCOUNT_ID=$(cat ~/.config/cloudflare/account-id) \
       CF_GATEWAY_ID=default DATA_GOV_API_KEY=$(cat ~/.config/data-gov/api-key)
npm start
npm run record                              # re-record fixtures/ from real calls (steps: data flood fda chat translate vision describe items health)
```

## Files

- `src/index.ts` routes; `src/ai.ts` the four model jobs + P2 context router; `src/prompts.ts` the prompts copied verbatim
  from the briefs by script (P1 = 4-Hour Rule vision prompt, P2 grounded Q&A, P3 translate, P4 scene read);
  `src/safety.ts` banned-phrase filters (run server-side on chat, describe and translate output); `src/json.ts` fence
  stripping + defensive JSON parse (one retry with the brief's retry line).
- `src/providers/claude.ts` Claude through Cloudflare AI Gateway (Anthropic Messages format); `src/providers/index.ts`
  model selection, Fable to Sonnet fallback, health probe.
- `src/data/*` openFDA, NWS, Miami-Dade ArcGIS (evac zone, libraries, fire stations, shelters), NREL/NLR, OpenFEMA,
  NOAA CO-OPS, 311 flooding, prep bundle, static cited text. `src/cache.ts` disk cache. `src/demo.ts` fixtures.
- `src/record.ts` writes `../fixtures/*.json` from real calls.

## Notes the other agents need

- `/api/flood311`: `data_311_<year>/FeatureServer/0` is a **table** (geometry is null), so points are built from its
  `latitude`/`longitude` fields. Filter field **`issue_type`**:
  `(UPPER(issue_type) LIKE '%FLOOD%' OR UPPER(issue_type) LIKE '%DRAIN%')`, which in 2023 matches FLOODING / STANDING
  WATER - LOCALIZED (377), RER DRAINAGE CANALS FLOOD COMPLAINT (195), DRAIN CLOGGED / CLEANING (1730), DRAIN TOPS
  CLEANED (187), DRAIN (STORM) MISSING COVER (86), DRAIN - REPAIR (85), CAVE - IN NEXT TO DRAIN (72), DRAIN - OBJECT
  REMOVAL (15): 2,736 points with coordinates. Paged 1,000 at a time, capped at 5,000. Feature properties:
  `id, issue_type, status, created, address, district`. 2024 needs a token (499), 2025 does not exist; 2022 is public.
  The demo fixture is a 1,105-point subset (all 561 FLOOD rows + every 4th drainage row).
- `/api/places` also accepts `kind=shelter` (EvacuationCenterShelters_Open, 0 features today). Libraries / fire
  stations / EV chargers are "likely has power", never "cooling center".
- `/api/openfda/label` returns `found:false` (HTTP 200) when no label with storage text exists, so the UI can show
  UNKNOWN. `limit.kind` is `days_at_room_temp` (refrigerated product with a day allowance; shortest day count in the
  label text, ignoring diluted/pump/IV sentences) or `none` with `maxTempF` (room-temperature product, no clock).
  `limit` comes from the engine's `limitForMed()` (`_limitBy: 'engine.limitForMed'`) when the module loads, else from the server regex parser (`_limitBy: 'server-regex'`). The raw `storageText` is always returned.
- `/api/vision/items` maps the P1 reply to the CONTRACT `Item` (`category: 'food' | 'med'`, `brandText`); model
  category `other` becomes food with `foodClass: 'unknown'`. If the engine's `classifyFood` is importable from
  `modules/four-hour-rule/src/index.ts` it is applied to food items; otherwise `foodClass` is set only for unknown or
  low-confidence (< 0.5) items.
- `/api/vision/describe` returns `{ text, scene, hazards, hazardCard, document, confidence }`; non-English `lang`
  is produced by translating the English P4 description with P3.
- `/api/chat` returns `{ text, sources, call_911, contextKeys }`; without `context` it uses the last `/api/prep`
  bundle (or builds one for 25.77,-80.19).
- Every model response carries `_model` (exact model ID) and `_latencyMs`; data responses carry `_source` and
  `fetchedAt`. In demo mode `_model` is `'demo'` and `_demo: true`.

## Smoke test

```bash
B=http://localhost:3001/api
curl -s $B/health
curl -s "$B/prep?lat=25.77&lon=-80.19"
curl -s "$B/evac-zone?lat=25.77&lon=-80.19"          # zone "B"
curl -s "$B/nws?lat=25.77&lon=-80.19"
curl -s "$B/places?lat=25.77&lon=-80.19&kind=power"   # also library | fire | shelter
curl -s $B/fema
curl -s "$B/tide?station=8723214"
curl -s "$B/flood311?year=2023" | head -c 400
curl -s "$B/openfda/label?q=Lantus"
python3 -c "import base64,json;print(json.dumps({'imageBase64':base64.b64encode(open('../../reports/decision-models/label.png','rb').read()).decode(),'mime':'image/png','hint':'meds'}))" > /tmp/label.json
curl -s -X POST $B/vision/items -H 'content-type: application/json' --data @/tmp/label.json
curl -s -X POST $B/chat -H 'content-type: application/json' -d '{"lang":"ht","messages":[{"role":"user","content":"Ki kote mwen ka jwenn kouran?"}]}'
curl -s -X POST $B/translate -H 'content-type: application/json' -d '{"text":"Zone B. Check whether Zone B has been ordered to evacuate.","to":"es"}'
```
