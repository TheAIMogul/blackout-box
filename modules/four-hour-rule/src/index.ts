// The 4-Hour Rule engine. Pure TypeScript, no runtime dependencies, no network, no model.
// Deterministic for a given `now`. Rules: FoodSafety.gov power-outage chart (food) and
// openFDA label storage text (medications); see data/SOURCES.md.

export type {
  ClockKind,
  Env,
  FoodClass,
  FoodKeeperHit,
  HourlyPoint,
  Item,
  Limit,
  OpenFdaLabel,
  Outage,
  Status,
  Verdict,
} from './types'
export type { ClassifyOptions, Classification } from './classify'

export { assess, fmtHours } from './assess'
export { classifyFood, classifyFoodDetailed } from './classify'
export { limitForMed, storageTextOf } from './meds'
export { estimateIndoorF, resolveIndoorF } from './estimate'
export { lookupFoodKeeper, foodKeeperClassHint, FOODKEEPER_SOURCE, FOODKEEPER_URL } from './foodkeeper'
export * from './rules'
