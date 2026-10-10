// Prep ("Pack my box"): geolocation (fallback 25.77,-80.19) → GET /api/prep → IndexedDB → render.
// "Apple meets Airbnb": zone hero card + Pack my box pill, places and FEMA as iOS grouped lists. US units: mi, ft, °F.
import { getPrep, type Place, type PrepBundle } from './api'
import { kvGet, kvSet } from './db'
import { onMedia } from './media'
import { onLang, t } from './i18n'
import { emit, esc, fmtF, fmtMi, fmtFt, fmtWhen, haptic, usText, on, state } from './util'

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
  window.addEventListener('bb-installable', render)
  onMedia(render)
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
    .sort((a, c) => (a.p.distanceMi ?? 1e9) - (c.p.distanceMi ?? 1e9))

  const status =
    phase === 'locating' ? `<div class="progress"><i></i></div>${banner('', 'my_location', esc(t('prep_locating')))}` :
    phase === 'loading' ? `<div class="progress"><i></i></div>${banner('', 'cloud_download', esc(t('prep_loading')))}` :
    phase === 'done' ? banner('ok', 'check_circle', `<b>${esc(t('prep_done'))}</b>`) :
    phase === 'fail' ? banner('error', 'error', esc(t('prep_fail'))) :
    phase === 'demo' ? banner('warn', 'warning', esc(t('prep_demo'))) : ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canInstall = (window as any).bbCanInstall?.() === true

  root.innerHTML = `
    <div class="card hero">
      <div class="zone-hero">
        <div class="zone-letter${z.letter ? '' : ' none'}" aria-label="${esc(t('zone'))} ${esc(z.letter ?? '—')}">${esc(z.letter ?? '—')}</div>
        <div style="min-width:0;flex:1">
          <div class="what">${!b ? esc(t('prep_title')) : z.letter ? `${esc(t('zone'))} ${esc(z.letter)}` : esc(z.known ? t('zone_none') : t('zone_unknown'))}</div>
          <div class="why">${!b ? esc(t('prep_none')) : z.letter ? esc(t('zone_check')) : ''}</div>
        </div>
      </div>
      <button type="button" class="btn primary block" id="prep-go" style="margin-top:16px" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner" aria-hidden="true"></span>' : '<span class="ms" aria-hidden="true">download</span>'}${esc(t('prep_btn'))}</button>
      <div class="src-line">${b && !b._fallback ? `${esc(t('prep_cached'))} · ${esc(stamp)} · ` : ''}<span class="tnum">${esc(state.lat)}, ${esc(state.lon)}</span>${z.source ? ' · ' + esc(z.source) : ''}</div>
    </div>
    <div style="margin-top:12px">${locNote ? banner('', 'info', esc(locNote)) : ''}${status}</div>
    ${!b ? '' : `
    <div class="section-h"><h2>${esc(t('places'))}</h2><span class="muted">${esc(t('distance'))}</span></div>
    ${rows.length ? `<div class="list">${rows.map(({ g, p }) => `
      <div class="row"><span class="ico"><span class="ms" aria-hidden="true">${kindIcon(g.kind)}</span></span>
        <span class="main"><span class="t1">${esc(p.name)}</span><span class="t2" style="display:block">${esc(kindLabel(g.kind))}${p.open24h ? ' · 24 h' : ''}${p.address ? ' · ' + esc(p.address) : ''}</span></span>
        <span class="end">${p.distanceMi != null ? esc(fmtMi(p.distanceMi)) : '—'}</span></div>`).join('')}</div>` : `<div class="empty">—</div>`}
    <p class="src-line">${esc(placesNote || t('places_note'))}${groups.map((g) => g.source).filter(Boolean).length ? ' · ' + esc([...new Set(groups.map((g) => g.source).filter(Boolean))].join(', ')) : ''}</p>

    <div class="grid2" style="margin-top:18px">
      <div class="card">
        <h3><span class="ms" aria-hidden="true">waves</span>${esc(t('tide'))}</h3>
        ${hi ? `<div class="muted small">${esc(t('tide_next_high'))}</div><div class="stat">${esc(fmtFt(hi.v).replace(' ft', ''))}<small> ft</small></div><div class="small muted tnum">${esc(hi.t)} · MLLW</div>` : `<p class="muted">${esc(t('tide_none'))}</p>`}
        ${b.tide?.latest ? `<div class="src-line">${esc(fmtWhen(String(b.tide.latest.t).replace(' ', 'T')))} · ${esc(fmtFt(b.tide.latest.v))}${b.tide._source ? ' · ' + esc(b.tide._source) : ''}</div>` : ''}
      </div>
      <div class="card">
        <h3><span class="ms" aria-hidden="true">thermostat</span>${esc(t('weather'))}</h3>
        ${b.nws?.tempF != null ? `<div class="stat">${esc(fmtF(b.nws.tempF).replace(' °F', ''))}<small> °F</small></div>${b.nws.heatIndexF != null ? `<div class="small muted">${esc(t('heat_index'))} ${esc(fmtF(b.nws.heatIndexF))}</div>` : ''}<div class="src-line">${esc(b.nws.station ?? '')} ${esc(fmtWhen(b.nws.observedAt))}${b.nws._source ? ' · ' + esc(b.nws._source) : ''}</div>` : '<p class="muted">—</p>'}
      </div>
    </div>

    <div class="section-h"><h2>${esc(t('fema'))}</h2></div>
    ${fema.length ? `<div class="list">${fema.slice(0, 5).map((d) => `<div class="row"><span class="ico"><span class="ms" aria-hidden="true">assignment</span></span><span class="main"><span class="t1">${esc(d.title)}</span><span class="t2" style="display:block">${esc(d.type)}-${esc(d.number)}</span></span><span class="end tnum" style="font-weight:500;color:var(--text-2)">${esc(d.date)}</span></div>`).join('')}</div>` : '<div class="empty">—</div>'}
    <p class="src-line">${esc(t('fema_register'))} · ${esc(b.fema?._source ?? 'OpenFEMA')}</p>

    <div class="grid2" style="margin-top:18px">
      <div class="card">
        <h3><span class="ms" aria-hidden="true">medication</span>${esc(t('statute'))}</h3>
        <div class="small tnum" style="color:var(--rausch);font-weight:700">${esc(b.statute?.number ?? 'F.S. 252.358')}</div>
        <p style="margin-top:6px">${esc(usText(b.statute?.summary ?? '—'))}</p>
        ${b.statute?.url ? `<div class="src-line"><a href="${esc(b.statute.url)}" target="_blank" rel="noopener">${esc(b.statute.url)}</a></div>` : ''}
      </div>
      <div class="card">
        <h3><span class="ms" aria-hidden="true">vaccines</span>${esc(t('insulin'))}</h3>
        <p>${esc(usText(b.fdaEmergencyInsulin?.summary ?? '—'))}</p>
        ${b.fdaEmergencyInsulin?.url ? `<div class="src-line"><a href="${esc(b.fdaEmergencyInsulin.url)}" target="_blank" rel="noopener">fda.gov</a></div>` : ''}
      </div>
      <div class="card">
        <h3><span class="ms" aria-hidden="true">kitchen</span>${esc(t('food_rules'))}</h3>
        <p>${esc(usText(b.foodRules?.headline ?? '—'))}</p>
        ${b.foodRules?.url ? `<div class="src-line"><a href="${esc(b.foodRules.url)}" target="_blank" rel="noopener">FoodSafety.gov</a></div>` : ''}
      </div>
    </div>`}
    ${canInstall ? `<button type="button" class="card install-card" id="prep-install" style="width:100%;margin-top:18px;border:0;text-align:left;font:inherit;color:inherit;cursor:pointer">
      <img src="/icons/apple-touch-icon-180.png" alt=""><span style="flex:1;min-width:0"><b style="display:block;font-size:17px">${esc(t('install_title'))}</b><span class="muted small">${esc(t('install_why'))}</span></span><span class="ms chev" aria-hidden="true">chevron_right</span></button>` : ''}`

  root.querySelector('#prep-go')?.addEventListener('click', () => { haptic(); void pack() })
  root.querySelector('#prep-install')?.addEventListener('click', () => window.dispatchEvent(new Event('bb-open-install')))
}
