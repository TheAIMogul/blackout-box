// "Closest shelter" card under the Now mini map: GET /api/shelters?lat&lon (open shelters first, then nearest).
// #1 big with an OPEN / Not open yet pill and a Directions button (Apple Maps on iOS, Google Maps elsewhere),
// the next two as compact rows, then the county note. The last response is kept in IndexedDB for offline.
import { API } from './api'
import { kvGet, kvSet } from './db'
import { onLang, t } from './i18n'
import { esc, haptic, state } from './util'

type Shelter = { name: string; address?: string; lat: number; lon: number; open?: boolean; petFriendly?: boolean; specialNeeds?: boolean; distanceMi?: number }
type ShelterResp = { anyOpen?: boolean; shelters: Shelter[]; note?: string; _source?: string }

let el: HTMLElement | null = null
let data: ShelterResp | null = null
let savedAt = ''
let loading = true
let inited = false

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const dirUrl = (s: Shelter) => isIOS() ? `https://maps.apple.com/?daddr=${s.lat},${s.lon}` : `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`
const mi = (s: Shelter) => (typeof s.distanceMi === 'number' ? `${s.distanceMi < 10 ? s.distanceMi.toFixed(1) : Math.round(s.distanceMi)} mi` : '')

export function paintShelter(host: HTMLElement): void {
  el = host
  render()
  if (inited) return
  inited = true
  onLang(render)
  void (async () => {
    const rec = await kvGet<ShelterResp>('shelters').catch(() => undefined)
    if (rec?.value?.shelters) { data = rec.value; savedAt = rec.fetchedAt; render() }
    await refresh()
  })()
  window.addEventListener('online', () => void refresh())
}

async function refresh(): Promise<void> {
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 15000)
    const r = await fetch(`${API}/shelters?lat=${state.lat}&lon=${state.lon}`, { signal: ctl.signal }).finally(() => clearTimeout(timer))
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const body = (await r.json()) as ShelterResp
    if (Array.isArray(body?.shelters)) {
      data = body; savedAt = ''
      void kvSet('shelters', body, 'GET /api/shelters')
    }
  } catch (e) { console.warn('shelters', e) }
  loading = false
  render()
}

function pill(s: Shelter): string {
  return s.open ? `<span class="sh-pill open"><span class="ms fill" aria-hidden="true">check_circle</span>${esc(t('shelter_open'))}</span>`
    : `<span class="sh-pill closed">${esc(t('shelter_not_open'))}</span>`
}

function render(): void {
  if (!el || !el.isConnected) return
  const list = data?.shelters ?? []
  if (!list.length) {
    el.innerHTML = loading ? '' : `<div class="card shelter-card"><div class="sh-k"><span class="ms fill" aria-hidden="true">night_shelter</span>${esc(t('shelter_title'))}</div><p class="sh-note">${esc(data?.note || t('shelter_none'))}</p></div>`
    return
  }
  const [top, ...rest] = list
  const tags = [top.petFriendly ? `<span class="sh-tag"><span class="ms" aria-hidden="true">pets</span>${esc(t('shelter_pets'))}</span>` : '', top.specialNeeds ? `<span class="sh-tag"><span class="ms" aria-hidden="true">accessible</span>${esc(t('shelter_special'))}</span>` : ''].join('')
  el.innerHTML = `<div class="card shelter-card">
    <div class="sh-k"><span class="ms fill" aria-hidden="true">night_shelter</span>${esc(t('shelter_title'))}${savedAt ? `<span class="sh-saved">${esc(t('shelter_saved'))}</span>` : ''}</div>
    <div class="sh-top">
      <div class="sh-main">
        <div class="sh-name">${esc(top.name)}</div>
        ${top.address ? `<div class="sh-addr">${esc(top.address)}</div>` : ''}
        <div class="sh-meta">${pill(top)}${mi(top) ? `<span class="sh-dist">${esc(mi(top))}</span>` : ''}${tags}</div>
      </div>
    </div>
    <a class="btn primary block sh-dir" href="${esc(dirUrl(top))}" target="_blank" rel="noopener"><span class="ms" aria-hidden="true">directions</span>${esc(t('directions'))}</a>
    ${rest.slice(0, 2).map((s) => `<a class="sh-row" href="${esc(dirUrl(s))}" target="_blank" rel="noopener">
      <div class="sh-rmain"><div class="sh-rname">${esc(s.name)}</div><div class="sh-rsub">${s.open ? `<b class="ok">${esc(t('shelter_open'))}</b>` : esc(t('shelter_not_open'))}${s.address ? ` · ${esc(s.address)}` : ''}</div></div>
      <span class="sh-rdist">${esc(mi(s))}</span><span class="ms" aria-hidden="true">chevron_right</span></a>`).join('')}
    ${data?.note ? `<p class="sh-note">${esc(data.note)}</p>` : ''}
  </div>`
  el.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => haptic()))
}
