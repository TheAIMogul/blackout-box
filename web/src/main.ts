/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />
// App shell, "Apple meets Airbnb": frosted top bar (small title fades in on scroll), large title + status pills,
// iOS bottom tab bar (Now, Clocks, Prep, Map, Ask, Why), drill banner on every tab, safety footer at the end of each page, Blackout mode, Add to Home Screen sheet.
import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { mountAsk } from './ask'
import { mountFourHour } from './fourhour'
import { getLang, LANGS, onLang, setLang, t } from './i18n'
import { mountNow } from './now'
import { loadPrepFromCache, mountPrep } from './prep'
import { openSheet } from './sheet'
import { mountStatus } from './status'
import { mountWhy } from './why'
import { startTour } from './tutorial'
import { isBlackout, onTheme, toggleBlackout } from './theme'
import { esc, haptic, state, withTransition } from './util'

type Tab = 'now' | 'fourhour' | 'prep' | 'map' | 'ask' | 'why'
const TABS: Tab[] = ['now', 'fourhour', 'prep', 'map', 'ask', 'why']
const ICON: Record<Tab, string> = { now: 'partly_cloudy_day', fourhour: 'timer', prep: 'inventory_2', map: 'map', ask: 'forum', why: 'volunteer_activism' }
const SUB: Record<Tab, string> = { now: 'now_sub', fourhour: 'fh_sub', prep: 'prep_sub', map: 'map_sub', ask: 'ask_sub', why: 'why_sub' }

const app = document.getElementById('app')!
app.innerHTML = `
  <div class="drill" id="drill" role="status"></div>
  <button type="button" class="lang-fab" id="lang-fab" aria-label="Language: English. Tap to switch."><span class="lang-fab-c">EN</span><span class="lang-fab-n">Español</span></button>
  <div class="net-pill" id="net-pill" role="status" aria-live="polite"><span class="ms" aria-hidden="true">wifi_off</span><span class="net-pill-t"></span></div>
  <header class="topbar" id="topbar">
    <div class="tb-left"><span class="brand"><img src="/icons/icon-192.png" alt="" width="26" height="26"><span>Blackout Box</span></span></div>
    <div class="tb-title" id="tb-title" aria-hidden="true"></div>
    <div class="tb-right">
      <button type="button" class="round-btn hidden" id="install-btn"><span class="ms" aria-hidden="true">install_mobile</span></button>
      <button type="button" class="round-btn" id="moon-btn" aria-pressed="false"><span class="ms" aria-hidden="true">dark_mode</span></button>
    </div>
  </header>
  <div class="stage" id="stage">
    <div class="hero-media" id="hero-media" aria-hidden="true"></div>
    <div class="content lt">
      <h1 class="large-title" id="lt-title"></h1>
      <p class="lt-sub" id="lt-sub"></p>
      <div class="pills" id="status-pills"></div>
    </div>
    <div class="content now-hero-slot" id="now-hero"></div>
  </div>
  <main class="content">
    <section class="view" id="v-now"></section>
    <section class="view" id="v-fourhour"></section>
    <section class="view" id="v-prep"></section>
    <section class="view" id="v-map">
      <div class="map-host" id="map-host"><div class="map-msg" id="map-msg"></div></div>
    </section>
    <section class="view" id="v-ask"></section>
    <section class="view" id="v-why"></section>
  </main>
  <footer class="safety" id="safety" role="contentinfo"></footer>
  <nav class="tabbar" id="tabbar" aria-label="Main"></nav>`

const topbar = document.getElementById('topbar')!
const stage = document.getElementById('stage')!

function currentTab(): Tab {
  const h = location.hash.replace('#', '') as Tab
  return TABS.includes(h) ? h : 'now'
}

function renderNav(): void {
  const cur = currentTab()
  document.getElementById('tabbar')!.innerHTML = TABS.map((k) =>
    `<button type="button" data-tab="${k}" ${k === cur ? 'aria-current="page"' : ''}><span class="ms" aria-hidden="true">${ICON[k]}</span><span class="lbl">${esc(t('tab_' + k))}</span></button>`).join('')
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    haptic()
    if (b.dataset.tab === currentTab()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    location.hash = b.dataset.tab!
  }))
  paintTitles()
}

function paintTitles(): void {
  const cur = currentTab()
  const title = cur === 'fourhour' ? t('tab_fourhour') : t('title_' + cur)
  document.getElementById('lt-title')!.textContent = title
  document.getElementById('tb-title')!.textContent = title
  document.getElementById('lt-sub')!.textContent = t(SUB[cur])
  const moon = document.getElementById('moon-btn')!
  moon.setAttribute('aria-label', t(isBlackout() ? 'blackout_off' : 'blackout_on'))
  moon.setAttribute('aria-pressed', String(isBlackout()))
  moon.classList.toggle('on', isBlackout())
  moon.querySelector('.ms')!.textContent = isBlackout() ? 'dark_mode' : 'bedtime'
  document.getElementById('install-btn')!.setAttribute('aria-label', t('install_title'))
}

function renderDrill(): void {
  // The event name, not translated.
  document.getElementById('drill')!.innerHTML = `<span class="drill-dot" aria-hidden="true"></span><b>Hack for Humanity: Miami</b>`
}

function renderFooter(): void {
  const f = document.getElementById('safety')!
  f.innerHTML = `<span class="ms" aria-hidden="true">health_and_safety</span><span>${esc(t('footer'))}</span>`
}

// ---------- Map tab (Agent F's web/src/map). Lazy-loaded so MapLibre stays out of the main bundle;
// import.meta.glob resolves to {} if the module is missing, so the app still builds and shows "map loading".
type MapModule = { mountMap: (el: HTMLElement, opts: { lat: number; lon: number; apiBase: string; mini?: boolean }) => { destroy(): void } }
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

// ---------- Mini map on Now (mockup 1:52 PM): mounted while Now is showing, destroyed on leaving ----------
let mini: { destroy(): void } | null = null
let miniPending = false
async function syncMini(): Promise<void> {
  const host = document.getElementById('now-minimap')
  const want = currentTab() === 'now' && !!host
  if (!want) { mini?.destroy(); mini = null; return }
  if (mini || miniPending) return
  const load = mapLoaders['./map/index.ts'] as (() => Promise<MapModule>) | undefined
  if (!load) return
  miniPending = true
  try {
    const mod = await load()
    if (currentTab() === 'now' && !mini && host!.isConnected) mini = mod.mountMap(host!, { lat: state.lat, lon: state.lon, apiBase: '/api', mini: true })
  } catch (e) { console.error('mini map failed', e) } finally { miniPending = false }
}
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest?.('#now-minimap')) { haptic(); location.hash = 'map' }
})

let firstRoute = true
function route(): void {
  const cur = currentTab()
  const apply = () => {
    TABS.forEach((k) => document.getElementById('v-' + k)!.classList.toggle('active', k === cur))
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      if (b.dataset.tab === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current')
    })
    stage.classList.toggle('now-stage', cur === 'now')
    topbar.classList.toggle('on-hero', cur === 'now')
    paintTitles()
    window.scrollTo({ top: 0 })
    onScroll()
  }
  if (firstRoute) { firstRoute = false; apply() } else withTransition(apply, 'tab')
  if (cur === 'map') void showMap()
  void syncMini()
}

// iOS large title: the small centered title + frosted bar appear once the large title scrolls under the bar
function onScroll(): void { topbar.classList.toggle('scrolled', window.scrollY > 36) }
window.addEventListener('scroll', onScroll, { passive: true })

document.getElementById('moon-btn')!.addEventListener('click', toggleBlackout)
onTheme(paintTitles)

// ---------- Add to Home Screen ----------
type BIPEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
let bip: BIPEvent | null = null
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
function canInstall(): boolean { return !standalone() && (!!bip || isIOS()) }
function paintInstall(): void { document.getElementById('install-btn')!.classList.toggle('hidden', !canInstall()) }
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); bip = e as BIPEvent; paintInstall(); window.dispatchEvent(new Event('bb-installable')) })
window.addEventListener('appinstalled', () => { bip = null; paintInstall() })
function openInstallSheet(): void {
  const ios = isIOS() || !bip
  openSheet(t('install_title'), `
    <div class="install-card" style="margin-bottom:14px"><img src="/icons/apple-touch-icon-180.png" alt=""><div><div style="font:700 17px var(--font)">Blackout Box</div><div class="muted small">${esc(t('install_why'))}</div></div></div>
    ${ios ? `<ol class="steps">
      <li><span>${esc(t('install_ios_1'))} <span class="ms" aria-label="Share">ios_share</span></span></li>
      <li><span>${esc(t('install_ios_2'))} <span class="ms" aria-hidden="true">add_box</span></span></li>
      <li><span>${esc(t('install_ios_3'))}</span></li></ol>` : `<button type="button" class="btn primary block" id="do-install"><span class="ms" aria-hidden="true">install_mobile</span>${esc(t('install_btn'))}</button>`}`,
  (body, sheet) => body.querySelector('#do-install')?.addEventListener('click', async () => {
    if (!bip) return
    await bip.prompt()
    await bip.userChoice.catch(() => null)
    bip = null; paintInstall(); sheet.close()
  }))
}
document.getElementById('install-btn')!.addEventListener('click', openInstallSheet)
window.addEventListener('bb-open-install', openInstallSheet)
;(window as Window & { bbCanInstall?: () => boolean }).bbCanInstall = canInstall
paintInstall()

renderNav()
renderDrill()
renderFooter()
onLang(() => { renderNav(); renderDrill(); renderFooter(); if (!mapMounted && currentTab() === 'map') void showMap() })
window.addEventListener('hashchange', route)
route()
mountStatus(document.getElementById('status-pills')!, () => { location.hash = 'prep' })
// First-screen tour on every load (skip with ?tour=0); targets that mount later are awaited per step.
startTour()

// Load the saved box first so every screen renders from IndexedDB, then mount the screens.
void (async () => {
  await loadPrepFromCache()
  void mountNow(document.getElementById('now-hero')!, document.getElementById('v-now')!, stage)
  void syncMini()
  mountPrep(document.getElementById('v-prep')!)
  await mountFourHour(document.getElementById('v-fourhour')!)
  await mountAsk(document.getElementById('v-ask')!)
  mountWhy(document.getElementById('v-why')!)
})()

// Service worker: precached app shell so a reload with no network still loads.
registerSW({ immediate: true })

// Tiny "No internet" pill (shown by the .is-offline class on <html>), with the translated text kept current.
const paintNetPill = () => { const el = document.querySelector('#net-pill .net-pill-t'); if (el) el.textContent = t('offline_pill') }
paintNetPill()
onLang(paintNetPill)

// Language circle in the corner: one tap cycles English → Español → Kreyòl and re-renders every screen.
const LANG_NAME: Record<string, string> = { en: 'English', es: 'Español', ht: 'Kreyòl' }
const paintLangFab = () => {
  const b = document.getElementById('lang-fab'); if (!b) return
  const cur = getLang(), next = LANGS[(LANGS.indexOf(cur) + 1) % LANGS.length]
  b.querySelector('.lang-fab-c')!.textContent = cur.toUpperCase()
  b.querySelector('.lang-fab-n')!.textContent = LANG_NAME[next]
  b.setAttribute('aria-label', `Language: ${LANG_NAME[cur]}. Tap for ${LANG_NAME[next]}.`)
}
document.getElementById('lang-fab')?.addEventListener('click', () => {
  const cur = getLang()
  setLang(LANGS[(LANGS.indexOf(cur) + 1) % LANGS.length])
  try { navigator.vibrate?.(10) } catch { /* no haptics */ }
})
paintLangFab()
onLang(paintLangFab)
