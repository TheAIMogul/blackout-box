import type { Env, HourlyPoint } from './types'

// Indoor temperature heuristic from the Cold Chain brief. Not validated and not from USDA/FDA:
// every result is labeled as an estimate, and the app asks for a thermometer reading first.
//   < 4 h without power: max(78, outdoor now − 4)
//   ≥ 4 h:               max(80, outdoor now, next 6 hourly forecast °F)
export function estimateIndoorF(outdoorNowF: number, hourlyF: number[], hoursSinceOutage: number): number {
  if (hoursSinceOutage < 4) return Math.max(78, outdoorNowF - 4)
  return Math.max(80, outdoorNowF, ...hourlyF.slice(0, 6))
}

// Hourly points at or after `now`, in time order. Points with unparseable times keep input order.
export function upcoming(points: HourlyPoint[] | undefined, now: number): HourlyPoint[] {
  if (!points?.length) return []
  return points
    .map((p, i) => ({ p, i, t: Date.parse(p.t) }))
    .filter((x) => !Number.isFinite(x.t) || x.t >= now - 30 * 60e3)
    .sort((a, b) => (Number.isFinite(a.t) && Number.isFinite(b.t) ? a.t - b.t : a.i - b.i))
    .map((x) => x.p)
}

export function resolveIndoorF(env: Env, hoursOut: number | null, now: number): { tempF: number | null; estimated: boolean } {
  if (typeof env.indoorTempF === 'number' && Number.isFinite(env.indoorTempF)) {
    return { tempF: env.indoorTempF, estimated: env.estimated }
  }
  if (typeof env.outdoorTempF === 'number' && Number.isFinite(env.outdoorTempF)) {
    const next = upcoming(env.hourly, now).map((p) => p.tempF)
    return { tempF: estimateIndoorF(env.outdoorTempF, next, hoursOut ?? 0), estimated: true }
  }
  return { tempF: null, estimated: false }
}
