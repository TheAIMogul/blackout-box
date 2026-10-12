// Blackout mode: when the device goes offline (or the server is unreachable), or the user taps the moon,
// the whole app crossfades (400 ms color transition on every element) into true-black OLED.
// Coming back online crossfades back. With no override the app follows prefers-color-scheme.
import { haptic } from './util'

let offline = false
let manual: boolean | null = null // the moon button; reset whenever connectivity flips so wifi-off always goes dark
const subs = new Set<() => void>()

export function isBlackout(): boolean { return manual ?? offline }
export function onTheme(fn: () => void): void { subs.add(fn) }

export function setOffline(off: boolean): void {
  // Automatic offline detection is switched off (user request, Oct 12): it misfired during the live demo.
  // Blackout mode now only comes from the moon button.
  void off
  return
  // eslint-disable-next-line no-unreachable
  if (off === offline) return
  offline = off
  manual = null
  apply()
}

export function toggleBlackout(): void {
  haptic()
  manual = !isBlackout()
  apply()
}

const osDark = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches

function apply(): void {
  const on = isBlackout()
  const root = document.documentElement
  const theme = on ? 'dark' : manual === false && osDark() ? 'light' : ''
  if ((root.dataset.blackout === '1') === on && (root.dataset.theme ?? '') === theme) { paintMeta(); return }
  // Synchronous switch + a 400 ms color crossfade on every element (html.theming). A View Transition looked
  // nicer but its callback can wait on a rendered frame; the wifi-off moment must never lag.
  root.classList.add('theming')
  if (on) root.dataset.blackout = '1'; else delete root.dataset.blackout
  if (theme) root.dataset.theme = theme; else delete root.dataset.theme
  paintMeta()
  subs.forEach((fn) => fn())
  clearTimeout(themingTimer)
  themingTimer = setTimeout(() => root.classList.remove('theming'), 650)
}
let themingTimer: ReturnType<typeof setTimeout> | undefined

/** Status bar / splash color: #000000 in Blackout mode, #FFFFFF light. */
function paintMeta(): void {
  const dark = isBlackout() || (osDark() && document.documentElement.dataset.theme !== 'light')
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => { m.content = dark ? '#000000' : '#FFFFFF'; m.removeAttribute('media') })
}

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { paintMeta(); subs.forEach((fn) => fn()) })
paintMeta()
