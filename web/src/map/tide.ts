import type { Tide, TidePoint } from './data'

// King-tide badge threshold. DEMO HEURISTIC, not an official number: 2.9 ft MLLW is ~0.65 ft above
// MHHW (2.25 ft MLLW) at Virginia Key. NOAA's own flood thresholds for this gauge (CO-OPS metadata API,
// /mdapi/prod/webapi/stations/8723214/floodlevels.json + datums.json, read 2026-10-10) are
// NWS minor 13.66 ft STND = 3.53 ft MLLW and NOS minor 14.07 ft STND = 3.94 ft MLLW (MLLW = 10.13 ft STND).
export const KING_TIDE_FT = 2.9
export const NWS_MINOR_FLOOD_FT = 3.53

/** Current wall-clock time at the station, as "YYYY-MM-DD HH:MM" (same format NOAA returns for lst_ldt). */
function nowAtStation(): string {
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

function fmtTime(t: string, withDay: boolean): string {
  const [d, hm] = t.split(' ')
  const [h, mi] = (hm || '00:00').split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const time = `${h12}:${String(mi).padStart(2, '0')} ${ap}`
  if (!withDay) return time
  const [y, mo, da] = d.split('-').map(Number)
  const day = new Date(Date.UTC(y, mo - 1, da)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  return `${day} ${time}`
}

const ms = (name: string) => `<span class="bbm-ms material-symbols-outlined" aria-hidden="true">${name}</span>`
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** Smooth tide curve through the hi/lo extremes (cosine interpolation), drawn as an inline SVG. */
function sparkline(preds: TidePoint[], now: string): string {
  const W = 268, H = 64, PAD = 4
  if (preds.length < 2) return ''
  const t0 = wallMinutes(preds[0].t), t1 = wallMinutes(preds[preds.length - 1].t)
  const vs = preds.map((p) => p.v)
  const vmin = Math.min(0, ...vs), vmax = Math.max(KING_TIDE_FT + 0.2, ...vs)
  const x = (m: number) => PAD + ((m - t0) / (t1 - t0 || 1)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - ((v - vmin) / (vmax - vmin || 1)) * (H - PAD * 2)
  let d = ''
  for (let i = 0; i < preds.length - 1; i++) {
    const a = preds[i], b = preds[i + 1]
    const ma = wallMinutes(a.t), mb = wallMinutes(b.t)
    for (let s = 0; s <= 12; s++) {
      const f = s / 12
      const v = a.v + (b.v - a.v) * (1 - Math.cos(Math.PI * f)) / 2
      d += `${i === 0 && s === 0 ? 'M' : 'L'}${x(ma + (mb - ma) * f).toFixed(1)},${y(v).toFixed(1)}`
    }
  }
  const nm = wallMinutes(now)
  const nowLine = nm >= t0 && nm <= t1
    ? `<line x1="${x(nm).toFixed(1)}" x2="${x(nm).toFixed(1)}" y1="2" y2="${H - 2}" class="bbm-spark-now"/>` : ''
  const highs = preds.filter((p) => p.type === 'H').map((p) =>
    `<circle cx="${x(wallMinutes(p.t)).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.6" class="${p.v >= KING_TIDE_FT ? 'bbm-spark-king' : 'bbm-spark-hi'}"><title>${esc(fmtTime(p.t, true))} · ${p.v.toFixed(2)} ft</title></circle>`).join('')
  const ky = y(KING_TIDE_FT).toFixed(1)
  return `<svg class="bbm-spark" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" role="img" aria-label="48-hour tide prediction, high and low tides">
    <line x1="0" x2="${W}" y1="${ky}" y2="${ky}" class="bbm-spark-thr"/>
    <path d="${d}" class="bbm-spark-line"/>${nowLine}${highs}
  </svg>`
}

export function renderTide(el: HTMLElement, res: { data: Tide; stale: boolean } | null) {
  if (!res) {
    el.innerHTML = `<div class="bbm-card-h">${ms('waves')}<span>Tide · Virginia Key</span></div><p class="bbm-muted">Tide data unavailable (no network and nothing cached).</p>`
    return
  }
  const { data, stale } = res
  const now = nowAtStation()
  const preds = [...data.predictions].sort((a, b) => a.t.localeCompare(b.t))
  const nextHigh = preds.find((p) => p.type === 'H' && p.t > now) || null
  const laterKing = preds.find((p) => p.type === 'H' && p.t > now && p.v >= KING_TIDE_FT && p !== nextHigh) || null
  const isKing = !!nextHigh && nextHigh.v >= KING_TIDE_FT
  const latest = data.latest

  el.innerHTML = `
    <div class="bbm-card-h">
      ${ms('waves')}<span>Tide · Virginia Key</span>
      ${isKing ? `<span class="bbm-badge bbm-badge-king" title="Next high ≥ ${KING_TIDE_FT} ft MLLW (demo heuristic)">${ms('warning')}King tide</span>` : ''}
      ${stale ? `<span class="bbm-badge bbm-badge-stale">${ms('history')}Cached</span>` : ''}
    </div>
    <div class="bbm-tide-grid">
      <div><div class="bbm-k">Observed now</div><div class="bbm-v">${latest ? `${latest.v.toFixed(2)}<small> ft</small>` : '—'}</div>
        <div class="bbm-sub">${latest ? `${esc(fmtTime(latest.t, false))} · MLLW` : 'no live reading'}</div></div>
      <div><div class="bbm-k">Next high</div><div class="bbm-v ${isKing ? 'is-king' : ''}">${nextHigh ? `${nextHigh.v.toFixed(2)}<small> ft</small>` : '—'}</div>
        <div class="bbm-sub">${nextHigh ? esc(fmtTime(nextHigh.t, true)) : 'beyond 48 h window'}</div></div>
    </div>
    ${sparkline(preds, now)}
    <div class="bbm-spark-legend"><span><i class="bbm-dash"></i>${KING_TIDE_FT} ft king-tide line</span><span><i class="bbm-nowtick"></i>now</span></div>
    ${!isKing && laterKing ? `<p class="bbm-note bbm-note-warn">${ms('warning')}<span>King-tide-level high ${esc(fmtTime(laterKing.t, true))} (${laterKing.v.toFixed(2)} ft)</span></p>` : ''}
    <p class="bbm-fine">Badge at ≥ ${KING_TIDE_FT} ft MLLW is a demo heuristic. NOAA's minor-flood level for this gauge is ${NWS_MINOR_FLOOD_FT} ft MLLW (NWS). Source: ${esc(data._source)}, station ${esc(data.station)}.</p>`
}
