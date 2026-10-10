// Status pills under the large title: Blackout mode, online/offline (navigator.onLine + /api/health every 10 s),
// evacuation zone letter, language. No model or provider names in the UI (user rule, 1:15 PM). Connectivity drives Blackout mode (theme.ts).
import { getHealth } from './api'
import { LANGS, getLang, onLang, setLang, t, type Lang } from './i18n'
import { zoneOf } from './prep'
import { openSheet } from './sheet'
import { setOffline } from './theme'
import { emit, esc, haptic, on, state } from './util'

const POLL_MS = 10_000
let host: HTMLElement
let onZone: () => void

export function mountStatus(el: HTMLElement, openPrep: () => void): void {
  host = el; onZone = openPrep
  render()
  onLang(render)
  on('health', paint)
  on('prep', paint)
  // Auto-Blackout triggers only on the browser going offline (event, or navigator.onLine checked every second
  // in case the event is missed) or on 2 consecutive failed /api/health checks (6 s timeout each). Never on one slow reply.
  window.addEventListener('online', () => netChanged(true))
  window.addEventListener('offline', () => netChanged(false))
  let navPrev = navigator.onLine
  setInterval(() => { const n = navigator.onLine; if (n !== navPrev) { navPrev = n; if (n !== !netDown) netChanged(n) } }, 1000)
  if (!navigator.onLine) setOffline(true)
  void poll()
  setInterval(poll, POLL_MS)
}

const LANG_NAMES: Record<Lang, string> = { en: 'English', es: 'Español', ht: 'Kreyòl ayisyen' }

function render(): void {
  host.innerHTML = `
    <span class="blackout-pill" role="status"><span class="ms fill" aria-hidden="true">dark_mode</span>${esc(t('blackout_pill'))}</span>
    <span class="pill" id="net-pill" role="status" aria-live="polite"><span class="dot" aria-hidden="true"></span><span id="net-txt">${esc(t('st_checking'))}</span></span>
    <button type="button" class="pill" id="zone-pill"><span class="ms" aria-hidden="true">flood</span><span id="zone-txt"></span></button>
    <button type="button" class="pill" id="lang-pill" aria-label="${esc(t('lang_label'))}"><span class="ms" aria-hidden="true">translate</span>${getLang().toUpperCase()}</button>`
  host.querySelector('#zone-pill')!.addEventListener('click', () => { haptic(); onZone() })
  host.querySelector('#lang-pill')!.addEventListener('click', openLangSheet)
  paint()
}

export function openLangSheet(): void {
  openSheet(t('lang_label'), `<div class="list">${LANGS.map((l) => `<button type="button" class="row lang-opt" data-lang="${l}"><span class="main"><span class="t1">${esc(LANG_NAMES[l])}</span></span>${l === getLang() ? '<span class="ms" aria-hidden="true">check</span>' : ''}</button>`).join('')}</div>`,
    (body, sheet) => body.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { haptic(); sheet.close(); setLang(b.dataset.lang as Lang) })))
}

let netDown = !navigator.onLine
let fails = 0
function netChanged(up: boolean): void {
  netDown = !up
  if (up) fails = 0
  setOffline(!up) // crossfade right away; the health poll only adds Blackout after 2 straight failures
  paint()
  void poll()
}

let inflight = false
let queued = false
async function poll(): Promise<void> {
  if (inflight) { queued = true; return }
  inflight = true
  const startedOnline = !netDown
  try {
    state.health = await getHealth()
  } finally {
    inflight = false
  }
  // a poll that started while offline must not count against a connection that has since come back
  if (startedOnline || netDown) fails = state.health?._fallback ? fails + 1 : 0
  setOffline(netDown || fails >= 2)
  emit('health') // repaints via on('health', paint)
  if (queued) { queued = false; void poll() }
}

function paint(): void {
  const pill = host?.querySelector<HTMLElement>('#net-pill')
  if (!pill) return
  const txt = pill.querySelector('#net-txt')!
  const zoneTxt = host.querySelector('#zone-txt')!
  const z = zoneOf(state.prep)
  zoneTxt.textContent = state.prep ? (z.letter ? `${t('zone_short')} ${z.letter}` : t('zone_none_short')) : t('picker_none')
  const h = state.health
  // The 'offline' event (netDown) wins over navigator.onLine, which some browsers and emulators leave true.
  const netUp = navigator.onLine && !netDown
  pill.classList.remove('ok', 'off', 'down')
  if (!netUp) { pill.classList.add('off'); txt.textContent = t('st_offline'); pill.title = txt.textContent; return }
  if (!h) { txt.textContent = t('st_checking'); return }
  if (h._fallback) {
    pill.classList.add(netUp ? 'down' : 'off')
    txt.textContent = netUp ? t('st_noserver') : t('st_offline')
  } else {
    const online = netUp && h.online !== false
    pill.classList.add(online ? 'ok' : 'off')
    txt.textContent = (online ? t('st_online') : t('st_offline')) + (h.demo ? ' · demo' : '')
  }
  pill.title = txt.textContent ?? ''
}
