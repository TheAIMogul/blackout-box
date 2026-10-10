# four-hour-rule engine

Pure TypeScript, no runtime dependencies, no network, no model. Deterministic for a given `now`.

- Test: `npm test` (runs `node --test --test-concurrency=1 --import tsx test/*.test.ts`, 63 tests incl. the brief's 13).
- `assess(items, outage, env, now?) → Verdict[]` sorted by what dies first (DO_NOT_USE/DISCARD/PAST_LIMIT, then hours left, then no-clock SAFE, UNKNOWN last).
- `classifyFood(name, { location?, opened? }) → FoodClass` (FoodSafety.gov chart keywords en/es/ht, then FoodKeeper hint, else `unknown` = 4-hour rule).
- `limitForMed(openFdaLabel) → Limit | null` parses label storage text ("28 days", "up to 86°F", "Discard suspension after 14 days"); `lookupFoodKeeper(name)` gives fridge/freezer days.
- Food clocks: FoodSafety.gov (4 h fridge, last 2 h USE_NOW; freezer 48 h full / 24 h half). Meds: label × 0.9, forecast-aware; insulin over its limit is PAST_LIMIT, never DISCARD.
- Our assumptions (door tap −0.5 h, cap 2 h; 90% med margin; indoor estimate) are listed in `skills/blackout-box/references/rules.md`.
- `npm run build:data` regenerates `src/foodkeeper-data.ts` and `data/food-rules.json`; `npm run build:skill` bundles `skills/blackout-box/scripts/engine.mjs`.
- Sources and licenses: `data/SOURCES.md`.
