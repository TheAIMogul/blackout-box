// Prep ("Pack my box"): geolocation (fallback 25.77,-80.19) → GET /api/prep → IndexedDB → render.
// Console style: page header + primary action, notices as banners, places and FEMA as console tables.
import { getPrep, type Place, type PrepBundle } from './api'
import { kvGet, kvSet } from './db'
import { onLang, t } from './i18n'
import { emit, esc, fmtWhen, on, state } from './util'

const FALLBACK = { lat: 25.77, lon: -80.19 }
let root: HTMLElement
let phase: 'idle' | 'locating' | 'loading' | 'done' | 'fail' | 'demo' = 'idle'
let locNote = ''

export async function loadPrepFromCache(): Promise<void> {
  const rec = await kvGet<PrepBundle>('prep')
  const prof = await kvGet<{ lat: number; lon: number }>('profile')
  if (prof?.value) { state.lat = prof.value.lat; state.lon = prof.value.lon }
  if (rec?.value) { state.prep = rec.value; state.prepAt = rec.fetchedAt; emit('prep') }
}

export function mountPrep(host: HTMLElement): void {
  root = host
  render()
  onLang(render)
  on('prep', render)
}

function locate(): Promise<{ lat: number; lon: number; fallback: boolean }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ ...FALLBACK, fallback: true })
    let done = false
    const finish = (v: { lat: number; lon: number; fallback: boolean }) => { if (!done) { done = true; resolve(v) } }
    setTimeout(() => finish({ ...FALLBACK, fallback: true }), 8000)
    navigator.geolocation.getCurrentPosition(
      (p) => finish({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5), fallback: false }),
      () => finish({ ...FALLBACK, fallback: true }),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 10 * 60 * 1000 },
    )
  })
}

async function pack(): Promise<void> {
  phase = 'locating'; locNote = ''; render()
  const loc = await locate()
  if (loc.fallback) locNote = t('prep_fallback_loc')
  state.lat = loc.lat; state.lon = loc.lon
  void kvSet('profile', { lat: loc.lat, lon: loc.lon }, loc.fallback ? 'fallback' : 'geolocation')
  phase = 'loading'; render()
  const b = await getPrep(loc.lat, loc.lon)
  if (b._fallback) {
    // never overwrite a real saved box with sample data
    if (state.prep && !state.prep._fallback) phase = 'fail'
    else { state.prep = b; state.prepAt = b.generatedAt ?? new Date().toISOString(); phase = 'demo'; emit('prep') }
  } else {
    await kvSet('prep', b, 'GET /api/prep')
    state.prep = b; state.prepAt = new Date().toISOString(); phase = 'done'
    emit('prep')
  }
  render()
}

// ---------- normalizers (server shapes vary: places is { power: [], library: [], fire: [], note }) ----------
type Group = { kind: string; items: Place[]; source?: string }

export function placeGroups(b: PrepBundle | null): Group[] {
  const p = b?.places as unknown
  if (!p) return []
  const kinds = ['power', 'library', 'fire', 'shelter']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asList = (v: any): Place[] => (Array.isArray(v) ? v : Array.isArray(v?.features) ? v.features : [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((f: any) => (f?.properties ? { ...f.properties, ...f } : f))
    .filter((f: Place) => f && f.name)
  if (Array.isArray(p)) {
    return kinds.map((k) => ({ kind: k, items: (p as Place[]).filter((x) => (x.kind ?? '').includes(k)) })).filter((g) => g.items.length)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = p as Record<string, any>
  return kinds.filter((k) => k in o).map((k) => ({ kind: k, items: asList(o[k]), source: o[k]?._source ?? o._source }))
}

export function zoneOf(b: PrepBundle | null): { letter: string | null; known: boolean; category?: number | null; source?: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const z = b?.zone as any
  if (!z) return { letter: null, known: false }
  const letter = z.zone ?? z.zoneId ?? z.ZONEID ?? null
  return { letter: letter ? String(letter) : null, known: true, category: z.category ?? z.CATEGORY, source: z._source }
}

export function femaList(b: PrepBundle | null): { number: string; title: string; date: string; type: string }[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = b?.fema as any
  const arr = Array.isArray(f) ? f : Array.isArray(f?.declarations) ? f.declarations : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return arr.map((d: any) => ({
    number: String(d.number ?? d.disasterNumber ?? ''),
    title: String(d.title ?? d.declarationTitle ?? ''),
    date: String(d.date ?? d.declarationDate ?? '').slice(0, 10),
    type: String(d.type ?? d.declarationType ?? ''),
  }))
}

function nextHigh(b: PrepBundle | null): { t: string; v: string } | null {
  const preds = b?.tide?.predictions ?? []
  const now = Date.now()
  for (const p of preds) {
    if (String(p.type).toUpperCase().startsWith('H')) {
      const ms = Date.parse(String(p.t).replace(' ', 'T'))
      if (!Number.isFinite(ms) || ms > now) return { t: String(p.t), v: String(p.v) }
    }
  }
  return null
}

const kindLabel = (k: string) => (k === 'power' ? t('place_power') : k === 'library' ? t('place_library') : k === 'fire' ? t('place_fire') : k)
const kindIcon = (k: string) => (k === 'power' ? 'ev_station' : k === 'library' ? 'local_library' : k === 'fire' ? 'fire_truck' : 'home')
const banner = (kind: '' | 'ok' | 'warn' | 'error', icon: string, html: string) => `<div class="banner ${kind}"><span class="ms" aria-hidden="true">${icon}</span><span>${html}</span></div>`

// ---------- render ----------
function render(): void {
  if (!root) return
  const b = state.prep
  const busy = phase === 'locating' || phase === 'loading'
  const z = zoneOf(b)
  const groups = placeGroups(b)
  const fema = femaList(b)
  const hi = nextHigh(b)
  const stamp = state.prepAt ? `${t('checked')} ${fmtWhen(state.prepAt)}` : ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placesNote = (b?.places as any)?.note as string | undefined
  const rows = groups.flatMap((g) => g.items.slice(0, 5).map((p) => ({ g, p })))

  const status =
    phase === 'locating' ? `<div class="progress"><i></i></div>${banner('', 'my_location', esc(t('prep_locating')))}` :
    phase === 'loading' ? `<div class="progress"><i></i></div>${banner('', 'cloud_download', esc(t('prep_loading')))}` :
    phase === 'done' ? banner('ok', 'check_circle', `<b>${esc(t('prep_done'))}</b>`) :
    phase === 'fail' ? banner('error', 'error', esc(t('prep_fail'))) :
    phase === 'demo' ? banner('warn', 'warning', esc(t('prep_demo'))) : ''

  root.innerHTML = `
    <div class="page-head">
      <h1>${esc(t('prep_title'))}</h1>
      <div class="actions"><button type="button" class="btn primary" id="prep-go" ${busy ? 'disabled' : ''}><span class="ms" aria-hidden="true">download</span>${esc(t('prep_btn'))}</button></div>
    </div>
    <p class="page-sub">${esc(t('prep_sub'))}${b && !b._fallback ? ` · ${esc(t('prep_cached'))}, ${esc(stamp)}` : ''}</p>
    ${locNote ? banner('', 'info', esc(locNote)) : ''}
    ${status}
    ${!b ? `<div class="empty"><span class="ms" aria-hidden="true">inventory_2</span>${esc(t('prep_none'))}</div>` : `
    <div class="grid">
      <div class="card">
        <h2><span class="ms" aria-hidden="true">flood</span>${esc(t('zone'))}</h2>
        <div class="zone">
          <div class="zone-letter${z.letter ? '' : ' none'}" aria-label="${esc(t('zone'))} ${esc(z.letter ?? '—')}">${esc(z.letter ?? '—')}</div>
          <div style="min-width:0;flex:1">
            <div class="what">${z.letter ? `${esc(t('zone'))} ${esc(z.letter)}` : esc(z.known ? t('zone_none') : t('zone_unknown'))}</div>
            ${z.letter ? `<div>${esc(t('zone_check'))}</div>` : ''}
            <div class="src-line"><span class="mono">${esc(state.lat)}, ${esc(state.lon)}</span>${z.source ? ' · ' + esc(z.source) : ''}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2><span class="ms" aria-hidden="true">bolt</span>${esc(t('places'))}</h2>
        ${banner('', 'info', esc(placesNote || t('places_note')))}
        ${rows.length ? `<div class="table-wrap"><table>
          <thead><tr><th>${esc(t('place_name'))}</th><th>${esc(t('place_type'))}</th><th>${esc(t('distance'))}</th></tr></thead>
          <tbody>${rows.map(({ g, p }) => `<tr><td><b style="font-weight:500">${esc(p.name)}</b>${p.address ? `<div class="small muted">${esc(p.address)}</div>` : ''}</td><td><span class="trow" style="flex-wrap:nowrap;gap:6px"><span class="ms" aria-hidden="true" style="color:var(--text-2)">${kindIcon(g.kind)}</span>${esc(kindLabel(g.kind))}${p.open24h ? ' · 24 h' : ''}</span></td><td class="num">${p.distanceMi != null ? `${Number(p.distanceMi).toFixed(2)} ${esc(t('mi'))}` : '—'}</td></tr>`).join('')}</tbody>
        </table></div>` : `<div class="muted">—</div>`}
        <div class="src-line">${esc(stamp)}${groups.map((g) => g.source).filter(Boolean).length ? ' · ' + esc([...new Set(groups.map((g) => g.source).filter(Boolean))].join(', ')) : ''}</div>
      </div>

      <div class="grid two">
        <div class="card">
          <h2><span class="ms" aria-hidden="true">assignment</span>${esc(t('fema'))}</h2>
          ${fema.length ? `<div class="table-wrap"><table>
            <thead><tr><th>ID</th><th>${esc(t('fema_title'))}</th><th>${esc(t('fema_date'))}</th></tr></thead>
            <tbody>${fema.slice(0, 5).map((d) => `<tr><td class="num">${esc(d.type)}-${esc(d.number)}</td><td>${esc(d.title)}</td><td class="num">${esc(d.date)}</td></tr>`).join('')}</tbody>
          </table></div>` : '<div class="muted">—</div>'}
          <p style="margin:12px 0 0">${esc(t('fema_register'))}</p>
          <div class="src-line">${esc(b.fema?._source ?? 'OpenFEMA')}</div>
        </div>
        <div class="card">
          <h2><span class="ms" aria-hidden="true">waves</span>${esc(t('tide'))}</h2>
          ${hi ? `<div class="zone"><div><div class="small muted">${esc(t('tide_next_high'))}</div><div style="font:400 32px/1.2 var(--head)">${esc(hi.v)} ft</div><div class="mono small">${esc(hi.t)} · MLLW</div></div></div>` : `<div class="muted">${esc(t('tide_none'))}</div>`}
          ${b.tide?.latest ? `<div class="src-line">latest ${esc(b.tide.latest.t)} · ${esc(b.tide.latest.v)} ft${b.tide._source ? ' · ' + esc(b.tide._source) : ''}</div>` : ''}
          ${b.nws?.tempF != null ? `<h3 style="margin-top:16px">${esc(t('weather'))}</h3><div><span style="font:400 24px var(--head)">${esc(Math.round(b.nws.tempF))}°F</span>${b.nws.heatIndexF != null ? ` · ${esc(t('heat_index'))} ${esc(Math.round(b.nws.heatIndexF))}°F` : ''}</div><div class="src-line">${esc(b.nws.station ?? '')} ${esc(fmtWhen(b.nws.observedAt))}${b.nws._source ? ' · ' + esc(b.nws._source) : ''}</div>` : ''}
        </div>
        <div class="card">
          <h2><span class="ms" aria-hidden="true">medication</span>${esc(t('statute'))}</h2>
          <div class="mono small" style="color:var(--blue)">${esc(b.statute?.number ?? 'F.S. 252.358')}</div>
          <p style="margin:6px 0 0">${esc(b.statute?.summary ?? '—')}</p>
          ${b.statute?.url ? `<div class="src-line"><a href="${esc(b.statute.url)}" target="_blank" rel="noopener">${esc(b.statute.url)}</a></div>` : ''}
        </div>
        <div class="card">
          <h2><span class="ms" aria-hidden="true">vaccines</span>${esc(t('insulin'))}</h2>
          <p style="margin:0">${esc(b.fdaEmergencyInsulin?.summary ?? '—')}</p>
          ${b.fdaEmergencyInsulin?.url ? `<div class="src-line"><a href="${esc(b.fdaEmergencyInsulin.url)}" target="_blank" rel="noopener">fda.gov</a></div>` : ''}
        </div>
        <div class="card">
          <h2><span class="ms" aria-hidden="true">kitchen</span>${esc(t('food_rules'))}</h2>
          <p style="margin:0">${esc(b.foodRules?.headline ?? '—')}</p>
          ${b.foodRules?.url ? `<div class="src-line"><a href="${esc(b.foodRules.url)}" target="_blank" rel="noopener">FoodSafety.gov</a></div>` : ''}
        </div>
      </div>
    </div>`}`

  root.querySelector('#prep-go')?.addEventListener('click', () => void pack())
}
