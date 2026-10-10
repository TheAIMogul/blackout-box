// Prep ("Pack my box"): geolocation (fallback 25.77,-80.19) → GET /api/prep → IndexedDB → render.
// "Apple meets Airbnb": zone hero card + Pack my box pill, places and FEMA as iOS grouped lists. US units: mi, ft, °F.
import { API, getPrep, type Place, type PrepBundle } from './api'
import { CONTACTS, cl } from './contacts'
import { kvGet, kvSet } from './db'
import { emptyArt, iconHTML, onMedia } from './media'
import { getLang, onLang, t } from './i18n'
import { emit, esc, fmtF, fmtMi, fmtFt, fmtWhen, haptic, usText, on, state } from './util'

const FALLBACK = { lat: 25.77, lon: -80.19 }
let root: HTMLElement
let phase: 'idle' | 'locating' | 'loading' | 'done' | 'fail' | 'demo' = 'idle'
let locNote = ''

// ---------- shelters (same API + IndexedDB key as shelter.ts, so either tab warms the offline copy) ----------
type Shelter = { name: string; address?: string; lat: number; lon: number; open?: boolean; petFriendly?: boolean; specialNeeds?: boolean; distanceMi?: number }
type ShelterResp = { anyOpen?: boolean; shelters: Shelter[]; note?: string }
let shel: ShelterResp | null = null
let shelSaved = false
let shelLoading = false
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const dirUrl = (lat: number, lon: number) => isIOS() ? `https://maps.apple.com/?daddr=${lat},${lon}` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`

async function loadShelters(): Promise<void> {
  if (shelLoading) return
  shelLoading = true
  if (!shel) {
    const rec = await kvGet<ShelterResp>('shelters').catch(() => undefined)
    if (rec?.value?.shelters) { shel = rec.value; shelSaved = true; render() }
  }
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 15000)
    const r = await fetch(`${API}/shelters?lat=${state.lat}&lon=${state.lon}`, { signal: ctl.signal }).finally(() => clearTimeout(timer))
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const body = (await r.json()) as ShelterResp
    if (Array.isArray(body?.shelters)) { shel = body; shelSaved = false; void kvSet('shelters', body, 'GET /api/shelters') }
  } catch (e) { console.warn('prep shelters', e) }
  shelLoading = false
  render()
}

// v8: all Prep styles live in styles.css ("v8 Prep + Clocks").
function injectCss(): void { /* no-op: kept so mountPrep stays unchanged */ }

export async function loadPrepFromCache(): Promise<void> {
  const rec = await kvGet<PrepBundle>('prep')
  const prof = await kvGet<{ lat: number; lon: number }>('profile')
  if (prof?.value) { state.lat = prof.value.lat; state.lon = prof.value.lon }
  if (rec?.value) { state.prep = rec.value; state.prepAt = rec.fetchedAt; emit('prep') }
}

export function mountPrep(host: HTMLElement): void {
  root = host
  injectCss()
  render()
  void loadShelters()
  window.addEventListener('online', () => void loadShelters())
  // Refresh a saved box that predates the hospital/pharmacy data or is older than 6 h, while we have a connection.
  const stale = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const places = (state.prep?.places as any) || null
    const age = state.prepAt ? Date.now() - Date.parse(state.prepAt) : Infinity
    return !!state.prep && (!places || !('hospital' in places) || age > 6 * 3600_000)
  }
  if (navigator.onLine && stale()) void pack()
  window.addEventListener('online', () => { if (stale()) void pack() })
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
  void loadShelters()
}

// ---------- normalizers (server shapes vary: places is { power: [], library: [], fire: [], note }) ----------
type Group = { kind: string; items: Place[]; source?: string }

export function placeGroups(b: PrepBundle | null): Group[] {
  const p = b?.places as unknown
  if (!p) return []
  const kinds = ['hospital', 'pharmacy', 'library', 'fire', 'power', 'shelter']
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

const kindLabel = (k: string) => (k === 'hospital' ? t('place_hospital') : k === 'pharmacy' ? t('place_pharmacy') : k === 'power' ? t('place_power') : k === 'library' ? t('place_library') : k === 'fire' ? t('place_fire') : k)
const kindIcon = (k: string) => (k === 'hospital' ? 'local_hospital' : k === 'pharmacy' ? 'local_pharmacy' : k === 'power' ? 'ev_station' : k === 'library' ? 'local_library' : k === 'fire' ? 'fire_truck' : 'home')
const banner = (kind: '' | 'ok' | 'warn' | 'error', icon: string, html: string) => `<div class="banner ${kind}"><span class="ms" aria-hidden="true">${icon}</span><span>${html}</span></div>`

// ---------- render ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function llOf(p: any): { lat: number; lon: number } | null {
  const lat = Number(p?.lat ?? p?.latitude ?? p?.geometry?.coordinates?.[1])
  const lon = Number(p?.lon ?? p?.lng ?? p?.longitude ?? p?.geometry?.coordinates?.[0])
  return Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? { lat, lon } : null
}

const KIND_TINT: Record<string, string> = { hospital: 'var(--red)', pharmacy: 'var(--green)', library: 'var(--blue)', fire: 'var(--orange)', power: 'var(--purple)', shelter: 'var(--rausch)' }
const label = (txt: string, end = '') => `<div class="pv-label"><span>${esc(txt)}</span>${end ? `<span class="pv-label-end">${end}</span>` : ''}</div>`
const dirBtn = (lat: number, lon: number, name: string) =>
  `<a class="pv-dir" href="${esc(dirUrl(lat, lon))}" target="_blank" rel="noopener" aria-label="${esc(t('directions'))}: ${esc(name)}"><span class="ms fill" aria-hidden="true">directions</span></a>`
const skeleton = (n: number) => `<div class="pv-list" aria-hidden="true">${Array.from({ length: n }, () => `<div class="pv-row sk"><span class="pv-ic sk-b"></span><span class="pv-main"><span class="sk-b sk-l1"></span><span class="sk-b sk-l2"></span></span><span class="sk-b sk-end"></span></div>`).join('')}</div>`
const timeOf = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString({ en: 'en-US', es: 'es-US', ht: 'fr-HT' }[getLang()], { hour: 'numeric', minute: '2-digit' }) : ''
}

function shelterHtml(): string {
  const list = (shel?.shelters ?? []).slice(0, 5)
  const head = label(cl('shelters'), shelSaved ? esc(t('shelter_saved')) : '')
  if (!list.length) return head + (shelLoading ? skeleton(2) : `<div class="pv-empty-row"><span class="ms" aria-hidden="true">night_shelter</span>${esc(shel?.note || t('shelter_none'))}</div>`)
  return `${head}<div class="pv-list">${list.map((s) => `
    <div class="pv-row"><span class="pv-ic" style="--tint:var(--rausch)"><span class="ms fill" aria-hidden="true">night_shelter</span></span>
      <span class="pv-main"><span class="pv-t1">${esc(s.name)}</span>
        <span class="pv-t2"><span class="pv-pill ${s.open ? 'open' : 'closed'}">${esc(s.open ? t('shelter_open') : t('shelter_not_open'))}</span>${s.petFriendly ? `<span class="ms" title="${esc(t('shelter_pets'))}" aria-label="${esc(t('shelter_pets'))}">pets</span>` : ''}${s.specialNeeds ? `<span class="ms" title="${esc(t('shelter_special'))}" aria-label="${esc(t('shelter_special'))}">accessible</span>` : ''}</span></span>
      <span class="pv-mi">${typeof s.distanceMi === 'number' ? esc(fmtMi(s.distanceMi)) : ''}</span>${dirBtn(s.lat, s.lon, s.name)}</div>`).join('')}</div>
    ${shel?.note ? `<p class="pv-cap">${esc(shel.note)}</p>` : ''}`
}

function contactsHtml(): string {
  return `${label(cl('title'), esc(t('tap_to_call')))}
    <a class="pv-911" href="tel:911"><span class="pv-911-ic"><span class="ms fill" aria-hidden="true">emergency</span></span>
      <span class="pv-911-txt"><b>911</b><span>${esc(t('life_threat'))}</span></span><span class="ms fill" aria-hidden="true">call</span></a>
    <div class="pv-grid">${CONTACTS.map((c) => {
      const [big, alt] = c.number.split(' · ')
      return `<a class="pv-tile" href="tel:${esc(c.tel)}" title="${esc(c.for[getLang()] ?? c.for.en)}" aria-label="${esc(c.name)} ${esc(c.number)}">
        <span class="pv-tile-top"><span class="pv-ic sm"><span class="ms" aria-hidden="true">${esc(c.icon)}</span></span><span class="ms pv-call" aria-hidden="true">call</span></span>
        <span class="pv-tile-name">${esc(c.name)}</span>
        <span class="pv-tile-num">${esc(big)}</span>${alt ? `<span class="pv-tile-alt">${esc(alt)}</span>` : ''}</a>`
    }).join('')}</div>`
}

function sourcesHtml(b: PrepBundle | null, z: ReturnType<typeof zoneOf>, groups: Group[], placesNote?: string): string {
  const li = (k: string, v: string) => `<li><b>${esc(k)}</b><span>${v}</span></li>`
  const link = (u?: string, txt?: string) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(txt ?? u)}</a>` : '')
  const rows: string[] = []
  rows.push(li(t('zone'), `<span class="tnum">${esc(state.lat)}, ${esc(state.lon)}</span>${z.source ? ' · ' + esc(z.source) : ''}${state.prepAt ? ` · ${esc(t('checked'))} ${esc(fmtWhen(state.prepAt))}` : ''}`))
  if (b) {
    const ps = [...new Set(groups.map((g) => g.source).filter(Boolean))] as string[]
    rows.push(li(t('help_nearby'), esc(placesNote || t('places_note')) + (ps.length ? ' · ' + esc(ps.join(', ')) : '')))
    if (b.tide) rows.push(li(t('tide'), `${b.tide.latest ? `${esc(fmtWhen(String(b.tide.latest.t).replace(' ', 'T')))} · ${esc(fmtFt(b.tide.latest.v))} · ` : ''}MLLW${b.tide._source ? ' · ' + esc(b.tide._source) : ''}`))
    if (b.nws) rows.push(li(t('weather'), `${esc(b.nws.station ?? '')} ${esc(fmtWhen(b.nws.observedAt))}${b.nws._source ? ' · ' + esc(b.nws._source) : ''}`))
    rows.push(li(t('fema'), `${esc(t('fema_register'))} · ${esc(b.fema?._source ?? 'OpenFEMA')}`))
    if (b.statute?.url) rows.push(li(t('statute'), link(b.statute.url)))
    if (b.fdaEmergencyInsulin?.url) rows.push(li(t('insulin'), link(b.fdaEmergencyInsulin.url, 'fda.gov')))
    if (b.foodRules?.url) rows.push(li(t('food_rules'), link(b.foodRules.url, 'FoodSafety.gov')))
  }
  rows.push(li(cl('title'), `${esc(cl('note'))}<br>${CONTACTS.map((c) => `${esc(c.name)}: ${link(c.src, c.srcLabel)}`).join(' · ')}`))
  return `<details class="pv-src"><summary><span class="ms" aria-hidden="true">info</span>${esc(t('sources'))}<span class="ms pv-chev" aria-hidden="true">expand_more</span></summary><ul>${rows.join('')}</ul></details>`
}

function render(): void {
  if (!root) return
  const b = state.prep
  const busy = phase === 'locating' || phase === 'loading'
  const z = zoneOf(b)
  const groups = placeGroups(b)
  const fema = femaList(b)
  const hi = nextHigh(b)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placesNote = (b?.places as any)?.note as string | undefined
  // 5 places, mixed so it isn't all chargers in one garage: the 2 nearest charging sites, 2 libraries, 1 fire station.
  // Numbered/lettered chargers at one site ("ICON GARAGE 1…4", "OBE 500 BRICKELL R/L") count once.
  const CAP: Record<string, number> = { hospital: 2, pharmacy: 1, library: 1, fire: 1, power: 0 }
  const seenSite = new Set<string>()
  const taken: Record<string, number> = {}
  const rows = groups.flatMap((g) => g.items.map((p) => ({ g, p })))
    .sort((a, c) => (a.p.distanceMi ?? 1e9) - (c.p.distanceMi ?? 1e9))
    .filter(({ g, p }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const site = String((p as any).name ?? (p as any).address ?? '').toLowerCase().replace(/(\s+[a-z0-9]{1,2})+\s*$/, '').replace(/\s+/g, ' ').trim()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kind = String((g as any).kind ?? (g as any).key ?? '')
      if (site && seenSite.has(site)) return false
      if ((taken[kind] ?? 0) >= (CAP[kind] ?? 1)) return false
      if (site) seenSite.add(site)
      taken[kind] = (taken[kind] ?? 0) + 1
      return true
    })
    .slice(0, 5)

  const status =
    phase === 'locating' ? `<div class="progress"><i></i></div>${banner('', 'my_location', esc(t('prep_locating')))}` :
    phase === 'loading' ? `<div class="progress"><i></i></div>${banner('', 'cloud_download', esc(t('prep_loading')))}` :
    phase === 'fail' ? banner('error', 'error', esc(t('prep_fail'))) :
    phase === 'demo' ? banner('warn', 'science', esc(t('prep_demo'))) : ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canInstall = (window as any).bbCanInstall?.() === true
  const saved = !!b && !b._fallback
  const savedChip = saved
    ? `<span class="pv-chip ok${phase === 'done' ? ' pop' : ''}" ${phase === 'done' ? `role="status" title="${esc(t('prep_done'))}"` : ''}><span class="ms fill" aria-hidden="true">check_circle</span><span class="tnum">${esc(t('saved_dot', { t: timeOf(state.prepAt) }))}</span></span>`
    : b ? `<span class="pv-chip"><span class="ms" aria-hidden="true">science</span>${esc(t('sample_data'))}</span>` : ''
  const zoneTitle = !b ? t('prep_title') : z.letter ? `${t('zone')} ${z.letter}` : z.known ? t('zone_none') : t('zone_unknown')
  const zoneLine = !b ? t('prep_none') : z.letter ? t('zone_check_short') : ''

  root.innerHTML = `<div class="pv">
    <section class="pv-hero">
      <div class="pv-zone">
        <div class="pv-letter${z.letter ? '' : ' none'}" aria-label="${esc(t('zone'))} ${esc(z.letter ?? '')}">${z.letter ? esc(z.letter) : `<span class="ms" aria-hidden="true">${b ? 'location_off' : 'inventory_2'}</span>`}</div>
        <div class="pv-zone-txt">
          <div class="pv-eyebrow">${esc(t('zone'))}</div>
          <div class="pv-zt">${esc(zoneTitle)}</div>
          ${zoneLine ? `<div class="pv-zm">${esc(zoneLine)}</div>` : ''}
        </div>
      </div>
      <button type="button" class="btn primary block pv-go${saved ? ' is-saved' : ''}" id="prep-go" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner" aria-hidden="true"></span>' : `<span class="ms${saved ? ' fill' : ''}" aria-hidden="true">${saved ? 'download_done' : 'download'}</span>`}<span>${esc(t('prep_btn'))}</span></button>
      ${savedChip ? `<div class="pv-chips">${savedChip}</div>` : ''}
    </section>
    ${locNote || status ? `<div class="pv-status">${locNote ? banner('', 'info', esc(locNote)) : ''}${status}</div>` : ''}
    ${!b ? (busy ? `${label(t('help_nearby'))}${skeleton(4)}` : `<div class="pv-empty">${emptyArt('empty.prep') || iconHTML(['icon.bag'], 'inventory_2', 'mi pv-empty-ic')}<p>${esc(t('prep_none'))}</p></div>`) : `
    ${label(t('help_nearby'), esc(t('distance')))}
    ${rows.length ? `<div class="pv-list">${rows.map(({ g, p }) => {
      const ll = llOf(p)
      return `<div class="pv-row"><span class="pv-ic" style="--tint:${KIND_TINT[g.kind] ?? 'var(--grey)'}"><span class="ms fill" aria-hidden="true">${kindIcon(g.kind)}</span></span>
        <span class="pv-main"><span class="pv-t1">${esc(p.name)}</span><span class="pv-t2">${esc(kindLabel(g.kind))}${p.open24h ? ' · 24 h' : ''}</span></span>
        <span class="pv-mi">${p.distanceMi != null ? esc(fmtMi(p.distanceMi)) : ''}</span>${ll ? dirBtn(ll.lat, ll.lon, p.name) : '<span class="pv-dir-gap"></span>'}</div>`
    }).join('')}</div>` : (busy ? skeleton(3) : `<div class="pv-empty-row"><span class="ms" aria-hidden="true">location_searching</span>${esc(placesNote || t('places_note'))}</div>`)}`}
    ${shelterHtml()}
    ${contactsHtml()}
    ${!b ? '' : `
    ${label(t('tide_weather'))}
    <div class="pv-list">
      <div class="pv-row"><span class="pv-ic" style="--tint:var(--blue)"><span class="ms fill" aria-hidden="true">waves</span></span>
        <span class="pv-main"><span class="pv-t1">${esc(t('tide_next_high'))}</span><span class="pv-t2 tnum">${hi ? esc(hi.t.slice(5).replace(' ', ' · ')) + ' · MLLW' : esc(t('tide_none'))}</span></span>
        <span class="pv-big">${hi ? `${esc(fmtFt(hi.v).replace(' ft', ''))}<small>ft</small>` : ''}</span></div>
      <div class="pv-row"><span class="pv-ic" style="--tint:var(--orange)"><span class="ms fill" aria-hidden="true">thermostat</span></span>
        <span class="pv-main"><span class="pv-t1">${esc(t('weather'))}</span><span class="pv-t2 tnum">${b.nws?.heatIndexF != null ? `${esc(t('heat_index'))} ${esc(fmtF(b.nws.heatIndexF))}` : esc(b.nws?.station ?? '')}</span></span>
        <span class="pv-big">${b.nws?.tempF != null ? `${esc(fmtF(b.nws.tempF).replace(' °F', ''))}<small>°F</small>` : ''}</span></div>
    </div>

    ${label('FEMA')}
    ${fema.length ? `<div class="pv-list">${fema.slice(0, 3).map((d) => `<div class="pv-row"><span class="pv-ic" style="--tint:var(--grey)"><span class="ms" aria-hidden="true">assignment</span></span><span class="pv-main"><span class="pv-t1">${esc(d.title)}</span><span class="pv-t2 tnum">${esc(d.type)}-${esc(d.number)}</span></span><span class="pv-mi">${esc(d.date)}</span></div>`).join('')}</div>` : `<div class="pv-empty-row"><span class="ms" aria-hidden="true">assignment</span>${esc(t('fema'))}</div>`}

    ${label(t('know_rules'))}
    <div class="pv-list">
      <div class="pv-row top"><span class="pv-ic" style="--tint:var(--rausch)"><span class="ms fill" aria-hidden="true">medication</span></span><span class="pv-main"><span class="pv-t1">${esc(t('statute'))} <span class="pv-tag tnum">${esc(b.statute?.number ?? 'F.S. 252.358')}</span></span><span class="pv-t3">${esc(usText(b.statute?.summary ?? ''))}</span></span></div>
      <div class="pv-row top"><span class="pv-ic" style="--tint:var(--blue)"><span class="ms fill" aria-hidden="true">vaccines</span></span><span class="pv-main"><span class="pv-t1">${esc(t('insulin'))}</span><span class="pv-t3">${esc(usText(b.fdaEmergencyInsulin?.summary ?? ''))}</span></span></div>
      <div class="pv-row top"><span class="pv-ic" style="--tint:var(--green)"><span class="ms fill" aria-hidden="true">kitchen</span></span><span class="pv-main"><span class="pv-t1">${esc(t('food_rules'))}</span><span class="pv-t3">${esc(usText(b.foodRules?.headline ?? ''))}</span></span></div>
    </div>`}
    ${canInstall ? `<button type="button" class="pv-install" id="prep-install">
      <img src="/icons/apple-touch-icon-180.png" alt=""><span class="pv-main"><b>${esc(t('install_title'))}</b><span>${esc(t('install_why'))}</span></span><span class="ms chev" aria-hidden="true">chevron_right</span></button>` : ''}
    ${sourcesHtml(b, z, groups, placesNote)}
  </div>`

  root.querySelector('#prep-go')?.addEventListener('click', () => { haptic(); void pack() })
  root.querySelectorAll('a.pv-dir, a.pv-tile, a.pv-911').forEach((a) => a.addEventListener('click', () => haptic()))
  root.querySelector('#prep-install')?.addEventListener('click', () => window.dispatchEvent(new Event('bb-open-install')))
}
