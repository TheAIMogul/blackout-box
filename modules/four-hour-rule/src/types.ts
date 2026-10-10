// Shared types. The first block of each type is the CONTRACT.md minimum shape;
// fields after "extras" come from specs/four-hour-rule-brief.html Part B.

export type Status = 'SAFE' | 'USE_NOW' | 'DISCARD' | 'PAST_LIMIT' | 'UNKNOWN' | 'DO_NOT_USE'

export type FoodClass =
  | 'discard_4h' // FoodSafety.gov "Discard" rows
  | 'keep' // FoodSafety.gov "Keep" rows
  | 'mayo_8h_50f' // opened mayo, tartar sauce, horseradish
  | 'frozen_refreeze' // freezer items that may be refrozen while ice crystals remain
  | 'frozen_discard' // ice cream, frozen yogurt
  | 'frozen_veg_6h' // frozen vegetables
  | 'shelf_stable'
  | 'unknown' // treated as discard_4h

export type Limit = {
  kind: 'hours_above_temp' | 'days_at_room_temp' | 'none'
  hours?: number
  days?: number
  maxTempF?: number
  source: string
  quote?: string
  // extras
  url?: string
  ref?: string // chart row, FoodKeeper ID, or openFDA set_id
  effectiveTime?: string
  field?: string // openFDA field the quote came from
  storage?: 'refrigerated' | 'room_temp'
  inUseDays?: number // in-use or after-mixing window ("Discard suspension after 14 days")
  doNotFreeze?: boolean
}

export type Item = {
  id: string
  name: string
  category: 'food' | 'med'
  container?: string | null
  quantity?: string | null
  opened?: boolean | null
  brandText?: string | null
  foodClass?: FoodClass
  limit?: Limit | null
  source?: string
  // extras
  location?: 'fridge' | 'freezer' | 'door' | 'shelf' | 'cabinet' | null
  confidence?: number // 0..1 from the vision model; food below 0.5 is treated as unknown
  openedDaysAgo?: number | null // meds: days since opened, or since a suspension was mixed
  frozen?: boolean // meds: the user says it froze
}

export type Outage = {
  startedAt: string // ISO; '' or unparseable means "not set"
  doorOpenedAt?: string[] // ISO timestamps of "I opened the fridge" taps
  freezerFull?: boolean // true → 48 h, false/undefined → 24 h
  // extras
  freezerDoorOpenedAt?: string[] // when absent, fridge door taps also count for the freezer
}

export type HourlyPoint = { t: string; tempF: number }

export type Env = {
  indoorTempF?: number
  outdoorTempF?: number
  estimated: boolean
  // extras
  hourly?: HourlyPoint[] // NWS hourly forecast (outdoor °F), same shape as GET /api/nws
  forecastIndoorF?: HourlyPoint[] // optional indoor forecast; preferred over hourly for heat-crossing
}

export type ClockKind =
  | 'fridge_4h'
  | 'freezer_48h'
  | 'freezer_24h'
  | 'after_warm_8h'
  | 'after_warm_6h'
  | 'label_days'
  | 'label_in_use_days'
  | 'label_max_temp'
  | 'none'
  | 'unknown'

export type FoodKeeperHit = {
  id: number
  name: string
  subtitle?: string
  categoryId: number
  refrigeratorDays?: [number, number]
  freezerDays?: [number, number]
  refrigeratorNote?: string
  freezerNote?: string
}

export type Verdict = {
  itemId: string
  status: Status
  deadline?: string // ISO; absent = no clock. In the past for DISCARD / PAST_LIMIT items.
  minutesLeft?: number // absent = no clock
  reason: string // one plain-English sentence; i18n keys are in `reasons`
  source: string
  // extras
  hoursLeft: number | null
  clock: ClockKind
  allowanceHours: number | null // total allowance the clock was computed from
  quote?: string
  url?: string
  ref?: string
  reasons: string[] // machine keys for i18n copy
  assumptions: string[] // e.g. door_open_penalty, indoor_estimate, unknown_item_discard
  foodClass?: FoodClass
  foodkeeper?: FoodKeeperHit
  indoorTempF?: number
  indoorEstimated?: boolean
  crossAt?: string // ISO time the forecast passes the label max, if within the clock
}

// Accepts either the server's simplified label ({ name, brand, generic, setId, storageText })
// or a raw openFDA /drug/label.json result record.
export type OpenFdaLabel = {
  name?: string
  brand?: string
  generic?: string
  setId?: string
  effectiveTime?: string
  storageText?: string
  set_id?: string
  effective_time?: string
  storage_and_handling?: string[]
  how_supplied?: string[]
  package_label_principal_display_panel?: string[]
  openfda?: { brand_name?: string[]; generic_name?: string[]; manufacturer_name?: string[]; route?: string[] }
}
