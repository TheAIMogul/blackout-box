// API client for the Blackout Box server (CONTRACT.md table). Base '/api' (Vite proxy → :3001).
// Every call has a timeout. When the server cannot be reached, data calls return the inline DEMO
// payloads below, flagged `_fallback: true`, so the UI always renders and always says it is demo data.
import type { WebItem } from './engine'

export const API = '/api'

export type Health = { ok: boolean; online: boolean; demo: boolean; provider: string; models?: { vision?: string; chat?: string }; modelReachable?: boolean; _fallback?: boolean }
export type VisionResult = { items: WebItem[]; _model: string; _provider?: string; _latencyMs?: number; unreadableCount?: number; _fallback?: boolean; error?: string }
export type ChatResult = { text: string; _model: string; _provider?: string; _latencyMs?: number; call911?: boolean; sources?: string[]; serverFiltered?: boolean }
export type Place = { name: string; lat?: number; lon?: number; address?: string; open24h?: boolean; distanceMi?: number; kind?: string }
export type PrepBundle = {
  generatedAt?: string
  zone?: { zone: string | null; category?: number | null; _source?: string } | null
  nws?: { tempF?: number; heatIndexF?: number; observedAt?: string; station?: string; hourly?: { t: string; tempF: number }[]; _source?: string } | null
  places?: unknown
  fema?: { declarations?: { number: number | string; title: string; date: string; type: string }[]; _source?: string } | null
  tide?: { station?: string; predictions?: { t: string; v: string | number; type: string }[]; latest?: { t: string; v: string | number }; _source?: string } | null
  statute?: { number: string; summary: string; url?: string } | null
  fdaEmergencyInsulin?: { url: string; summary: string } | null
  foodRules?: { url: string; headline: string } | null
  _fallback?: boolean
  [k: string]: unknown
}

async function req<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), init.timeoutMs ?? 15000)
  try {
    const r = await fetch(API + path, { ...init, signal: ctl.signal, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw Object.assign(new Error(body?.error ?? `HTTP ${r.status}`), { status: r.status, code: body?.code })
    return body as T
  } finally {
    clearTimeout(timer)
  }
}

export async function getHealth(): Promise<Health> {
  try {
    return await req<Health>('/health', { timeoutMs: 3500, cache: 'no-store' })
  } catch {
    return { ok: false, online: false, demo: true, provider: 'demo', models: {}, _fallback: true }
  }
}

export async function visionItems(imageBase64: string, mime: string, hint: 'fridge' | 'meds' | 'any' = 'any'): Promise<VisionResult> {
  try {
    const r = await req<VisionResult>('/vision/items', { method: 'POST', body: JSON.stringify({ imageBase64, mime, hint }), timeoutMs: 60000 })
    return { items: Array.isArray(r.items) ? r.items : [], _model: r._model ?? 'unknown', _provider: r._provider, _latencyMs: r._latencyMs, unreadableCount: r.unreadableCount }
  } catch (e) {
    return { items: demoItems(), _model: 'demo', _fallback: true, error: (e as Error).message }
  }
}

export async function chat(messages: { role: string; content: string }[], lang: string, context?: unknown): Promise<ChatResult | null> {
  try {
    const r = await req<{ text: string; _model: string; _provider?: string; _latencyMs?: number; call_911?: boolean; sources?: string[]; _filtered?: boolean }>('/chat', { method: 'POST', body: JSON.stringify({ messages, lang, context }), timeoutMs: 50000 })
    const p = parseChat(r.text, r._model)
    return { ...p, _provider: r._provider, _latencyMs: r._latencyMs, call911: !!(p.call911 || r.call_911), sources: p.sources ?? r.sources, serverFiltered: !!r._filtered }
  } catch {
    return null
  }
}

// P2 answers may arrive as the raw JSON contract {answer, sources, call_911}; accept both.
function parseChat(text: string, model: string): ChatResult {
  const s = String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  if (s.startsWith('{')) {
    try {
      const j = JSON.parse(s)
      if (typeof j.answer === 'string') return { text: j.answer, _model: model, call911: !!j.call_911, sources: j.sources }
    } catch { /* plain text */ }
  }
  return { text: String(text ?? ''), _model: model }
}

export async function getPrep(lat: number, lon: number): Promise<PrepBundle> {
  try {
    return await req<PrepBundle>(`/prep?lat=${lat}&lon=${lon}`, { timeoutMs: 30000 })
  } catch {
    return { ...DEMO_PREP, generatedAt: new Date().toISOString(), _fallback: true }
  }
}

export async function openfdaLabel(q: string): Promise<{ found?: boolean; name?: string; limit: WebItem['limit'] | null; _source?: string } | null> {
  try {
    return await req(`/openfda/label?q=${encodeURIComponent(q)}`, { timeoutMs: 12000 })
  } catch {
    return null
  }
}

/** 8x8 grey JPEG made on a canvas: lets "Try demo photo" exercise the real vision route without a camera. */
export function placeholderJpeg(): string {
  const c = document.createElement('canvas')
  c.width = 8; c.height = 8
  const g = c.getContext('2d')!
  g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, 8, 8)
  const u = c.toDataURL('image/jpeg', 0.8)
  return u.slice(u.indexOf(',') + 1)
}

// ---------- DEMO payloads (shown only with a visible "demo" label) ----------
// Items follow fixtures in specs/four-hour-rule-brief.html ("DEMO_MODE fixtures"), mapped to CONTRACT Item shape.
// Med limits are the Cold Chain rules quoted in the briefs (Lantus/Humalog ≤86°F 28 d; amoxicillin suspension 14 d).
export function demoItems(): WebItem[] {
  const fda = 'openFDA drug label (demo sample)'
  return [
    { id: 'f1', name: '2% milk', category: 'food', container: 'carton', opened: true, location: 'door', foodClass: 'discard_4h' },
    { id: 'f2', name: 'Eggs', category: 'food', container: 'carton', opened: true, location: 'fridge', foodClass: 'discard_4h' },
    { id: 'f3', name: 'Cooked chicken (leftovers)', category: 'food', container: 'tub', opened: true, location: 'fridge', foodClass: 'discard_4h' },
    { id: 'f4', name: 'Cheddar cheese block', category: 'food', container: 'bag', opened: true, location: 'fridge', foodClass: 'keep' },
    { id: 'f5', name: 'Butter', category: 'food', container: 'box', opened: true, location: 'door', foodClass: 'keep' },
    { id: 'f6', name: 'Ketchup', category: 'food', container: 'bottle', opened: true, brandText: 'Heinz', location: 'door', foodClass: 'keep' },
    { id: 'f7', name: 'Baby formula (ready-to-feed), opened', category: 'food', container: 'bottle', opened: true, location: 'fridge', foodClass: 'discard_4h' },
    { id: 'f8', name: 'Frozen chicken breasts', category: 'food', container: 'bag', opened: false, location: 'freezer', foodClass: 'frozen_refreeze' },
    { id: 'm1', name: 'Lantus SoloStar', category: 'med', container: 'pen', quantity: '5 pens', opened: false, brandText: 'LANTUS SoloStar insulin glargine injection 100 units/mL',
      limit: { kind: 'days_at_room_temp', days: 28, maxTempF: 86, storage: 'refrigerated', source: fda + ': Lantus, up to 86°F for 28 days' } },
    { id: 'm2', name: 'Humalog KwikPen', category: 'med', container: 'pen', opened: true, openedDaysAgo: 20, brandText: 'HUMALOG KwikPen insulin lispro injection 100 units/mL',
      limit: { kind: 'days_at_room_temp', days: 28, inUseDays: 28, maxTempF: 86, storage: 'refrigerated', source: fda + ': Humalog, 28 days total at room temperature' } },
    { id: 'm3', name: 'Amoxicillin for oral suspension 250 mg/5 mL', category: 'med', container: 'bottle', opened: true, openedDaysAgo: 10,
      limit: { kind: 'days_at_room_temp', inUseDays: 14, storage: 'room_temp', source: 'openFDA label, set 077f4a65 (Hikma), how_supplied', quote: 'Discard suspension after 14 days.' } },
    { id: 'm4', name: 'Metformin 500 mg tablets', category: 'med', container: 'bottle', opened: true, brandText: 'Metformin HCl 500 mg',
      limit: { kind: 'days_at_room_temp', maxTempF: 86, storage: 'room_temp', source: fda + ': metformin, excursions permitted to 86°F' } },
  ]
}

// Values from specs/blackout-box-brief.html (verified 2026-10-10 there): zone B for 25.77,-80.19,
// FEMA DR-4834 / EM-3622 / DR-4680, ICON Brickell garage EV chargers 0.09 mi.
const DEMO_PREP: PrepBundle = {
  zone: { zone: 'B', category: 2, _source: 'Miami-Dade HurricaneEvacZone_gdb (demo sample)' },
  nws: { tempF: 87.8, heatIndexF: 97.7, observedAt: '2026-10-10T14:20:00Z', station: 'KMIA', _source: 'NWS (demo sample)' },
  places: {
    power: { features: [{ name: 'ICON Brickell garage (EV chargers, 24 h)', distanceMi: 0.09, open24h: true }], _source: 'NREL/NLR (demo sample)' },
    library: { features: [], _source: 'Miami-Dade Library_gdb (demo sample)' },
    fire: { features: [], _source: 'Miami-Dade FireStation_gdb (demo sample)' },
  },
  fema: {
    declarations: [
      { number: 4834, title: 'HURRICANE MILTON', date: '2024-10-11', type: 'DR' },
      { number: 3622, title: 'HURRICANE MILTON', date: '2024-10-07', type: 'EM' },
      { number: 4680, title: 'HURRICANE NICOLE', date: '2022-12-13', type: 'DR' },
    ],
    _source: 'OpenFEMA DisasterDeclarationsSummaries v2 (demo sample)',
  },
  tide: null,
  statute: { number: 'F.S. 252.358', summary: 'Under a hurricane warning, a Governor-declared emergency, or an activated county EOC, insurers must waive "refill too soon" limits and cover at least a 30-day supply, if refills remain. Likely applies; ask your pharmacy.', url: 'https://www.flsenate.gov/Laws/Statutes/2025/252.358' },
  fdaEmergencyInsulin: { url: 'https://www.fda.gov/drugs/emergency-preparedness-drugs/information-regarding-insulin-storage-and-switching-between-products-emergency', summary: 'Insulin may be kept at 59–86°F for up to 28 days. Above 86°F in an emergency it may still need to be used. Never use frozen insulin. Replace it when proper storage is available.' },
  foodRules: { url: 'https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage', headline: 'A closed refrigerator keeps food safe for up to 4 hours without power. Discard refrigerated perishables after that. A full freezer holds about 48 hours (24 if half full).' },
}
