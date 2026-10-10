/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />
import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { mountAsk } from './ask'
import { mountFourHour } from './fourhour'
import { onLang, t } from './i18n'
import { loadPrepFromCache, mountPrep } from './prep'
import { mountStatus } from './status'
import { esc, state } from './util'

type Tab = 'fourhour' | 'prep' | 'ask' | 'map'
const TABS: Tab[] = ['fourhour', 'prep', 'ask', 'map']
const ICON: Record<Tab, string> = { fourhour: 'timer', prep: 'inventory_2', ask: 'forum', map: 'map' }

const app = document.getElementById('app')!
app.innerHTML = `
  <header class="appbar" id="appbar"></header>
  <nav class="drawer" id="drawer" aria-label="Main"></nav>
  <div class="scrim" id="scrim"></div>
  <main class="content">
    <section class="view" id="v-fourhour" aria-labelledby="nav-fourhour"></section>
    <section class="view" id="v-prep" aria-labelledby="nav-prep"></section>
    <section class="view" id="v-ask" aria-labelledby="nav-ask"></section>
    <section class="view" id="v-map" aria-labelledby="nav-map">
      <div class="page-head"><h1 id="map-title"></h1></div>
      <div class="map-host" id="map-host"><div class="map-msg" id="map-msg"></div></div>
    </section>
  </main>
  <nav class="bottomnav" id="bottomnav" aria-label="Main"></nav>
  <footer class="safety" id="safety" role="contentinfo"></footer>`

const drawer = document.getElementById('drawer')!
const scrim = document.getElementById('scrim')!
function setDrawer(open: boolean): void { drawer.classList.toggle('open', open); scrim.classList.toggle('open', open) }
scrim.addEventListener('click', () => setDrawer(false))
mountStatus(document.getElementById('appbar')!, () => setDrawer(!drawer.classList.contains('open')), () => { location.hash = 'prep' })

function currentTab(): Tab {
  const h = location.hash.replace('#', '') as Tab
  return TABS.includes(h) ? h : 'fourhour'
}

function renderNav(): void {
  const cur = currentTab()
  drawer.innerHTML = TABS.map((k) =>
    `<button type="button" class="nav-item" id="nav-${k}" data-tab="${k}" ${k === cur ? 'aria-current="page"' : ''}><span class="ms" aria-hidden="true">${ICON[k]}</span>${esc(t('tab_' + k))}</button>`).join('') +
    `<div class="drawer-note">${esc(t('drawer_note'))}</div>`
  document.getElementById('bottomnav')!.innerHTML = TABS.map((k) =>
    `<button type="button" data-tab="${k}" ${k === cur ? 'aria-current="page"' : ''}><span class="pill"><span class="ms" aria-hidden="true">${ICON[k]}</span></span><span class="lbl">${esc(t('tab_' + k))}</span></button>`).join('')
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.tab!; setDrawer(false) }))
  document.getElementById('map-title')!.textContent = t('tab_map')
}

function renderFooter(): void {
  const f = document.getElementById('safety')!
  f.innerHTML = `<span class="ms" aria-hidden="true">health_and_safety</span><span>${esc(t('footer'))}</span>`
  // keep body padding in sync with the footer height so nothing hides behind it
  requestAnimationFrame(() => document.documentElement.style.setProperty('--footer-h', f.offsetHeight + 'px'))
}

// ---------- Map tab (Agent D's web/src/map). Lazy-loaded so MapLibre stays out of the main bundle;
// import.meta.glob resolves to {} if the module is missing, so the app still builds and shows "map loading".
type MapModule = { mountMap: (el: HTMLElement, opts: { lat: number; lon: number; apiBase: string }) => { destroy(): void } }
const mapLoaders = import.meta.glob<MapModule>('./map/index.ts')
let mapMounted = false
async function showMap(): Promise<void> {
  const host = document.getElementById('map-host')!
  const msg = document.getElementById('map-msg')
  if (mapMounted) return
  const load = mapLoaders['./map/index.ts'] as (() => Promise<MapModule>) | undefined
  if (msg) msg.textContent = load ? t('map_loading') : t('map_missing')
  if (!load) return
  try {
    const mod = await load()
    if (typeof mod.mountMap !== 'function') return
    mapMounted = true
    msg?.remove()
    mod.mountMap(host, { lat: state.lat, lon: state.lon, apiBase: '/api' })
  } catch (e) {
    console.error('map failed', e)
    if (msg) msg.textContent = t('map_loading')
  }
}

function route(): void {
  const cur = currentTab()
  TABS.forEach((k) => document.getElementById('v-' + k)!.classList.toggle('active', k === cur))
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    if (b.dataset.tab === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current')
  })
  if (cur === 'map') void showMap()
  window.scrollTo({ top: 0 })
}

renderNav()
renderFooter()
onLang(() => { renderNav(); renderFooter(); if (!mapMounted && currentTab() === 'map') void showMap() })
window.addEventListener('hashchange', route)
window.addEventListener('resize', renderFooter)
route()

// Load the saved box first so every screen renders from IndexedDB, then mount the screens.
void (async () => {
  await loadPrepFromCache()
  mountPrep(document.getElementById('v-prep')!)
  await mountFourHour(document.getElementById('v-fourhour')!)
  await mountAsk(document.getElementById('v-ask')!)
})()

// Service worker: precached app shell so a reload with no network still loads.
registerSW({ immediate: true })
