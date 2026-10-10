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

/** Friendly model label from an exact model id, e.g. "anthropic/claude-sonnet-5.5" → "Claude Sonnet 5.5". */
export function friendlyModel(model: string | undefined): string {
  const m = (model ?? '').trim()
  if (!m || m === 'demo') return ''
  const id = m.replace(/^.*\//, '') // drop "anthropic/"
  const c = /^claude-([a-z]+)-(\d+(?:[.-]\d+)*)/i.exec(id)
  if (c) return `Claude ${c[1][0].toUpperCase()}${c[1].slice(1)} ${c[2].replace(/-/g, '.')}`
  return id
}

/** "Claude Sonnet 5.5 · 6.0 s" */
export function modelMeta(model: string | undefined, latencyMs?: number): string {
  const m = (model ?? '').trim()
  const name = !m || m === 'demo' ? 'demo fixtures' : friendlyModel(m) || m
  return name + (typeof latencyMs === 'number' && latencyMs > 0 ? ` · ${(latencyMs / 1000).toFixed(1)} s` : '')
}

/** "Claude Sonnet 5.5 (anthropic/claude-sonnet-5.5)"; demo fixtures are labeled as such. */
export function describeModel(model: string | undefined, provider?: string | undefined): string {
  const m = (model ?? '').trim()
  if (!m || m === 'demo' || (provider ?? '').toLowerCase() === 'demo' && !m) return 'demo fixtures'
  const f = friendlyModel(m)
  return f && f !== m ? `${f} (${m})` : m
}

// ---- tiny shared app state ----
type AppState = { lastModel: string | null; health: Health | null; prep: PrepBundle | null; prepAt: string | null; items: WebItem[]; verdicts: NV[]; lat: number; lon: number }
export const state: AppState = { lastModel: null, health: null, prep: null, prepAt: null, items: [], verdicts: [], lat: 25.77, lon: -80.19 }

type Ev = 'health' | 'prep' | 'items'
const subs: Record<Ev, Set<() => void>> = { health: new Set(), prep: new Set(), items: new Set() }
export function on(ev: Ev, fn: () => void): void { subs[ev].add(fn) }
export function emit(ev: Ev): void { subs[ev].forEach((fn) => fn()) }
