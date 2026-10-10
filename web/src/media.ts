// Custom media set (Agent G, Grok): /media/manifest.json → [{ id, use, kind, src, srcPhone?, webm?, poster?, width, height, alt }].
// Loaded at runtime; every lookup degrades to null so the app looks right with no media at all.
import { esc, reducedMotion } from './util'

export type MediaEntry = { id: string; use: string; kind?: string; src: string; srcPhone?: string; webm?: string; poster?: string; still?: string; videoPhone?: string; stillPhone?: string; durationSec?: number; width?: number; height?: number; alt?: string; color?: string }

let byUse = new Map<string, MediaEntry>()
const subs = new Set<() => void>()
let sig = ''

export function onMedia(fn: () => void): void { subs.add(fn) }

export async function loadMedia(): Promise<void> {
  try {
    const r = await fetch('/media/manifest.json', { cache: 'no-cache' })
    if (!r.ok) return
    const arr = (await r.json()) as unknown
    const list = (Array.isArray(arr) ? arr : Array.isArray((arr as { items?: unknown[] })?.items) ? (arr as { items: unknown[] }).items : []) as MediaEntry[]
    const next = new Map<string, MediaEntry>()
    for (const m of list) if (m && typeof m.use === 'string' && typeof m.src === 'string') next.set(m.use, m)
    const s = JSON.stringify([...next.entries()].map(([k, v]) => [k, v.src, v.webm, v.poster, v.srcPhone]))
    if (s === sig) return
    sig = s; byUse = next
    subs.forEach((fn) => fn())
  } catch { /* no manifest yet: gradients and Material Symbols stand in */ }
}

export function media(...uses: string[]): MediaEntry | null {
  for (const u of uses) { const m = byUse.get(u); if (m) return m }
  return null
}

const abs = (p?: string) => (!p ? '' : /^(https?:)?\//.test(p) ? p : '/' + p.replace(/^\.?\//, ''))
const saveData = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData

/** <img> for a 3D icon, or the Material Symbol fallback. */
export function iconHTML(uses: string[], fallback: string, cls = 'mi'): string {
  const m = media(...uses)
  return m ? `<img class="${cls}" src="${esc(abs(m.src))}" alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ms',textContent:'${esc(fallback)}'}))">`
    : `<span class="ms" aria-hidden="true">${esc(fallback)}</span>`
}

/** Best still for this screen: phone crop under 600 px wide. */
export function stillSrc(m: MediaEntry): string {
  const isVideo = (m.kind ?? '').startsWith('video') || /\.(mp4|webm|mov)$/i.test(m.src)
  const phone = window.innerWidth < 600 && m.srcPhone && !/\.(mp4|webm|mov)$/i.test(m.srcPhone) ? m.srcPhone : ''
  return abs(phone || (isVideo ? (m.still || m.poster) : m.src) || m.poster)
}

/** Background layer: still with a slow Ken Burns drift, or a looping muted video when the manifest has one
 *  (phone source under 600 px). Reduced motion / Save-Data: still only, no drift. */
export function backdropHTML(m: MediaEntry): string {
  const isVideo = (m.kind ?? '').startsWith('video') || /\.(mp4|webm|mov)$/i.test(m.src)
  const still = stillSrc(m)
  const fallback = abs(m.poster)
  const img = still ? `<img class="kb" src="${esc(still)}" alt="" decoding="async" fetchpriority="high" onerror="${fallback && fallback !== still ? `if(this.src.indexOf('${esc(fallback)}')<0){this.src='${esc(fallback)}'}else{this.remove()}` : 'this.remove()'}">` : ''
  if (!isVideo || reducedMotion() || saveData()) return img
  const phone = window.innerWidth < 600 && m.srcPhone && /\.(mp4|webm|mov)$/i.test(m.srcPhone) ? abs(m.srcPhone) : ''
  return `${img}<video autoplay muted loop playsinline preload="auto" ${still ? `poster="${esc(still)}"` : ''}>
    ${m.webm && !phone ? `<source src="${esc(abs(m.webm))}" type="video/webm">` : ''}
    <source src="${esc(phone || abs(m.src))}" type="video/mp4"></video>`
}

/** Warm the service-worker cache (runtime CacheFirst on /media/) so a hero is there when the network is not. */
export function prefetch(m: MediaEntry | null): void {
  if (!m || !navigator.onLine) return
  for (const u of [stillSrc(m), abs(m.poster)]) if (u) { const i = new Image(); i.decoding = 'async'; i.src = u }
}

/** Lights-out clip (plays once when Blackout turns on): phone cut under 600 px, else the full clip. */
function clipSrc(m: MediaEntry): string { return abs(window.innerWidth < 600 && m.videoPhone ? m.videoPhone : m.src) }

/** Warm the cache for the lights-out clip (and its poster) so it plays offline, the way prefetch() warms the Blackout still. */
export function prefetchClip(m: MediaEntry | null): void {
  if (!m || !navigator.onLine || saveData()) return
  for (const u of [clipSrc(m), abs(m.poster), abs(m.still)]) if (u) void fetch(u, { credentials: 'same-origin' }).catch(() => {})
}

/** Overlay a muted, play-once <video> of the lights going out on `host`; it fades away on `ended`, revealing whatever
 *  is underneath (the Blackout still). Reduced motion / Save-Data / no clip: nothing happens, the still is the fallback. */
export function playLightsOut(host: HTMLElement, cls = 'lightsout'): void {
  const m = media('now.transition.lightsout')
  if (!m || reducedMotion() || saveData()) return
  host.querySelectorAll('video.lightsout').forEach((v) => v.remove())
  const v = document.createElement('video')
  v.className = cls
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto'
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true')
  if (m.poster) v.poster = abs(m.poster)
  v.src = clipSrc(m)
  let gone = false
  const done = () => { if (gone) return; gone = true; v.classList.add('out'); setTimeout(() => v.remove(), 600) }
  v.addEventListener('ended', done)
  v.addEventListener('error', () => v.remove())
  setTimeout(done, ((m.durationSec ?? 4) + 3) * 1000) // never leave it stuck
  host.appendChild(v)
  v.play()?.catch(() => v.remove())
}

/** Large illustration for empty states. */
export function emptyArt(use: string): string {
  const m = media(use)
  return m ? `<img class="empty-art" src="${esc(abs(m.poster || m.src))}" alt="" aria-hidden="true" loading="lazy" onerror="this.remove()">` : ''
}

void loadMedia()
window.addEventListener('online', () => void loadMedia())
setInterval(() => { if (navigator.onLine) void loadMedia() }, 120_000)
