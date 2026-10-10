import type { Tide, TidePoint } from './data'
import { ftToM, mToFt, KING_TIDE_M, MHHW_M, THRESHOLDS } from './flood'
const ft2 = (m: number) => mToFt(m).toFixed(2)

// NOAA returns feet above MLLW; everything below is converted to metres at the edge.
// King-tide badge: demo heuristic, 2.9 ft MLLW = 0.88 m. NOAA/NWS minor flood for this gauge = 1.07 m MLLW
// (floodlevels.json, units=metric: 4.163 m STND − MLLW 3.089 m STND).

type Pt = { t: string; v: number; type?: string } // v in metres

/** Current wall-clock time at the station, as "YYYY-MM-DD HH:MM" (same format NOAA returns for lst_ldt). */
export function nowAtStation(): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`
}

/** Minutes since epoch for a "YYYY-MM-DD HH:MM" wall time, treated as UTC (only used for relative spacing). */
function wallMinutes(t: string): number {
  const [d, hm] = t.split(' ')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = (hm || '00:00').split(':').map(Number)
  return Date.UTC(y, mo - 1, da, h, mi) / 60000
}

export function fmtTime(t: string, withDay: boolean): string {
  const [d, hm] = t.split(' ')
  const [h, mi] = (hm || '00:00').split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const time = `${h12}:${String(mi).padStart(2, '0')} ${ap}`
  if (!withDay) return time
  if (d === nowAtStation().slice(0, 10)) return `${h >= 17 ? 'Tonight' : 'Today'} ${time}`
  const [y, mo, da] = d.split('-').map(Number)
  const day = new Date(Date.UTC(y, mo - 1, da)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  return `${day} ${time}`
}

const ms = (name: string) => `<span class="bbm-ms" aria-hidden="true">${name}</span>`
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
const toM = (p: TidePoint): Pt => ({ t: p.t, v: ftToM(p.v), type: p.type })

/** The next predicted high tide in metres (the storm animation's first stop). */
export function nextHighM(tide: Tide | null): { m: number; t: string | null; label: string } {
  const now = nowAtStation()
  const hi = tide?.predictions.map(toM).sort((a, b) => a.t.localeCompare(b.t)).find((p) => p.type === 'H' && p.t > now)
  if (hi) return { m: hi.v, t: hi.t, label: `High tide ${fmtTime(hi.t, true).replace(/^(Today|Tonight) /, (_, w: string) => w.toLowerCase() + ' ')}` }
  return { m: MHHW_M, t: null, label: 'Typical high tide (MHHW)' }
}

/** Cosine interpolation between hi/lo extremes: the shape NOAA's own curve has between turning points. */
function levelAt(preds: Pt[], m: number): number | null {
  for (let i = 0; i < preds.length - 1; i++) {
    const a = wallMinutes(preds[i].t), b = wallMinutes(preds[i + 1].t)
    if (m >= a && m <= b) {
      const f = (m - a) / (b - a || 1)
      return preds[i].v + (preds[i + 1].v - preds[i].v) * (1 - Math.cos(Math.PI * f)) / 2
    }
  }
  return null
}

/** Smooth 48 h tide wave with a filled area, threshold lines, day ticks and a pulsing "now" dot. */
function wave(preds: Pt[], now: string): string {
  if (preds.length < 2) return ''
  const W = 340, H = 104, TOP = 10, BOT = 18, L = 2, R = 2
  const t0 = wallMinutes(preds[0].t), t1 = wallMinutes(preds[preds.length - 1].t)
  const vs = preds.map((p) => p.v)
  const vmin = Math.min(0, ...vs), vmax = Math.max(KING_TIDE_M + 0.12, ...vs)
  const x = (m: number) => L + ((m - t0) / (t1 - t0 || 1)) * (W - L - R)
  const y = (v: number) => TOP + (1 - (v - vmin) / (vmax - vmin || 1)) * (H - TOP - BOT)
  let d = ''
  for (let i = 0; i < preds.length - 1; i++) {
    const a = preds[i], b = preds[i + 1]
    const ma = wallMinutes(a.t), mb = wallMinutes(b.t)
    for (let s = i === 0 ? 0 : 1; s <= 16; s++) {
      const f = s / 16
      const v = a.v + (b.v - a.v) * (1 - Math.cos(Math.PI * f)) / 2
      d += `${d ? 'L' : 'M'}${x(ma + (mb - ma) * f).toFixed(1)},${y(v).toFixed(1)}`
    }
  }
  const base = (H - BOT).toFixed(1)
  const area = `${d}L${x(t1).toFixed(1)},${base}L${x(t0).toFixed(1)},${base}Z`
  // Local-midnight ticks with the weekday.
  let ticks = ''
  const firstDay = preds[0].t.slice(0, 10)
  const [y0, mo0, d0] = firstDay.split('-').map(Number)
  for (let k = 1; k <= 3; k++) {
    const day = new Date(Date.UTC(y0, mo0 - 1, d0 + k))
    const m = day.getTime() / 60000
    if (m <= t0 || m >= t1) continue
    const xx = x(m).toFixed(1)
    ticks += `<line x1="${xx}" x2="${xx}" y1="${TOP}" y2="${base}" class="bbm-w-tick"/>` +
      `<text x="${xx}" y="${H - 4}" class="bbm-w-day" text-anchor="middle">${day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</text>`
  }
  const ky = y(KING_TIDE_M).toFixed(1)
  const thr = `<line x1="${L}" x2="${W - R}" y1="${ky}" y2="${ky}" class="bbm-w-thr"/>` +
    `<text x="${W - R - 2}" y="${(+ky - 4).toFixed(1)}" class="bbm-w-thr-t" text-anchor="end">${THRESHOLDS[0].ft.toFixed(2)} ft king tide</text>`
  const highs = preds.filter((p) => p.type === 'H').map((p) =>
    `<circle cx="${x(wallMinutes(p.t)).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.5" class="${p.v >= KING_TIDE_M ? 'bbm-w-king' : 'bbm-w-hi'}"><title>${esc(fmtTime(p.t, true))} · ${ft2(p.v)} ft</title></circle>`).join('')
  const nm = wallMinutes(now)
  const nv = levelAt(preds, nm)
  const nowDot = nv == null ? '' :
    `<line x1="${x(nm).toFixed(1)}" x2="${x(nm).toFixed(1)}" y1="${TOP}" y2="${base}" class="bbm-w-nowline"/>` +
    `<circle cx="${x(nm).toFixed(1)}" cy="${y(nv).toFixed(1)}" r="9" class="bbm-w-halo"/>` +
    `<circle cx="${x(nm).toFixed(1)}" cy="${y(nv).toFixed(1)}" r="5" class="bbm-w-now"><title>Now · ${ft2(nv)} ft (predicted)</title></circle>`
  return `<svg class="bbm-wave" viewBox="0 0 ${W} ${H}" role="img" aria-label="48-hour tide prediction for Virginia Key, in feet">
    <defs><linearGradient id="bbm-wave-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="bbm-w-g0"/><stop offset="1" class="bbm-w-g1"/></linearGradient></defs>
    ${ticks}${thr}<path d="${area}" fill="url(#bbm-wave-g)"/><path d="${d}" class="bbm-w-line"/>${highs}${nowDot}
  </svg>`
}

export function renderTide(el: HTMLElement, res: { data: Tide; stale: boolean } | null, sourceEl?: HTMLElement) {
  const head = (extra = '') => `<div class="bbm-sec-h">${ms('waves')}<h3>Tide</h3><span class="bbm-sec-meta">Virginia Key</span>${extra}</div>`
  if (!res) {
    el.innerHTML = `${head()}<p class="bbm-muted">Tide data unavailable (no network and nothing cached).</p>`
    return
  }
  const { data, stale } = res
  const now = nowAtStation()
  const preds = data.predictions.map(toM).sort((a, b) => a.t.localeCompare(b.t))
  const next = preds.find((p) => p.type === 'H' && p.t > now) || null
  const laterKing = preds.find((p) => p.type === 'H' && p.t > now && p.v >= KING_TIDE_M && p !== next) || null
  const isKing = !!next && next.v >= KING_TIDE_M
  const latest = data.latest ? { t: data.latest.t, v: ftToM(data.latest.v) } : null
  const predNow = levelAt(preds, wallMinutes(now))
  const nowV = latest ? latest.v : predNow

  el.innerHTML = `
    ${head(`${isKing ? `<span class="bbm-badge bbm-badge-king" title="Next high at or above ${THRESHOLDS[0].ft.toFixed(2)} ft MLLW (demo heuristic)">${ms('warning')}King tide</span>` : ''}${stale ? `<span class="bbm-badge">${ms('history')}Cached</span>` : ''}`)}
    <div class="bbm-stats">
      <div class="bbm-stat"><div class="bbm-stat-k">Now</div>
        <div class="bbm-stat-v">${nowV != null ? `${ft2(nowV)}<small>ft</small>` : '—'}</div>
        <div class="bbm-stat-s">${latest ? `observed ${esc(fmtTime(latest.t, false))}` : predNow != null ? 'predicted' : 'no live reading'}</div></div>
      <div class="bbm-stat"><div class="bbm-stat-k">Next high</div>
        <div class="bbm-stat-v ${isKing ? 'is-king' : ''}">${next ? `${ft2(next.v)}<small>ft</small>` : '—'}</div>
        <div class="bbm-stat-s">${next ? esc(fmtTime(next.t, true)) : 'beyond 48 h window'}</div></div>
    </div>
    ${wave(preds, now)}
    ${!isKing && laterKing ? `<p class="bbm-note">${ms('warning')}<span>King-tide-level high ${esc(fmtTime(laterKing.t, true))} (${ft2(laterKing.v)} ft)</span></p>` : ''}
    `
  if (sourceEl) sourceEl.textContent = `Tide: ${data._source}, station ${data.station}. Levels in feet above mean lower low water (MLLW). King-tide line ${THRESHOLDS[0].ft.toFixed(2)} ft is a demo heuristic; NWS flood levels for this gauge: minor ${THRESHOLDS[1].ft.toFixed(2)} ft, moderate ${THRESHOLDS[2].ft.toFixed(2)} ft, major ${THRESHOLDS[3].ft.toFixed(2)} ft (NOAA CO-OPS).`
}
