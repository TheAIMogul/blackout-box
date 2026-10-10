// Writes data/food-rules.json from src/rules.ts so the JSON and the engine never drift.
// Usage: node --import tsx scripts/build-food-rules.ts
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as R from '../src/rules'

export function foodRulesDoc() {
  return {
    source: 'FoodSafety.gov, Food Safety During Power Outage',
    url: R.FOODSAFETY_URL,
    reviewed: '2024-08-08',
    captured: '2026-10-10 ~10:55 ET in a browser (the host returns HTTP 403 to curl)',
    attribution: 'FoodSafety.gov attributes the 4-hour line to USDA, Keeping Food Safe During an Emergency',
    quotes: R.QUOTES,
    constants: {
      FRIDGE_H: R.FRIDGE_H, FRIDGE_USE_NOW_H: R.FRIDGE_USE_NOW_H, FREEZER_FULL_H: R.FREEZER_FULL_H, FREEZER_HALF_H: R.FREEZER_HALF_H,
      FREEZER_USE_NOW_H: R.FREEZER_USE_NOW_H, DOOR_OPEN_PENALTY_H: R.DOOR_OPEN_PENALTY_H, DOOR_OPEN_CAP_H: R.DOOR_OPEN_CAP_H,
      MAYO_AFTER_WARM_H: R.MAYO_AFTER_WARM_H, FROZEN_VEG_AFTER_WARM_H: R.FROZEN_VEG_AFTER_WARM_H,
    },
    ours: ['FREEZER_USE_NOW_H', 'DOOR_OPEN_PENALTY_H', 'DOOR_OPEN_CAP_H', 'warm-start of the mayo 8 h and frozen-vegetable 6 h counters'],
    note: 'hours = allowance from the outage start before the door penalty; null = no clock. verbatim:false rows are trimmed summaries from the brief.',
    rows: R.FOOD_RULES,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = fileURLToPath(new URL('../../../data/food-rules.json', import.meta.url))
  writeFileSync(out, JSON.stringify(foodRulesDoc(), null, 2) + '\n')
  console.log(`wrote ${R.FOOD_RULES.length} rows to ${out}`)
}
