// App bar (console style): menu button, product name, location/zone picker chip, online/offline status chip
// (navigator.onLine + online/offline events + /api/health every 10 s), model chip, en/es/ht language menu.
import { getHealth } from './api'
import { LANGS, getLang, onLang, setLang, t, type Lang } from './i18n'
import { zoneOf } from './prep'
import { emit, esc, friendlyModel, on, state } from './util'

const POLL_MS = 10_000
let host: HTMLElement
let onMenu: () => void
let onPicker: () => void
let menuOpen = false

export function mountStatus(el: HTMLElement, toggleDrawer: () => void, openPrep: () => void): void {
  host = el; onMenu = toggleDrawer; onPicker = openPrep
  render()
  onLang(render)
  on('health', paint)
  on('prep', paintPicker)
  window.addEventListener('online', poll)
  window.addEventListener('offline', () => { paint(); void poll() })
  document.addEventListener('click', (e) => {
    if (menuOpen && !(e.target as HTMLElement).closest('.lang')) { menuOpen = false; renderMenu() }
  })
  void poll()
  setInterval(poll, POLL_MS)
}

function render(): void {
  host.innerHTML = `
    <button type="button" class="icon-btn" id="ab-menu" aria-label="${esc(t('nav_menu'))}"><span class="ms" aria-hidden="true">menu</span></button>
    <div class="product"><span class="logo" aria-hidden="true"><span class="ms">bolt</span></span>Blackout Box</div>
    <button type="button" class="picker" id="ab-picker" title="${esc(t('tab_prep'))}"><span class="ms" aria-hidden="true">location_on</span><span class="txt" id="ab-picker-txt"></span><span class="ms" aria-hidden="true">arrow_drop_down</span></button>
    <div class="grow"></div>
    <span class="schip" id="net-chip" role="status" aria-live="polite"><span class="ms" aria-hidden="true" id="net-icon">sync</span><span id="net-short">${esc(t('st_checking'))}</span><span class="long" id="net-long"></span></span>
    <span class="schip model" id="model-chip"><span class="ms" aria-hidden="true">smart_toy</span><span id="model-txt">—</span></span>
    <div class="lang">
      <button type="button" class="lang-btn" id="ab-lang" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t('lang_label'))}"><span class="ms" aria-hidden="true">translate</span><span id="ab-lang-code">${getLang().toUpperCase()}</span><span class="ms" aria-hidden="true">arrow_drop_down</span></button>
      <div class="menu hidden" role="menu" id="ab-lang-menu"></div>
    </div>`
  host.querySelector('#ab-menu')!.addEventListener('click', () => onMenu())
  host.querySelector('#ab-picker')!.addEventListener('click', () => onPicker())
  host.querySelector('#ab-lang')!.addEventListener('click', (e) => { e.stopPropagation(); menuOpen = !menuOpen; renderMenu() })
  renderMenu()
  paint()
  paintPicker()
}

const LANG_NAMES: Record<Lang, string> = { en: 'English', es: 'Español', ht: 'Kreyòl ayisyen' }

function renderMenu(): void {
  const m = host.querySelector<HTMLElement>('#ab-lang-menu')
  const btn = host.querySelector<HTMLElement>('#ab-lang')
  if (!m || !btn) return
  m.classList.toggle('hidden', !menuOpen)
  btn.setAttribute('aria-expanded', String(menuOpen))
  m.innerHTML = LANGS.map((l) => `<button type="button" role="menuitemradio" aria-checked="${l === getLang()}" data-lang="${l}"><span class="ms" aria-hidden="true">${l === getLang() ? 'check' : ''}</span>${esc(LANG_NAMES[l])}</button>`).join('')
  m.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { menuOpen = false; setLang(b.dataset.lang as Lang) }))
}

function paintPicker(): void {
  const el = host?.querySelector('#ab-picker-txt')
  if (!el) return
  const z = zoneOf(state.prep)
  const where = `${state.lat.toFixed(2)}, ${state.lon.toFixed(2)}`
  el.textContent = state.prep ? `${z.letter ? `${t('zone')} ${z.letter}` : t('zone_none')} · ${where}` : `${t('picker_none')} · ${where}`
}

let inflight = false
async function poll(): Promise<void> {
  if (inflight) return
  inflight = true
  try {
    state.health = await getHealth()
  } finally {
    inflight = false
  }
  emit('health') // repaints via on('health', paint)
}

function paint(): void {
  const chip = host?.querySelector<HTMLElement>('#net-chip')
  if (!chip) return
  const icon = chip.querySelector('#net-icon')!
  const short = chip.querySelector('#net-short')!
  const long = chip.querySelector('#net-long')!
  const modelTxt = host.querySelector('#model-txt')!
  const h = state.health
  const netUp = navigator.onLine
  chip.classList.remove('on', 'off', 'down')
  if (!h) { short.textContent = t('st_checking'); return }
  const model = friendlyModel(state.lastModel ?? h.models?.chat ?? h.models?.vision ?? '')
  const prov = h.provider || 'demo'
  modelTxt.textContent = h._fallback ? t('st_demo_data') : `${prov}${model ? ' · ' + model : ''}`
  if (h._fallback) {
    // server unreachable: the app still works from IndexedDB; say so plainly
    chip.classList.add(netUp ? 'down' : 'off')
    icon.textContent = netUp ? 'error' : 'cloud_off'
    short.textContent = netUp ? t('st_noserver') : t('st_offline')
    long.textContent = ` · ${t('st_demo_data')}`
  } else {
    const online = netUp && h.online !== false
    chip.classList.add(online ? 'on' : 'off')
    icon.textContent = online ? 'cloud_done' : 'cloud_off'
    short.textContent = online ? t('st_online') : t('st_offline')
    long.textContent = ` · ${prov}${h.demo ? ' · DEMO' : ''}`
  }
  chip.title = `${short.textContent}${long.textContent} · ${modelTxt.textContent}`
}
