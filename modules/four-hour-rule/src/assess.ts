import { classifyFoodDetailed } from './classify'
import { resolveIndoorF, upcoming } from './estimate'
import { lookupFoodKeeper } from './foodkeeper'
import * as R from './rules'
import type { ClockKind, Env, FoodClass, FoodKeeperHit, Item, Outage, Status, Verdict } from './types'

const HOUR_MS = 36e5
const round3 = (x: number) => Math.round(x * 1000) / 1000

type Ctx = {
  now: number
  hoursOut: number | null
  fridgeH: number
  freezerH: number
  fridgeOpens: number
  freezerOpens: number
  indoor: { tempF: number | null; estimated: boolean }
  env: Env
  freezerFull: boolean
}

type Draft = {
  status: Status
  left: number | null // raw hours left; negative = expired that long ago
  allowance: number | null
  clock: ClockKind
  reason: string
  source: string
  quote?: string
  url?: string
  ref?: string
  reasons: string[]
  assumptions: string[]
  foodClass?: FoodClass
  foodkeeper?: FoodKeeperHit
  crossAt?: string
}

export function fmtHours(h: number): string {
  const total = Math.max(0, Math.floor(round3(h) * 60))
  const d = Math.floor(total / 1440)
  const hh = Math.floor((total % 1440) / 60)
  const mm = total % 60
  if (d > 0) return `${d} d ${hh} h`
  return hh > 0 ? `${hh} h ${mm} min` : `${mm} min`
}

// Door taps count only between the outage start and `now`; unparseable taps count (conservative).
function countOpens(list: string[] | undefined, t0: number, now: number): number {
  return (list ?? []).filter((s) => {
    const t = Date.parse(s)
    return !Number.isFinite(t) || !Number.isFinite(t0) || (t >= t0 && t <= now)
  }).length
}

const penalty = (opens: number) => Math.min(R.DOOR_OPEN_CAP_H, opens * R.DOOR_OPEN_PENALTY_H)

export function assess(items: Item[], outage: Outage, env: Env, now?: Date | number): Verdict[] {
  const nowMs = now == null ? Date.now() : typeof now === 'number' ? now : now.getTime()
  const t0 = Date.parse(outage?.startedAt ?? '')
  const hoursOut = Number.isFinite(t0) ? Math.max(0, (nowMs - t0) / HOUR_MS) : null
  const fridgeOpens = countOpens(outage?.doorOpenedAt, t0, nowMs)
  // One "I opened the fridge" button in the UI: unless the caller tracks freezer taps
  // separately, each fridge tap also shortens the freezer clock.
  const freezerOpens = countOpens(outage?.freezerDoorOpenedAt ?? outage?.doorOpenedAt, t0, nowMs)
  const freezerFull = outage?.freezerFull === true
  const safeEnv: Env = env ?? { estimated: false }
  const c: Ctx = {
    now: nowMs,
    hoursOut,
    fridgeH: R.FRIDGE_H - penalty(fridgeOpens),
    freezerH: (freezerFull ? R.FREEZER_FULL_H : R.FREEZER_HALF_H) - penalty(freezerOpens),
    fridgeOpens,
    freezerOpens,
    indoor: resolveIndoorF(safeEnv, hoursOut, nowMs),
    env: safeEnv,
    freezerFull,
  }
  return items.map((it) => finish(it, c, isMed(it) ? medDraft(it, c) : foodDraft(it, c))).sort(order)
}

// Tolerates the vision prompt's raw "medication" category as well as the contract's "med".
const isMed = (it: Item) => (it.category as string) === 'med' || (it.category as string) === 'medication'

function finish(it: Item, c: Ctx, d: Draft): Verdict {
  const v: Verdict = {
    itemId: it.id,
    status: d.status,
    reason: d.reason,
    source: d.source,
    hoursLeft: d.left == null ? null : round3(Math.max(0, d.left)),
    clock: d.clock,
    allowanceHours: d.allowance == null ? null : round3(d.allowance),
    reasons: d.reasons,
    assumptions: d.assumptions,
  }
  if (d.left != null) {
    v.minutesLeft = Math.max(0, Math.floor(round3(d.left) * 60))
    v.deadline = new Date(c.now + d.left * HOUR_MS).toISOString()
  }
  if (d.quote) v.quote = d.quote
  if (d.url) v.url = d.url
  if (d.ref) v.ref = d.ref
  if (d.foodClass) v.foodClass = d.foodClass
  if (d.foodkeeper) v.foodkeeper = d.foodkeeper
  if (d.crossAt) v.crossAt = d.crossAt
  if (isMed(it) && c.indoor.tempF != null) {
    v.indoorTempF = c.indoor.tempF
    v.indoorEstimated = c.indoor.estimated
  }
  return v
}

// ---------- food (FoodSafety.gov chart) ----------

function foodDraft(it: Item, c: Ctx): Draft {
  let foodClass: FoodClass
  let foodkeeper: FoodKeeperHit | undefined
  // A supplied 'unknown' (e.g. from the vision route) still gets the keyword classifier.
  if (it.foodClass && it.foodClass !== 'unknown') {
    foodClass = it.foodClass
    foodkeeper = lookupFoodKeeper(it.name) ?? undefined
  } else {
    const d = classifyFoodDetailed(it.name, { location: it.location, opened: it.opened })
    foodClass = d.foodClass
    foodkeeper = d.foodkeeper
  }
  const a: string[] = []
  if (typeof it.confidence === 'number' && it.confidence < R.LOW_CONFIDENCE && foodClass !== 'unknown') {
    foodClass = 'unknown'
    a.push('low_confidence')
  }
  const base = { source: R.FOODSAFETY_SOURCE, url: R.FOODSAFETY_URL, foodClass, foodkeeper }

  if (c.hoursOut == null) {
    return {
      ...base, status: 'DISCARD', left: 0, allowance: null, clock: 'unknown', quote: R.QUOTES.doubt,
      reason: 'Set when the power went out. Until then the rule is: when in doubt, throw it out (USDA).',
      reasons: ['no_outage_start'], assumptions: a,
    }
  }
  if (foodClass === 'unknown') a.push('unknown_item_discard')

  const fridgeA = c.fridgeOpens ? [...a, 'door_open_penalty'] : a
  const freezerA = c.freezerOpens ? [...a, 'door_open_penalty'] : a
  const freezerClock: ClockKind = c.freezerFull ? 'freezer_48h' : 'freezer_24h'

  switch (foodClass) {
    case 'keep':
      return {
        ...base, status: 'SAFE', left: null, allowance: null, clock: 'none', quote: 'Keep',
        reason: 'On the USDA keep list for power outages. No clock.', reasons: ['keep_list'], assumptions: a,
      }
    case 'shelf_stable':
      return {
        ...base, status: 'SAFE', left: null, allowance: null, clock: 'none', quote: 'Not on the refrigerated chart',
        reason: 'Shelf stable. A power outage does not start a clock for it.', reasons: ['shelf_stable'], assumptions: a,
      }
    case 'mayo_8h_50f':
      return clock(base, c.fridgeH + R.MAYO_AFTER_WARM_H, c.hoursOut, R.FRIDGE_USE_NOW_H, 'after_warm_8h', R.QUOTES.mayo,
        'Opened mayo, tartar sauce, horseradish: discard after 8 hours above 50°F. We start those 8 hours when the 4-hour fridge window ends.',
        [], [...fridgeA, 'warm_start_assumed'])
    case 'frozen_refreeze':
    case 'frozen_discard':
      return clock(base, c.freezerH, c.hoursOut, R.FREEZER_USE_NOW_H, freezerClock, R.QUOTES.freezer,
        `A ${c.freezerFull ? 'full' : 'half-full'} freezer holds a safe temperature for about ${c.freezerFull ? 48 : 24} hours (USDA).` +
          (foodClass === 'frozen_discard' ? ' Ice cream: discard once thawed.' : ' It can be refrozen while it still has ice crystals.'),
        [foodClass === 'frozen_refreeze' ? 'check_ice_crystals_refreeze_ok' : 'ice_cream_discard_if_thawed'], freezerA)
    case 'frozen_veg_6h':
      return clock(base, c.freezerH + R.FROZEN_VEG_AFTER_WARM_H, c.hoursOut, R.FREEZER_USE_NOW_H, 'after_warm_6h', R.QUOTES.frozenVeg,
        'Frozen vegetables: discard after 6 hours above 40°F. We start those 6 hours when the freezer window ends.',
        [], [...freezerA, 'warm_start_assumed'])
    default:
      return clock(base, c.fridgeH, c.hoursOut, R.FRIDGE_USE_NOW_H, 'fridge_4h', R.QUOTES.fridge,
        'A closed fridge keeps food safe for up to 4 hours without power (USDA).' +
          (foodClass === 'unknown' ? ' We could not match this item, so it gets the 4-hour rule.' : ''),
        foodClass === 'unknown' ? ['when_in_doubt'] : [], fridgeA)
  }
}

function clock(
  base: Pick<Draft, 'source' | 'url' | 'foodClass' | 'foodkeeper'>,
  allowH: number, hoursOut: number, useNowH: number, kind: ClockKind, quote: string, why: string,
  reasons: string[], assumptions: string[],
): Draft {
  const left = allowH - hoursOut
  const status: Status = left <= 0 ? 'DISCARD' : left <= useNowH ? 'USE_NOW' : 'SAFE'
  const tail =
    status === 'DISCARD' ? ' Time is up: discard it. When in doubt, throw it out.'
      : status === 'USE_NOW' ? ` ${fmtHours(left)} left: cook or eat it now, or move it to a cooler with ice.`
        : ` ${fmtHours(left)} left.`
  return { ...base, status, left, allowance: allowH, clock: kind, quote, reason: why + tail, reasons, assumptions }
}

// ---------- medications (openFDA label text, Cold Chain verdict rules) ----------

const MED_REPLACE =
  'Keep it as cool as possible, out of the sun, and get a replacement. If it is needed to sustain life (like insulin) and there is no replacement, FDA says it may be used until you get a new supply. Ask your pharmacist.'

function medDraft(it: Item, c: Ctx): Draft {
  const L = it.limit ?? null
  const a: string[] = []
  const unknown = (reason: string, reasons: string[]): Draft => ({
    status: 'UNKNOWN', left: null, allowance: null, clock: 'unknown', reason, reasons, assumptions: a,
    source: L?.source ?? 'FDA label via openFDA', url: L?.url ?? R.OPENFDA_URL, quote: L?.quote, ref: L?.ref,
  })
  if (!L) return unknown('No storage limit found on the label. Ask your pharmacist.', ['no_label_limits', 'ask_pharmacist'])
  const base = { source: L.source, url: L.url ?? R.OPENFDA_URL, quote: L.quote, ref: L.ref }

  if (it.frozen && L.doNotFreeze) {
    return {
      ...base, status: 'DO_NOT_USE', left: 0, allowance: null, clock: 'none', reasons: ['frozen'], assumptions: a,
      reason: 'The label says do not freeze, and this one froze. FDA: do not use insulin that has been frozen. Get a replacement now.',
    }
  }
  const frozenNote = it.frozen ? ['frozen_ask_pharmacist'] : []
  const temp = c.indoor.tempF
  if (temp != null && c.indoor.estimated) a.push('indoor_estimate')
  const max = L.maxTempF
  const tempOver = temp != null && max != null && temp > max
  const overTemp = (): Draft => ({
    ...base, status: 'PAST_LIMIT', left: 0, allowance: null, clock: 'label_max_temp',
    reasons: ['temp_above_label_max', ...frozenNote], assumptions: a,
    reason: `The room is ${temp}°F${c.indoor.estimated ? ' (estimate)' : ''}, above the label limit of ${max}°F. ${MED_REPLACE}`,
  })
  const roomDays = L.kind === 'days_at_room_temp' && L.storage !== 'room_temp' ? L.days : undefined
  const inUse = L.inUseDays

  if (roomDays != null) {
    if (c.hoursOut == null) return unknown('Set when the power went out to start this clock.', ['need_outage_start', ...frozenNote])
    if (max != null && temp == null) {
      return unknown('Enter the indoor temperature (a thermometer reading is best) to check the label limit.', ['need_indoor_temp', ...frozenNote])
    }
    if (tempOver) return overTemp()
    a.push('safety_margin_0_9', 'outage_hours_count_as_room_temp')
    const roomAllow = roomDays * 24 * R.MED_SAFETY_MARGIN
    let left = roomAllow - c.hoursOut
    let allowance = roomAllow
    let kind: ClockKind = 'label_days'
    if (it.openedDaysAgo != null && inUse != null) {
      const useAllow = inUse * 24 * R.MED_SAFETY_MARGIN
      const useLeft = useAllow - it.openedDaysAgo * 24
      if (useLeft < left) {
        left = useLeft
        allowance = useAllow
        kind = 'label_in_use_days'
      }
    }
    const reasons: string[] = [...frozenNote]
    if (left <= 0) {
      return {
        ...base, status: 'PAST_LIMIT', left, allowance, clock: kind, reasons: ['room_temp_days_used_up', ...reasons], assumptions: a,
        reason: `Past the label's ${kind === 'label_days' ? `${roomDays}-day room-temperature` : `${inUse}-day in-use`} allowance (we count 90%). ${MED_REPLACE}`,
      }
    }
    let crossAt: string | undefined
    if (max != null) {
      const fromIndoor = !!c.env.forecastIndoorF?.length
      const cross = upcoming(fromIndoor ? c.env.forecastIndoorF : c.env.hourly, c.now).find((p) => p.tempF > max)
      const tc = cross ? Date.parse(cross.t) : NaN
      if (cross && Number.isFinite(tc)) {
        const hoursToCross = Math.max(0, (tc - c.now) / HOUR_MS)
        if (hoursToCross < left) {
          left = hoursToCross
          kind = 'label_max_temp'
          crossAt = cross.t
          reasons.push('heat_forecast_crosses_label_max')
          if (!fromIndoor) a.push('forecast_outdoor_as_indoor')
        }
      }
    }
    const status: Status = left < R.MED_USE_NOW_H ? 'USE_NOW' : 'SAFE'
    if (status === 'USE_NOW') reasons.push('low_allowance_or_heat_coming')
    const why = crossAt
      ? `The forecast passes the label limit of ${max}°F in ${fmtHours(left)}.`
      : `The label allows ${kind === 'label_days' ? `${roomDays} days at room temperature` : `${inUse} days once opened`}${max != null ? ` up to ${max}°F` : ''}; we count 90% of that. ${fmtHours(left)} left.`
    return {
      ...base, status, left, allowance, clock: kind, reasons, assumptions: a, crossAt,
      reason: status === 'USE_NOW' ? `${why} Plan a replacement now and keep it cool.` : why,
    }
  }

  if (inUse != null) {
    if (it.openedDaysAgo == null) return unknown('Enter the day it was opened or mixed to start its clock.', ['need_opened_date', ...frozenNote])
    if (tempOver) return overTemp()
    a.push('safety_margin_0_9')
    const allowance = inUse * 24 * R.MED_SAFETY_MARGIN
    const left = allowance - it.openedDaysAgo * 24
    const reasons: string[] = [...frozenNote]
    if (max == null) reasons.push('no_heat_limit_on_label')
    if (L.storage === 'refrigerated') reasons.push('refrigeration_required_ask_pharmacist')
    const heatNote = max == null ? ' The label gives no heat limit; heat may shorten this, so ask your pharmacist.' : ''
    if (left <= 0) {
      return {
        ...base, status: 'PAST_LIMIT', left, allowance, clock: 'label_in_use_days', reasons: ['in_use_days_used_up', ...reasons], assumptions: a,
        reason: `Past the label's ${inUse}-day limit after opening or mixing (we count 90%). Get a replacement; ask your pharmacist.`,
      }
    }
    const status: Status = left < R.MED_USE_NOW_H ? 'USE_NOW' : 'SAFE'
    return {
      ...base, status, left, allowance, clock: 'label_in_use_days', reasons, assumptions: a,
      reason: `The label allows ${inUse} days after opening or mixing; we count 90% of that. ${fmtHours(left)} left.${heatNote}`,
    }
  }

  if (L.storage === 'room_temp' || (L.storage == null && L.kind === 'none')) {
    if (tempOver) return overTemp()
    return {
      ...base, status: 'SAFE', left: null, allowance: null, clock: 'none',
      reasons: ['room_temp_med', ...(temp == null && max != null ? ['need_indoor_temp'] : []), ...frozenNote], assumptions: a,
      reason: `Stored at room temperature${max != null ? ` up to ${max}°F` : ''}, so the outage does not start a clock.${temp == null && max != null ? ' Check the room stays at or below that.' : ''}`,
    }
  }

  return unknown('The label says to refrigerate this and gives no room-temperature allowance. Ask your pharmacist.', ['refrigeration_required_ask_pharmacist', ...frozenNote])
}

// ---------- order: what dies first ----------

const RANK: Record<Status, number> = { DO_NOT_USE: 0, DISCARD: 0, PAST_LIMIT: 0, USE_NOW: 1, SAFE: 2, UNKNOWN: 3 }

function order(a: Verdict, b: Verdict): number {
  if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status]
  if (a.hoursLeft == null) return b.hoursLeft == null ? 0 : 1
  if (b.hoursLeft == null) return -1
  return a.hoursLeft - b.hoursLeft
}
