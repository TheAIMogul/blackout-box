import type { Health, PrepBundle } from './api'
import type { NV, WebItem } from './engine'
import { getLang } from './i18n'

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector(sel)
  if (!el) throw new Error('missing ' + sel)
  return el as HTMLElement
}

const p2 = (n: number) => (n < 10 ? '0' : '') + n

/** "2d 03:14:09" / "03:14:09" */
export function fmtClock(ms: number): string {
  let s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400); s %= 86400
  const h = Math.floor(s / 3600); s %= 3600
  const m = Math.floor(s / 60); s %= 60
  return (d ? d + 'd ' : '') + p2(h) + ':' + p2(m) + ':' + p2(s)
}

export function fmtWhen(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return String(iso)
  const loc = { en: 'en-US', es: 'es-US', ht: 'fr-HT' }[getLang()] // no ht locale data in browsers; fr-HT is closest
  return d.toLocaleString(loc, { weekday: 'short', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })
}

/** value for <input type="datetime-local"> in local time */
export function toLocalInput(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function uid(prefix = 'i'): string {
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)
}

// ---- tiny shared app state ----
type AppState = { lastModel: string | null; health: Health | null; prep: PrepBundle | null; prepAt: string | null; items: WebItem[]; verdicts: NV[]; lat: number; lon: number }
export const state: AppState = { lastModel: null, health: null, prep: null, prepAt: null, items: [], verdicts: [], lat: 25.77, lon: -80.19 }

type Ev = 'health' | 'prep' | 'items'
const subs: Record<Ev, Set<() => void>> = { health: new Set(), prep: new Set(), items: new Set() }
export function on(ev: Ev, fn: () => void): void { subs[ev].add(fn) }
export function emit(ev: Ev): void { subs[ev].forEach((fn) => fn()) }

// ---- US units at the edge (CONTRACT "US units everywhere"): °F, mph, miles, feet. /api/now speaks metric, so convert it here ----
export const cToF = (c: number): number => (c * 9) / 5 + 32
export const kmhToMph = (kmh: number): number => kmh / 1.609344
export const kmToMi = (km: number): number => km / 1.609344
export const mToFt = (m: number): number => m / 0.3048
const r0 = (n: number): string => String(Math.round(n))
const r1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1)
const r2 = (n: number): string => (Math.round(n * 100) / 100).toFixed(2)
/** "88 °F" from °F */
export function fmtF(f: number | null | undefined): string { return f == null || !Number.isFinite(f) ? '—' : `${r0(f)} °F` }
/** "0.4 mi" from miles */
export function fmtMi(mi: number | null | undefined): string { return mi == null || !Number.isFinite(Number(mi)) ? '—' : `${r1(Number(mi))} mi` }
/** "2.41 ft" from feet */
export function fmtFt(ft: number | string | null | undefined): string { const n = Number(ft); return ft == null || ft === '' || !Number.isFinite(n) ? '—' : `${r2(n)} ft` }
/** "2.41 ft" from metres */
export function fmtFtFromM(m: number | null | undefined): string { return m == null || !Number.isFinite(m) ? '—' : `${r2(mToFt(m))} ft` }

const N = '(-?\\d[\\d,]*(?:\\.\\d+)?)'
const num = (s: string): number => Number(s.replace(/,/g, ''))
const comma = (n: number): string => Math.round(n).toLocaleString('en-US')
/** Rewrite every metric number in text (server warnings, model answers) to US units; imperial text passes through.
 *  "40°F (4°C)" keeps only the °F. Verbatim FDA/USDA quotes are NOT passed through this. */
export function usText(s: string): string {
  if (!s) return s
  return s
    // drop a metric echo in parentheses right after an imperial value: "40°F (4°C)", "59–86°F (15–30°C)", "1 mile (1.6 km)"
    .replace(/(°\s?F|\bmiles?|\bmi|\bft|\bfeet|\bmph)\s*\(\s*[^()]*?(?:°\s?C|km\/h|km|metres?|meters?|\bm)\s*\)/g, '$1')
    .replace(new RegExp(`${N}\\s?[–-]\\s?${N}\\s?°\\s?C\\b`, 'g'), (_m, a, b) => `${r0(cToF(num(a)))}–${r0(cToF(num(b)))} °F`)
    .replace(new RegExp(`${N}\\s?°\\s?C\\b`, 'g'), (_m, a) => `${r0(cToF(num(a)))} °F`)
    .replace(new RegExp(`${N}\\s?km\\/h`, 'g'), (_m, a) => `${r0(kmhToMph(num(a)))} mph`)
    .replace(new RegExp(`${N}\\s?km\\b`, 'g'), (_m, a) => `${comma(kmToMi(num(a)))} mi`)
    .replace(new RegExp(`${N}\\s?(?:metres|meters|metre|meter)\\b`, 'g'), (_m, a) => `${r2(mToFt(num(a)))} ft`)
    .replace(/(-?\d+\.\d+)\s?m\b/g, (_m, a) => `${r2(mToFt(Number(a)))} ft`)
}

// ---- haptics + motion ----
export const reducedMotion = (): boolean => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
export function haptic(): void { try { if (!reducedMotion()) navigator.vibrate?.(10) } catch { /* unsupported */ } }
/** Run a DOM update inside a View Transition when supported (crossfade); plain update otherwise. */
export function withTransition(update: () => void, kind: 'tab' | 'theme' = 'tab'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = document as any
  if (typeof d.startViewTransition !== 'function' || reducedMotion() || document.visibilityState !== 'visible') { update(); return }
  const root = document.documentElement
  if (kind === 'theme') root.classList.add('vt-theme')
  // The DOM update must never wait on rendering (background tabs, headless, a skipped transition):
  // run it at most once, from the transition callback or from a 150 ms fallback, whichever comes first.
  let done = false
  const run = () => { if (!done) { done = true; update() } }
  try {
    const vt = d.startViewTransition(run)
    vt.finished.catch(() => {}).finally(() => root.classList.remove('vt-theme'))
    vt.ready?.catch?.(() => {})
    setTimeout(run, 150)
  } catch { root.classList.remove('vt-theme'); run() }
}
