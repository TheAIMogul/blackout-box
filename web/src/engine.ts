// Adapter between the UI and the 4-Hour Rule engine.
// The UI never depends on the engine's exact field names: verdicts are normalized here, so
// either CONTRACT.md shapes (deadline/minutesLeft/reason/source) or the brief's Part B shapes
// (expiresAt/hoursLeft/reasons/limit.source) render the same.
// Agent A's engine (modules/four-hour-rule/src), via the @engine alias.
import { assess as engineAssess } from '@engine/index'
export const ENGINE_NAME = 'modules/four-hour-rule/src/index.ts'

export type Status = 'SAFE' | 'USE_NOW' | 'DISCARD' | 'PAST_LIMIT' | 'DO_NOT_USE' | 'UNKNOWN'
export type WebItem = {
  id: string; name: string; category: 'food' | 'med'; container?: string; quantity?: string; opened?: boolean
  brandText?: string; foodClass?: string; limit?: { kind: string; hours?: number; days?: number; maxTempF?: number; source: string; quote?: string; fromOpened?: boolean; inUseDays?: number; storage?: 'refrigerated' | 'room_temp'; [k: string]: unknown }
  source?: string; location?: string; openedDaysAgo?: number | null; frozen?: boolean; confidence?: number
  [k: string]: unknown
}
export type WebOutage = { startedAt: string; doorOpenedAt: string[]; freezerFull: boolean }
export type WebEnv = { indoorTempF?: number; outdoorTempF?: number; estimated: boolean; hourly?: { t: string; tempF: number }[] }
export type NV = { itemId: string; status: Status; deadlineMs: number | null; reason: string; source: string; quote?: string; url?: string; clock?: string; hint?: string; indoorEstimated?: boolean; allowanceH?: number | null }

const STATUSES: Status[] = ['SAFE', 'USE_NOW', 'DISCARD', 'PAST_LIMIT', 'DO_NOT_USE', 'UNKNOWN']
const ALIAS: Record<string, Status> = { OK: 'SAFE', USE_SOON: 'USE_NOW', OVER_LIMIT: 'PAST_LIMIT' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function norm(v: any, nowMs: number): NV {
  const raw = String(v?.status ?? 'UNKNOWN')
  const status: Status = (STATUSES as string[]).includes(raw) ? (raw as Status) : (ALIAS[raw] ?? 'UNKNOWN')
  let deadlineMs: number | null = null
  const d = v?.deadline ?? v?.expiresAt ?? v?.deadlineAt
  if (typeof d === 'string' && Number.isFinite(Date.parse(d))) deadlineMs = Date.parse(d)
  else if (typeof v?.minutesLeft === 'number') deadlineMs = nowMs + v.minutesLeft * 6e4
  else if (typeof v?.hoursLeft === 'number') deadlineMs = nowMs + v.hoursLeft * 36e5
  const reason = typeof v?.reason === 'string' ? v.reason : Array.isArray(v?.reasons) ? v.reasons.join(' · ') : ''
  const src = v?.source ?? v?.limit?.source
  const source = typeof src === 'string' ? src : (src?.name ?? src?.url ?? '')
  const quote = v?.quote ?? v?.limit?.quote ?? v?.limit?.source?.quote
  const url = v?.url ?? v?.limit?.url ?? v?.limit?.source?.url
  const fk = v?.foodkeeper
  const hint = fk ? [fk.name, fk.subtitle].filter(Boolean).join(', ') + (fk.id != null ? ` (USDA FoodKeeper #${fk.id})` : '') : undefined
  return {
    itemId: String(v?.itemId ?? v?.id ?? ''), status, deadlineMs, reason, source,
    quote: typeof quote === 'string' ? quote : undefined,
    url: typeof url === 'string' ? url : undefined,
    clock: typeof v?.clock === 'string' ? v.clock : undefined,
    hint, indoorEstimated: v?.indoorEstimated === true,
    allowanceH: typeof v?.allowanceHours === 'number' ? v.allowanceHours : null,
  }
}

export function runAssess(items: WebItem[], outage: WebOutage, env: WebEnv, now: Date = new Date()): NV[] {
  // Pass both naming conventions; engines ignore fields they do not know.
  const o = { ...outage, doorOpens: outage.doorOpenedAt, freezerDoorOpens: [] as string[] }
  const e = { ...env, indoorSource: env.indoorTempF == null ? null : env.estimated ? 'estimate' : 'user' }
  // A food class the server picked at photo time can be stale (saved before a classifier fix, or before the item was
  // moved to the fridge/freezer). Re-classify vision items here with their current name + location; hand-set classes stay.
  const fresh = items.map((it) =>
    it.category === 'food' && typeof it.source === 'string' && it.source.startsWith('vision') && it.foodClass
      ? (({ foodClass: _fc, ...rest }) => rest as WebItem)(it)
      : it)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = (engineAssess as any)(fresh, o, e, now) as unknown[]
  return (Array.isArray(out) ? out : []).map((v) => norm(v, now.getTime()))
}
