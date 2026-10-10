# Blackout Box — build contract

Read this first. Four agents build in parallel; this file is the only agreement between them.
Specs (read the one for your area): `specs/blackout-box-brief.html` (parent app), `specs/four-hour-rule-brief.html` (countdown engine + vision prompt), `specs/cold-chain-brief.html` (openFDA details, verdict rules, safety rules). Each has a `<script id="build-spec">` JSON block at the end.

Deadline: code freeze **3:20 PM ET** today (Sat Oct 10, 2026). Submission 3:45. Demo 2 minutes.

## Ownership (do not write outside your area)

| Agent | Owns | Must not touch |
| --- | --- | --- |
| A. engine | `modules/four-hour-rule/**`, `skills/blackout-box/**`, `data/**` | anything else |
| B. server | `server/**`, `fixtures/**` | web, modules |
| C. web | `web/**` except `web/src/map/**` | server, modules, map |
| D. map | `web/src/map/**`, `web/public/map/**` | everything else in web; may NOT edit `web/package.json` (deps already installed: maplibre-gl, suncalc, idb; deck.gl is NOT installed, its upstream dep is broken on npm today, use MapLibre heatmap/fill-extrusion layers instead) |

Coordinator owns `README.md`, `CONTRACT.md`, root files. Do not edit `package.json` files except to add a script in your own area. Do not run `npm install` for new packages without noting it in your report; prefer what is installed.

Machine limits: 16 GB RAM with very little free right now, 10 GB disk. Run at most one `vite build` or test run at a time, never a watch + build together. Do not pull any Ollama model. Never print or commit keys; read from env.

## Shared types (engine owns the source; everyone imports)

`modules/four-hour-rule/src/index.ts` exports exactly the types in `specs/four-hour-rule-brief.html` Part B: `Item`, `Limit`, `Outage`, `Env`, `Verdict`, `FoodClass`, `Status`, and
`assess(items: Item[], outage: Outage, env: Env, now?: Date): Verdict[]`
plus `classifyFood(name: string): FoodClass` and `limitForMed(label: OpenFdaLabel): Limit | null`.
Web imports with `import { assess } from '@engine/index'` (alias is set in `web/vite.config.ts` and `web/tsconfig.json`).

Minimum shapes (match the brief; add fields, never rename):
```ts
type Status = 'SAFE' | 'USE_NOW' | 'DISCARD' | 'PAST_LIMIT' | 'DO_NOT_USE' | 'UNKNOWN'  // DO_NOT_USE added by A: frozen med whose label says do not freeze
type Item = { id: string; name: string; category: 'food' | 'med'; container?: string; quantity?: string; opened?: boolean; brandText?: string; foodClass?: FoodClass; limit?: Limit; source?: string }
type Limit = { kind: 'hours_above_temp' | 'days_at_room_temp' | 'none'; hours?: number; days?: number; maxTempF?: number; source: string; quote?: string }
type Outage = { startedAt: string /* ISO */; doorOpenedAt?: string[]; freezerFull?: boolean }
type Env = { indoorTempF?: number; outdoorTempF?: number; estimated: boolean }
type Verdict = { itemId: string; status: Status; deadline?: string /* ISO */; minutesLeft?: number; reason: string; source: string }
```

## Server API (B implements, C and D consume). Base `http://localhost:3001`, dev proxy `/api` from Vite.

All responses JSON. Errors: `{ error: string, code: string }` with 4xx/5xx. Every response includes `"_model"` or `"_source"` where a model or external API was used, so the UI can show it.

| Route | Request | Response |
| --- | --- | --- |
| `GET /api/health` | — | `{ ok, online, demo, provider: 'gemini'|'workers'|'ollama'|'demo', models: { vision, chat } }` |
| `POST /api/vision/items` | `{ imageBase64, mime, hint?: 'fridge'|'meds'|'any' }` | `{ items: Item[], _model }` strict JSON from the P1 prompt in the 4-Hour Rule brief; unknown food → `foodClass: 'unknown'` |
| `POST /api/vision/describe` | `{ imageBase64, mime, kind: 'scene'|'document'|'flood', lang }` | `{ text, _model }` (P4 prompt) |
| `POST /api/chat` | `{ messages: [{role,content}], lang: 'en'|'es'|'ht', context?: object }` | `{ text, _model }` grounded Q&A (P2 prompt); server injects the cached prep bundle as context when `context` is absent |
| `POST /api/translate` | `{ text, to: 'es'|'ht' }` | `{ text, _model }` |
| `GET /api/openfda/label?q=` | name (brand or generic) | `{ name, brand, generic, setId, storageText, limit: Limit|null, _source }` with the cold-chain gotchas (`.exact`, `how_supplied` fallback, skip repackagers with no storage text) |
| `GET /api/nws?lat&lon` | | `{ tempF, heatIndexF, observedAt, station, hourly: [{ t, tempF }], _source }` |
| `GET /api/evac-zone?lat&lon` | | `{ zone: 'A'|'B'|'C'|'D'|'E'|null, category, _source }` from `HurricaneEvacZone_gdb/FeatureServer/0` |
| `GET /api/places?lat&lon&kind=` | `power` (NREL stations, developer.nlr.gov) / `library` / `fire` (MDC ArcGIS) | `{ features: [{ name, lat, lon, address?, open24h?, distanceMi }], _source }` |
| `GET /api/fema` | | `{ declarations: [{ number, title, date, type }], _source }` Miami-Dade from OpenFEMA v2 |
| `GET /api/tide?station=8723214` | | `{ station, predictions: [{ t, v, type }], latest: { t, v }, _source }` NOAA CO-OPS, 48 h hi/lo, MLLW, feet |
| `GET /api/flood311?year=2023` | | GeoJSON FeatureCollection of flooding/drainage 311 requests from `data_311_<year>/FeatureServer/0` (filter on the issue/type field; B discovers the field name and documents it) |
| `GET /api/prep?lat&lon` | | the full prep bundle: `{ generatedAt, zone, nws, places, fema, tide, statute: { number: 'F.S. 252.358', summary }, fdaEmergencyInsulin: { url, summary }, foodRules: { url, headline } }` — C stores this in IndexedDB for offline |

**Model (decided 12:05 PM: Gemma is OUT, no Gemini, no Workers AI, no Ollama).** One provider: Claude through Micah's Cloudflare AI Gateway (`CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_GATEWAY_ID=default`; see `~/.claude/skills/cloudflare-ai-gateway/SKILL.md` for the base URL and headers).
- Vision (`/api/vision/*`): `anthropic/claude-sonnet-5.5` on the Anthropic-format endpoint `/ai/v1/messages` with an `image` content block (`source: { type: 'base64', media_type, data }`). The OpenAI-style `/ai/v1/chat/completions` endpoint silently DROPS images, verified this morning, do not use it for vision. Strip ```json fences before parsing.
- Chat / translate (`/api/chat`, `/api/translate`): `anthropic/claude-fable-5.1` (fall back to `anthropic/claude-sonnet-5.5` on timeout). Max tokens 1200. Same prompt text (P1–P4) as before.
- `MODEL_PROVIDER` is now `claude` | `demo`. `/api/health.provider` reports `'claude'` or `'demo'`; `models` reports the two IDs above. `_model` on responses is the exact model ID.
`DEMO_MODE=1` serves `fixtures/*.json` for every route with `_model: 'demo'`. Cache every external GET to `server/.cache/` keyed by URL (24 h).
Prize impact: we no longer enter Best Use of Gemma 4. Best Open-Source AI is carried by the Agent Skill + the open engine (no model needed). README must say the models are Claude Sonnet 5.5 (vision) and Claude Fable 5.1 (reasoning) via Cloudflare AI Gateway.

## Visual style (decided 12:58 PM): Apple meets Airbnb. REPLACES the Google Cloud console style and the dark "blackout" theme.

The bar: it should feel like a native iPhone app designed by Airbnb. Installable PWA first, phone first.
- **Type**: system font stack so iPhones/Macs render SF Pro: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif` (load Inter from Google Fonts as the non-Apple fallback). Large titles 34/41 bold, -0.02em tracking; body 17; captions 13. Tabular numerals for every clock and number. Never Fraunces, no serif display type.
- **Icons**: `Material Symbols Rounded` (closest web match to SF Symbols), weight 400–500, FILL 0, filled for selected tab.
- **Color (light)**: bg `#FFFFFF`, grouped bg `#F7F7F7`, text `#222222`, secondary `#717171`, hairlines `#EBEBEB`, brand accent Airbnb Rausch `#FF385C` (used sparingly: primary buttons, selected pill underline, key numbers), Apple system colors for status: SAFE `#34C759`, USE NOW `#FF9500`, DISCARD `#FF3B30`, PAST LIMIT `#AF52DE`, DO NOT USE `#FF3B30` with `block` icon, UNKNOWN `#8E8E93`; links `#007AFF`.
- **Blackout mode (the cool factor)**: when the device goes offline (or the user taps the moon), the whole app crossfades into a true-black OLED theme: bg `#000`, cards `#1C1C1E`, text `#F5F5F7`, accents glow softly (status colors with a subtle outer glow), a small "Blackout mode · works offline" pill appears. Coming back online crossfades back. Also follows `prefers-color-scheme: dark`.
- **Shape and depth**: cards radius 20, sheets radius 28 top corners, pills fully rounded; Airbnb card shadow `0 6px 16px rgba(0,0,0,.12)`; no borders on cards in light mode, hairline borders in dark. Frosted glass for the top bar and bottom tab bar: `backdrop-filter: saturate(180%) blur(20px)` on a translucent bg.
- **Layout**: iOS large-title header that collapses on scroll; bottom tab bar (Clocks, Prep, Map, Ask) with safe-area insets; Airbnb-style horizontally scrolling category pills under the title (All, Fridge, Freezer, Medicine, Pantry) with an underline on the selected one; bottom sheets for item detail and settings; segmented controls for freezer full/half and units of time.
- **Motion**: View Transitions API between tabs when supported, spring-like easing `cubic-bezier(.2,.8,.2,1)`, countdown rings animate (Apple Watch activity-ring style), cards lift on press, `navigator.vibrate(10)` on key taps where supported. Respect `prefers-reduced-motion`.
- **Metric everywhere**: °C, km, m, cm. No °F, ft, mi or miles in any UI text. The engine and server work in °F/ft/mi internally; convert at the edge. FDA/USDA quotes stay verbatim (they are citations) but every number we generate is metric.
- **PWA**: installable on iOS and Android: `manifest` with `display: standalone`, theme/background colors, maskable 512 icon, `apple-touch-icon` 180, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `viewport-fit=cover` with safe-area padding, an "Add to Home Screen" sheet (iOS: Share → Add to Home Screen instructions; Android/Chrome: `beforeinstallprompt`).

## Web (C) screens, in this order of priority

1. **Status bar**: online/offline badge (navigator.onLine + `/api/health`), provider name (`claude` / `demo`) and the model ID from `_model` (e.g. "Read by Claude Sonnet 5.5"), language switch en/es/ht.
2. **4-Hour Rule**: camera/file input → `/api/vision/items` → `assess()` → countdown cards sorted by deadline, statuses from the brief's colors, "power went out" time picker, "I opened the fridge" button, freezer full/half. Works fully offline once items exist (engine is local).
3. **Prep**: lat/lon from geolocation (fallback 25.77,-80.19) → `/api/prep` → store in IndexedDB (`idb`) → render zone, shelters/places, FEMA, statute, tide.
4. **Ask**: chat box → `/api/chat` with the stored bundle as `context`; when offline and the server is unreachable, show the cached bundle answers (zone, places, rules) and a plain "AI unavailable offline on phone" line.
5. **Map tab**: `import { mountMap } from './map'` and call `mountMap(el, { lat, lon, apiBase: '/api' })`. If D is not done, the tab shows "map loading".
Safety footer in all three languages, fixed, from the brief. Banned-phrase filter on model text (regexes in the cold-chain brief) before rendering.

## Map (D) — `web/src/map/index.ts` exports `mountMap(el: HTMLElement, opts: { lat: number; lon: number; apiBase: string }): { destroy(): void }`

MapLibre GL with a free style (OpenFreeMap `https://tiles.openfreemap.org/styles/liberty` or MapTiler-free equivalent; verify the URL loads). Layers: evac-zone polygons (query the MDC FeatureServer as GeoJSON, color by zone), 311 flooding points from `/api/flood311` as a heatmap, NOAA tide panel from `/api/tide` (next high, latest observed), and a **flood slider** (0–12 ft) that tints OSM building footprints (OpenFreeMap includes buildings; use fill-extrusion with a height-based color expression) below the chosen level. Use MapLibre's built-in `heatmap` layer for 311 (deck.gl is not available). Phone width must work. No API keys.

## Engine (A)

Implement the brief's `assess()` with the 13 tests in `test/` passing via `npm test` (node --test). Bundle `data/foodkeeper.json` (CC0, from fsis.usda.gov/shared/data/EN/foodkeeper.json; curl returns 403, try a browser User-Agent, else fetch it in the built-in browser pane and save; else ship the rules table from the brief) and `data/food-rules.json` (the FoodSafety.gov chart rows, verbatim with URL). Write `skills/blackout-box/SKILL.md` per agentskills.io (frontmatter name/description, instructions, references to the engine and rules) so the skill works with no model.

## README (coordinator) must list: track 01, data sources with URLs, models (Claude Sonnet 5.5 vision + Claude Fable 5.1 reasoning via Cloudflare AI Gateway), AI tools used (Claude Code: Fable 5.1 coordinator, Opus 5.5 build agents), run instructions, team members, license.

## Reporting back

End your work with a report: files written, what runs (exact command you ran and its output), what you could not verify, and any contract deviation. Never claim something works that you did not run.
