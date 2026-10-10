/// <reference types="vite/client" />
import 'maplibre-gl/dist/maplibre-gl.css'
import './map.css'
import { Map as MLMap, NavigationControl, AttributionControl, ScaleControl, Popup, Marker, setWorkerUrl } from 'maplibre-gl'
import type { StyleSpecification, GeoJSONSource, ExpressionSpecification, MapGeoJSONFeature, FillLayerSpecification } from 'maplibre-gl'
// MapLibre 6 derives its worker URL from import.meta.url, which breaks once Vite pre-bundles or
// hashes the main file. Point it at the (self-contained) worker file explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { loadZones, loadFlood311, loadTide, loadMyZone, type Tide } from './data'
import { renderTide, nextHighM, fmtTime } from './tide'
import { THRESHOLDS, LEVEL_MAX, LEVEL_MAX_FT, LEVEL_STEP_FT, NAVD88_ABOVE_MLLW, demSource, floodRamp, ftToM, mToFt } from './flood'

setWorkerUrl(workerUrl)

/** mini: compact embedded preview (Now screen): no sheet/slider/readout, no pan/zoom so the page scrolls; compass only. */
export type MountOpts = { lat: number; lon: number; apiBase: string; mini?: boolean }

// Free, keyless vector styles (OpenFreeMap), tried in order. Positron (light) / Dark (Blackout + dark scheme).
const OFM = 'https://tiles.openfreemap.org/styles'
const LIGHT_STYLES = [`${OFM}/positron`, `${OFM}/liberty`, `${OFM}/bright`, 'https://demotiles.maplibre.org/style.json']
const DARK_STYLES = [`${OFM}/dark`, ...LIGHT_STYLES]

// Miami-Dade's own zone order (A red → E blue), in the Apple system palette (light / dark variants).
const ZONES_LIGHT: Record<string, string> = { A: '#FF3B30', B: '#FF9500', C: '#FFCC00', D: '#34C759', E: '#5AC8FA' }
const ZONES_DARK: Record<string, string> = { A: '#FF453A', B: '#FF9F0A', C: '#FFD60A', D: '#30D158', E: '#64D2FF' }

type Palette = {
  dark: boolean; zones: Record<string, string>; bld: string; bldOpacity: number; water: string; bg?: string
  flood311: string; drain311: string; dotStroke: string; heat: ExpressionSpecification
}
const LIGHT: Palette = {
  dark: false, zones: ZONES_LIGHT, bld: '#E6E6EA', bldOpacity: 0.92, water: '#CDE5F7',
  flood311: '#5856D6', drain311: '#30B0C7', dotStroke: '#FFFFFF',
  heat: ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(88,86,214,0)', 0.15, 'rgba(175,82,222,0.28)', 0.4, 'rgba(88,86,214,0.55)', 0.7, 'rgba(88,86,214,0.8)', 1, '#3634A3'],
}
const DARK: Palette = {
  dark: true, zones: ZONES_DARK, bld: '#2C2C2E', bldOpacity: 0.95, water: '#0E1A26', bg: '#000000',
  flood311: '#7D7AFF', drain311: '#5DE6FF', dotStroke: '#000000',
  heat: ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(94,92,230,0)', 0.15, 'rgba(94,92,230,0.3)', 0.4, 'rgba(125,122,255,0.6)', 0.7, '#BF5AF2', 1, '#FFFFFF'],
}

// Camera stops for "Play the storm": Brickell waterfront, then Miami Beach (West Ave / Flamingo Park, the low side).
const BRICKELL = { center: [-80.1905, 25.7655] as [number, number], zoom: 14.7, pitch: 58, bearing: -38 }
const BEACH = { center: [-80.1385, 25.7845] as [number, number], zoom: 14.5, pitch: 62, bearing: 24 }

const ms = (name: string, cls = '') => `<span class="bbm-ms${cls ? ` ${cls}` : ''}" aria-hidden="true">${name}</span>`

/** Load Material Symbols Rounded once if the host page has not. */
function ensureSymbolsFont() {
  if (document.querySelector('link[href*="Material+Symbols+Rounded"]')) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400..600,0..1,0&display=block'
  document.head.appendChild(l)
}

/** Blackout mode (set by the app shell on <html>) or the OS dark scheme → dark map. */
function wantsDark(): boolean {
  const h = document.documentElement
  const theme = (h.dataset.theme || h.dataset.mode || '').toLowerCase()
  if (theme === 'light') return false
  const bo = h.dataset.blackout
  if (h.classList.contains('blackout') || h.classList.contains('dark') || theme === 'dark' || theme === 'blackout' ||
    (bo != null && bo !== 'false' && bo !== 'off' && bo !== '0')) return true
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

const zoneColorExpr = (zones: Record<string, string>, fallback: string): ExpressionSpecification =>
  ['match', ['coalesce', ['get', 'ZONEID'], ''], 'A', zones.A, 'B', zones.B, 'C', zones.C, 'D', zones.D, 'E', zones.E, fallback]

type GeoJSONData = Parameters<GeoJSONSource['setData']>[0]

const ids = {
  dim: 'bbm-dim', zoneFill: 'bbm-zone-fill', bld: 'bbm-bld', heat: 'bbm-311-heat', dots: 'bbm-311-dots',
  hill: 'bbm-hillshade', flood: 'bbm-flood', mask: 'bbm-water-mask', dem: 'bbm-dem', dem3d: 'bbm-dem-3d',
}

async function pickStyle(urls: string[], signal: AbortSignal): Promise<{ style: StyleSpecification; url: string } | null> {
  for (const url of urls) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 6000)
      signal.addEventListener('abort', () => ctl.abort(), { once: true })
      const r = await fetch(url, { signal: ctl.signal })
      clearTimeout(t)
      if (!r.ok) continue
      const style = (await r.json()) as StyleSpecification
      if (!style.layers?.length) continue
      return { style, url }
    } catch {
      if (signal.aborted) return null
    }
  }
  return null
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

/** Light haptic tick where supported, only after a real tap (browsers block vibrate before user activation). */
const buzz = () => {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  if (ua?.hasBeenActive && typeof navigator.vibrate === 'function') navigator.vibrate(10)
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function mountMap(el: HTMLElement, opts: MountOpts): { destroy(): void } {
  const abort = new AbortController()
  const signal = abort.signal
  let map: MLMap | null = null
  let popup: Popup | null = null
  let marker: Marker | null = null
  let destroyed = false
  let dark = wantsDark()
  let pal = dark ? DARK : LIGHT
  let styleUrl: string | null = null
  const reduceMotionMq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const reduced = () => !!reduceMotionMq?.matches
  ensureSymbolsFont()

  // ---------- DOM ----------
  const mini = !!opts.mini
  const root = h('div', mini ? 'bbm bbm-mini' : 'bbm')
  root.dataset.bbmTheme = dark ? 'dark' : 'light'
  const mapEl = h('div', 'bbm-map')
  const status = h('div', 'bbm-status bbm-glass', 'Loading map…')
  const zoneChip = h('div', 'bbm-zonechip bbm-glass', `${ms('my_location')}<span>Finding your zone…</span>`)
  zoneChip.setAttribute('role', 'status')

  // Big glassy level readout (Play the storm + slider drags)
  const readout = h('div', 'bbm-readout bbm-glass')
  readout.setAttribute('aria-live', 'polite')
  readout.innerHTML = `
    <div class="bbm-ro-stage">Water level</div>
    <div class="bbm-ro-level"><span class="bbm-ro-num">0.0</span><span class="bbm-ro-unit">ft</span></div>
    <div class="bbm-ro-sub">above mean lower low water</div>
    <ul class="bbm-ro-thr">${THRESHOLDS.map((t) => `<li data-thr="${t.id}"><i></i><span>${t.short}</span><b>${t.ft.toFixed(2)}</b></li>`).join('')}</ul>`
  const roStage = readout.querySelector('.bbm-ro-stage') as HTMLElement
  const roNum = readout.querySelector('.bbm-ro-num') as HTMLElement
  const roThr = [...readout.querySelectorAll<HTMLLIElement>('.bbm-ro-thr li')]

  // Sheet (phone) / side card (desktop)
  const sheet = h('aside', 'bbm-sheet')
  sheet.setAttribute('aria-label', 'Flood and tide')
  const narrowNow = () => root.clientWidth > 0 ? root.clientWidth <= 720 : window.innerWidth <= 720
  const head = h('div', 'bbm-sheet-head')
  head.innerHTML = `
    <button class="bbm-grabber" type="button" aria-label="Expand panel" aria-expanded="false"><span></span></button>
    <div class="bbm-head-row">
      <div class="bbm-head-txt"><h2>Flood &amp; tide</h2><p class="bbm-head-sub">Miami · NOAA Virginia Key</p></div>
      <button class="bbm-play" type="button">${ms('play_arrow', 'bbm-play-ic')}<span>Play the storm</span></button>
    </div>`
  const grabber = head.querySelector('.bbm-grabber') as HTMLButtonElement
  const playBtn = head.querySelector('.bbm-play') as HTMLButtonElement
  const headSub = head.querySelector('.bbm-head-sub') as HTMLElement
  const body = h('div', 'bbm-sheet-body')
  const tideSec = h('section', 'bbm-sec bbm-tide', `<div class="bbm-sec-h">${ms('waves')}<h3>Tide</h3><span class="bbm-sec-meta">Virginia Key</span></div><p class="bbm-muted">Loading NOAA tide…</p>`)
  const levelSec = h('section', 'bbm-sec bbm-level')
  levelSec.innerHTML = `
    <div class="bbm-sec-h">${ms('water')}<h3>Water level</h3><output class="bbm-level-out">0.0<small>ft</small></output></div>
    <div class="bbm-range-wrap">
      <input class="bbm-range" type="range" min="0" max="${LEVEL_MAX_FT}" step="${LEVEL_STEP_FT}" value="0" aria-label="Water level in feet above mean lower low water">
      <div class="bbm-range-marks" aria-hidden="true"></div>
    </div>
    <div class="bbm-range-scale"><span>0</span><span>3</span><span>6</span><span>9</span><span>13 ft</span></div>
    <div class="bbm-flood-key"><span>shallow</span><i></i><span>deep</span></div>
    <p class="bbm-fine">Ground elevation from AWS Terrain Tiles (USGS 3DEP, ~33 ft resolution or finer). Illustration, not a flood forecast.</p>`
  const layersSec = h('section', 'bbm-sec bbm-layers')
  layersSec.innerHTML = `
    <div class="bbm-sec-h">${ms('layers')}<h3>Layers</h3></div>
    <div class="bbm-pills" role="group" aria-label="Map layers"></div>
    <div class="bbm-legend">
      <div class="bbm-leg-row"><span class="bbm-leg-k">Evacuation zones</span><ul class="bbm-zone-dots"></ul></div>
      <div class="bbm-leg-row"><span class="bbm-leg-k">311 floods <span class="bbm-count">…</span></span>
        <ul class="bbm-zone-dots"><li><i class="bbm-dot bbm-dot-f"></i>flooding</li><li><i class="bbm-dot bbm-dot-d"></i>drainage</li></ul></div>
    </div>
    <p class="bbm-fine">Planning zones from Miami-Dade; evacuation orders are separate. 311 requests from 2023 whose issue type mentions FLOOD or DRAIN: heat when zoomed out, dots up close (tap one).</p>`
  const srcSec = h('section', 'bbm-sec bbm-sources')
  srcSec.innerHTML = `<p class="bbm-fine bbm-src-tide"></p>
    <p class="bbm-fine">Flood fill: every spot whose ground (USGS 3DEP, NAVD88, which sits ${mToFt(NAVD88_ABOVE_MLLW).toFixed(2)} ft above MLLW at Virginia Key) is lower than the water level turns blue, darker with depth. It ignores drains, seawalls, pumps and timing.</p>`
  const srcTide = srcSec.querySelector('.bbm-src-tide') as HTMLElement
  body.append(tideSec, levelSec, layersSec, srcSec)
  sheet.append(head, body)
  if (mini) root.append(mapEl, zoneChip, status)
  else root.append(mapEl, zoneChip, readout, sheet, status)
  el.appendChild(root)

  const range = levelSec.querySelector('.bbm-range') as HTMLInputElement
  const marks = levelSec.querySelector('.bbm-range-marks') as HTMLElement
  const levelOut = levelSec.querySelector('.bbm-level-out') as HTMLOutputElement
  const countEl = layersSec.querySelector('.bbm-count') as HTMLElement
  const zoneDots = layersSec.querySelector('.bbm-zone-dots') as HTMLElement
  const renderZoneLegend = () => {
    zoneDots.innerHTML = Object.entries(pal.zones).map(([z, c]) => `<li><i style="background:${c}"></i>${z}</li>`).join('')
  }
  renderZoneLegend()

  // ---------- sheet expand / collapse (tap the grabber or drag the header) ----------
  const setCollapsed = (c: boolean) => {
    sheet.classList.toggle('is-collapsed', c)
    grabber.setAttribute('aria-expanded', String(!c))
    grabber.setAttribute('aria-label', c ? 'Expand panel' : 'Collapse panel')
  }
  grabber.addEventListener('click', () => setCollapsed(!sheet.classList.contains('is-collapsed')))
  let dragY: number | null = null
  head.addEventListener('pointerdown', (e) => { if (!(e.target as HTMLElement).closest('.bbm-play')) dragY = e.clientY })
  const onPointerUp = (e: PointerEvent) => {
    if (dragY == null) return
    const dy = e.clientY - dragY
    dragY = null
    if (dy < -24) setCollapsed(false)
    else if (dy > 24) setCollapsed(true)
  }
  window.addEventListener('pointerup', onPointerUp)

  // ---------- layer pills ----------
  type LayerKey = 'zones' | '311' | 'terrain'
  const vis: Record<LayerKey, boolean> = { zones: true, '311': true, terrain: true }
  const layerIds: Record<'zones' | '311', string[]> = { zones: [ids.zoneFill], '311': [ids.heat, ids.dots] }
  const pills = layersSec.querySelector('.bbm-pills') as HTMLElement
  for (const [key, label, icon] of [['zones', 'Zones', 'shield'], ['311', '311 floods', 'water_drop'], ['terrain', 'Terrain', 'landscape']] as const) {
    const b = h('button', 'bbm-pill is-on', `${ms(icon)}<span>${label}</span>`)
    b.type = 'button'
    b.setAttribute('aria-pressed', 'true')
    b.addEventListener('click', () => {
      vis[key] = !vis[key]
      b.classList.toggle('is-on', vis[key])
      b.setAttribute('aria-pressed', String(vis[key]))
      buzz()
      applyVis()
    })
    pills.appendChild(b)
  }
  let terrainWanted = false // 3D terrain switches on the first time the water rises
  const applyVis = () => {
    if (!map || !styleReady) return
    for (const k of ['zones', '311'] as const) {
      for (const id of layerIds[k]) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis[k] ? 'visible' : 'none')
    }
    if (map.getLayer(ids.hill)) map.setLayoutProperty(ids.hill, 'visibility', vis.terrain ? 'visible' : 'none')
    applyTerrain()
  }
  const applyTerrain = () => {
    if (!map || !styleReady || !map.getSource(ids.dem3d)) return
    const want = vis.terrain && terrainWanted
    const has = !!map.getTerrain()
    if (want && !has) map.setTerrain({ source: ids.dem3d, exaggeration: 1.5 })
    else if (!want && has) map.setTerrain(null)
  }

  // ---------- water level ----------
  let level = 0 // metres above MLLW
  let levelFrame = 0
  const applyLevel = () => {
    levelFrame = 0
    if (!map || !styleReady || !map.getLayer(ids.flood)) return
    const on = level >= 0.05
    map.setLayoutProperty(ids.flood, 'visibility', on ? 'visible' : 'none')
    if (on) map.setPaintProperty(ids.flood, 'color-relief-color', floodRamp(level, pal.dark))
  }
  const hitThr = new Set<string>()
  const renderLevel = (m: number, fromSlider: boolean) => {
    level = Math.max(0, Math.min(LEVEL_MAX, m))
    const ft = mToFt(level)
    levelOut.innerHTML = `${ft.toFixed(1)}<small>ft</small>`
    roNum.textContent = ft.toFixed(1)
    range.style.setProperty('--bbm-fill', `${(level / LEVEL_MAX) * 100}%`)
    if (!fromSlider) range.value = String(Math.round(ft * 2) / 2)
    for (const li of roThr) {
      const t = THRESHOLDS.find((x) => x.id === li.dataset.thr)!
      const hit = level >= t.m
      if (hit && !hitThr.has(t.id) && storm) { li.classList.add('is-new'); buzz(); setTimeout(() => li.classList.remove('is-new'), 900) }
      if (hit) hitThr.add(t.id); else hitThr.delete(t.id)
      li.classList.toggle('is-hit', hit)
    }
    if (!levelFrame) levelFrame = requestAnimationFrame(applyLevel)
  }

  let readoutTimer = 0
  const hideReadout = () => { readout.classList.remove('is-on'); root.classList.remove('ro-on') }
  const showReadout = (stage: string, sticky: boolean) => {
    roStage.textContent = stage
    readout.classList.add('is-on')
    root.classList.add('ro-on')
    clearTimeout(readoutTimer)
    if (!sticky) readoutTimer = window.setTimeout(() => hideReadout(), 2200)
  }

  /** First time the water rises: switch on 3D terrain and tilt the camera so the waterfront reads in depth. */
  const firstRise = () => {
    if (terrainWanted) return
    terrainWanted = true
    applyTerrain()
    if (!map || storm) return
    if (map.getPitch() < 30) {
      const cam = { pitch: 55, bearing: -18, zoom: Math.max(map.getZoom(), 12.6) }
      if (reduced()) map.jumpTo(cam); else map.easeTo({ ...cam, duration: 1400 })
    }
  }

  range.addEventListener('input', () => {
    if (storm) stopStorm()
    const m = ftToM(parseFloat(range.value)) // slider is feet; terrain math is metres
    renderLevel(m, true)
    showReadout('Water level', false)
    if (m > 0) firstRise()
  })

  // ---------- Play the storm ----------
  // Timeline: rise, hold so the stage name can be read, rise again. Hold segments have m0 === m1.
  type Seg = { t0: number; t1: number; m0: number; m1: number; label: string }
  let storm: { raf: number; timers: number[]; start: number } | null = null
  let tideData: Tide | null = null
  const setPlayBtn = (playing: boolean, replay = false) => {
    playBtn.classList.toggle('is-playing', playing)
    playBtn.innerHTML = playing
      ? `${ms('stop', 'bbm-play-ic')}<span>Stop</span>`
      : `${ms(replay ? 'replay' : 'play_arrow', 'bbm-play-ic')}<span>${replay ? 'Replay storm' : 'Play the storm'}</span>`
    playBtn.setAttribute('aria-pressed', String(playing))
  }
  const stopStorm = (finished = false) => {
    if (!storm) return
    cancelAnimationFrame(storm.raf)
    for (const t of storm.timers) clearTimeout(t)
    storm = null
    root.classList.remove('is-storm')
    if (!finished) map?.stop()
    setPlayBtn(false, true)
    readoutTimer = window.setTimeout(() => hideReadout(), finished ? 5000 : 1500)
  }
  const playStorm = () => {
    if (storm) { stopStorm(); return }
    if (!map) return
    const hi = nextHighM(tideData)
    const s1 = Math.min(LEVEL_MAX, hi.m + ftToM(3)), s2 = Math.min(LEVEL_MAX, hi.m + ftToM(6))
    const segs: Seg[] = [
      { t0: 0, t1: 2000, m0: 0, m1: hi.m, label: `Rising to ${hi.label.charAt(0).toLowerCase()}${hi.label.slice(1)}` },
      { t0: 2000, t1: 2700, m0: hi.m, m1: hi.m, label: hi.label },
      { t0: 2700, t1: 4900, m0: hi.m, m1: s1, label: 'Storm surge rising' },
      { t0: 4900, t1: 5500, m0: s1, m1: s1, label: 'High tide + 3 ft storm surge' },
      { t0: 5500, t1: 7700, m0: s1, m1: s2, label: 'Storm surge rising' },
      { t0: 7700, t1: 8300, m0: s2, m1: s2, label: 'High tide + 6 ft storm surge' },
    ]
    const last = segs[segs.length - 1]
    hitThr.clear()
    terrainWanted = true
    applyTerrain()
    if (narrowNow()) setCollapsed(true)
    buzz()
    if (reduced()) {
      // No animation: jump straight to the end state.
      map.jumpTo(BEACH)
      renderLevel(last.m1, false)
      showReadout(last.label, false)
      clearTimeout(readoutTimer)
      readoutTimer = window.setTimeout(() => hideReadout(), 6000)
      setPlayBtn(false, true)
      return
    }
    storm = { raf: 0, timers: [], start: performance.now() }
    root.classList.add('is-storm')
    setPlayBtn(true)
    renderLevel(0, false)
    showReadout(segs[0].label, true)
    map.easeTo({ ...BRICKELL, duration: 1700 })
    storm.timers.push(window.setTimeout(() => map?.flyTo({ ...BEACH, duration: 6300, curve: 1.25 }), 1750))
    const tick = (now: number) => {
      if (!storm) return
      const t = now - storm.start
      const seg = segs.find((s) => t < s.t1) ?? last
      const f = Math.max(0, Math.min(1, (t - seg.t0) / (seg.t1 - seg.t0)))
      renderLevel(seg.m0 + (seg.m1 - seg.m0) * easeInOut(f), false)
      if (roStage.textContent !== seg.label) roStage.textContent = seg.label
      if (t >= last.t1) {
        renderLevel(last.m1, false)
        stopStorm(true)
        return
      }
      storm.raf = requestAnimationFrame(tick)
    }
    storm.raf = requestAnimationFrame(tick)
  }
  playBtn.addEventListener('click', playStorm)

  // ---------- map ----------
  // Keep the map sized to its container and keep the camera centre in the part of the map the sheet does not cover.
  let wasNarrow: boolean | null = null
  const fitPadding = () => {
    if (mini) { if (map) { map.resize(); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }) } return }
    const s = sheet.getBoundingClientRect()
    const r = root.getBoundingClientRect()
    const narrow = narrowNow()
    if (narrow !== wasNarrow) { wasNarrow = narrow; setCollapsed(narrow) } // phone starts as a peek; desktop card open
    root.classList.toggle('is-narrow', narrow)
    root.style.setProperty('--bbm-peek', `${head.offsetHeight}px`)
    const coverBottom = narrow ? Math.max(0, Math.round(r.bottom - s.top)) : 0
    root.style.setProperty('--bbm-sheet-h', `${coverBottom}px`)
    if (!map) return
    map.resize()
    map.setPadding(narrow
      ? { top: 56, bottom: coverBottom, left: 0, right: 0 }
      : { top: 0, bottom: 0, left: Math.round(s.right - r.left + 8), right: 0 })
  }
  const ro = new ResizeObserver(() => fitPadding())
  ro.observe(root)
  ro.observe(sheet)
  ro.observe(head)
  sheet.addEventListener('transitionend', fitPadding)

  const setStatus = (msg: string | null) => {
    status.textContent = msg ?? ''
    status.hidden = !msg
  }

  // ---------- data: fetched in parallel with the basemap, pushed into sources once both exist ----------
  let styleReady = false
  let zonesData: GeoJSONData | null = null
  let floodData: GeoJSONData | null = null
  const pushData = () => {
    if (!map || !styleReady || destroyed) return
    if (zonesData) (map.getSource('bbm-zones') as GeoJSONSource | undefined)?.setData(zonesData)
    if (floodData) (map.getSource('bbm-311') as GeoJSONSource | undefined)?.setData(floodData)
  }

  /** Adds every Blackout Box layer to a freshly loaded basemap style. Runs again after a theme swap (setStyle). */
  const onStyle = () => {
    if (!map || destroyed) return
    const m = map
    styleReady = false
    const layers = m.getStyle().layers || []
    const firstSymbol = layers.find((l) => l.type === 'symbol')?.id
    // Flood water goes under the road network so streets stay readable as white/grey lines through the water.
    const firstRoad = layers.find((l) => l.type === 'line' && 'source-layer' in l && (l['source-layer'] === 'transportation' || l['source-layer'] === 'aeroway'))?.id ?? firstSymbol
    const isDarkStyle = !!styleUrl && styleUrl.endsWith('/dark')

    // Basemap tweaks: Apple-style water and black land in Blackout.
    const waterLayers = layers.filter((l): l is FillLayerSpecification => l.type === 'fill' && 'source-layer' in l && l['source-layer'] === 'water')
    for (const wl of waterLayers) m.setPaintProperty(wl.id, 'fill-color', pal.water)
    if (isDarkStyle && pal.bg && m.getLayer('background')) m.setPaintProperty('background', 'background-color', pal.bg)
    if (styleUrl && pal.dark && !isDarkStyle) {
      // Dark mode but the dark style failed: dim the light basemap.
      m.addSource(ids.dim, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } } })
      m.addLayer({ id: ids.dim, type: 'fill', source: ids.dim, paint: { 'fill-color': '#000', 'fill-opacity': 0.6 } }, firstSymbol)
    }

    // Terrain: one DEM source for colour relief + hillshade, a second for 3D terrain (MapLibre advises separate sources).
    try {
      m.addSource(ids.dem, demSource())
      m.addSource(ids.dem3d, demSource())
      m.addLayer({
        id: ids.hill, type: 'hillshade', source: ids.dem,
        paint: {
          'hillshade-exaggeration': 0.35,
          'hillshade-shadow-color': pal.dark ? 'rgba(0,0,0,0.55)' : 'rgba(60,60,67,0.22)',
          'hillshade-highlight-color': pal.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.35)',
          'hillshade-accent-color': pal.dark ? 'rgba(0,0,0,0.25)' : 'rgba(60,60,67,0.1)',
        },
      }, firstRoad)
      m.addLayer({
        id: ids.flood, type: 'color-relief', source: ids.dem, layout: { visibility: 'none' },
        paint: { 'color-relief-color': floodRamp(Math.max(level, 0.1), pal.dark), 'color-relief-opacity': 1 },
      }, firstRoad)
      // Sea and bay keep the basemap's water colour: a copy of the water polygons sits on top of the flood layer,
      // so only land that is below the water level turns blue.
      for (const wl of waterLayers) {
        m.addLayer({ ...wl, id: `${ids.mask}-${wl.id}`, paint: { 'fill-color': pal.water, 'fill-antialias': false } } as FillLayerSpecification, firstRoad)
      }
    } catch (e) {
      console.warn('[map] terrain layers unavailable', e)
      range.disabled = true
    }

    // Buildings: our own fill-extrusion at z14+ (hide the style's own extrusion; stop its flat fill at z14).
    const bLayer = layers.find((l) => 'source-layer' in l && l['source-layer'] === 'building') as { source?: string } | undefined
    if (bLayer?.source) {
      for (const l of layers) {
        if (!('source-layer' in l) || l['source-layer'] !== 'building') continue
        if (l.type === 'fill-extrusion') m.setLayoutProperty(l.id, 'visibility', 'none')
        else if (l.type === 'fill') m.setLayerZoomRange(l.id, l.minzoom ?? 0, 14)
      }
      m.addLayer({
        id: ids.bld, type: 'fill-extrusion', source: bLayer.source, 'source-layer': 'building', minzoom: 14,
        paint: {
          'fill-extrusion-color': pal.bld,
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.6, ['coalesce', ['get', 'render_height'], 0]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': pal.bldOpacity,
          'fill-extrusion-vertical-gradient': true,
        },
      }, firstSymbol)
    }

    // Zones and 311 sources start empty; data fills in as it arrives. Zones sit under the flood.
    m.addSource('bbm-zones', { type: 'geojson', data: zonesData ?? { type: 'FeatureCollection', features: [] } })
    // Fill only: the county's polygons are cut into tiles, so outlines would draw a grid of seams.
    m.addLayer({ id: ids.zoneFill, type: 'fill', source: 'bbm-zones', paint: { 'fill-color': zoneColorExpr(pal.zones, 'rgba(0,0,0,0)'), 'fill-opacity': mini ? (pal.dark ? 0.38 : 0.34) : (pal.dark ? 0.2 : 0.16), 'fill-antialias': false } }, m.getLayer(ids.hill) ? ids.hill : firstRoad)

    m.addSource('bbm-311', { type: 'geojson', data: floodData ?? { type: 'FeatureCollection', features: [] } })
    m.addLayer({
      id: ids.heat, type: 'heatmap', source: 'bbm-311', maxzoom: 16,
      paint: {
        'heatmap-weight': ['case', ['==', ['get', 'flood'], 1], 1, 0.6],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 11, 0.85, 15, 1.8],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 11, 10, 13, 16, 15, 24],
        'heatmap-color': pal.heat,
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.75, 15, 0],
      },
    }, firstSymbol)
    m.addLayer({
      id: ids.dots, type: 'circle', source: 'bbm-311', minzoom: 13,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 17, 6.5],
        'circle-color': ['case', ['==', ['get', 'flood'], 1], pal.flood311, pal.drain311],
        'circle-stroke-color': pal.dotStroke,
        'circle-stroke-width': 1.5,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.95],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1],
      },
    }, firstSymbol)

    styleReady = true
    applyVis()
    applyLevel()
    pushData()
  }

  let clickBound = false
  const bindClicks = (m: MLMap) => {
    if (clickBound) return
    clickBound = true
    // One click handler: a 311 dot wins over the zone polygon under it.
    m.on('click', (e) => {
      const live = [ids.dots, ids.zoneFill].filter((id) => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none')
      const hits = live.length ? m.queryRenderedFeatures(e.point, { layers: live }) : []
      const dot = hits.find((f) => f.layer.id === ids.dots)
      const zone = hits.find((f) => f.layer.id === ids.zoneFill)
      const html = dot ? dotHtml(dot) : zone ? zoneHtml(zone, pal.zones) : null
      popup?.remove()
      if (!html) return
      popup = new Popup({ closeButton: true, maxWidth: '260px', className: 'bbm-popup' }).setLngLat(e.lngLat).setHTML(html).addTo(m)
    })
    for (const id of [ids.dots, ids.zoneFill]) {
      m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', id, () => { m.getCanvas().style.cursor = '' })
    }
  }

  ;(async () => {
    const picked = await pickStyle(dark ? DARK_STYLES : LIGHT_STYLES, signal)
    if (destroyed) return
    if (!picked) setStatus('Basemap unavailable offline. Layers still load from cache when possible.')
    styleUrl = picked?.url ?? null
    const style: StyleSpecification = picked?.style ?? { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': pal.dark ? '#000' : '#F7F7F7' } }] }
    console.info('[map] style', styleUrl ?? 'blank fallback')

    map = new MLMap({
      container: mapEl,
      style,
      center: [opts.lon, opts.lat],
      zoom: 11.6,
      // mini: Downtown, Brickell and Miami Beach in one view
      ...(mini ? { bounds: [[-80.30, 25.70], [-80.11, 25.86]] as [[number, number], [number, number]], fitBoundsOptions: { padding: 0 } } : {}),
      maxPitch: 75,
      interactive: !mini, // mini: no drag / scroll-zoom, so the page keeps scrolling
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    })
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    if (!mini) map.addControl(new ScaleControl({ unit: 'imperial', maxWidth: 90 }), 'bottom-right')
    map.addControl(new NavigationControl(mini ? { showZoom: false, visualizePitch: false } : { visualizePitch: true }), 'top-right')
    map.on('error', (e) => console.warn('[map]', e.error?.message || e))
    // A user drag/zoom during Play the storm stops the camera move only; the water keeps rising.

    const youEl = h('div', 'bbm-you', '<span></span>')
    youEl.setAttribute('role', 'img')
    youEl.setAttribute('aria-label', 'Your location')
    youEl.title = 'Your location'
    marker = new Marker({ element: youEl }).setLngLat([opts.lon, opts.lat]).addTo(map)

    map.once('style.load', () => { if (picked) setStatus(null) })
    // Compact attribution starts expanded; on a phone that is a wall of text over the map. Start it folded.
    map.once('load', () => root.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'))
    map.on('style.load', onStyle)
    if (!mini) bindClicks(map)
    fitPadding()
    ;(root as unknown as { __map?: MLMap }).__map = map // debugging / demo hook on the element only
  })()

  // ---------- Blackout / dark scheme: swap the basemap live ----------
  const onTheme = async () => {
    const d = wantsDark()
    if (d === dark || destroyed) return
    dark = d
    pal = dark ? DARK : LIGHT
    root.dataset.bbmTheme = dark ? 'dark' : 'light'
    renderZoneLegend()
    if (!map) return
    const picked = await pickStyle(dark ? DARK_STYLES : LIGHT_STYLES, signal)
    if (!picked || destroyed || !map || wantsDark() !== dark) return
    styleUrl = picked.url
    styleReady = false
    map.setTerrain(null)
    map.setStyle(picked.style, { diff: false }) // full reload → 'style.load' → onStyle re-adds our layers
  }
  const mo = new MutationObserver(() => void onTheme())
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-mode', 'data-blackout'] })
  const schemeMq = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onScheme = () => void onTheme()
  schemeMq?.addEventListener?.('change', onScheme)

  void loadData()
  async function loadData() {
    const zonesP = loadZones(signal).then((r) => {
      if (destroyed || !r) return
      zonesData = r.data as unknown as GeoJSONData
      pushData()
    })
    const floodP = loadFlood311(opts.apiBase, signal).then((r) => {
      if (destroyed) return
      if (!r) { countEl.textContent = 'unavailable'; return }
      floodData = r.data as unknown as GeoJSONData
      pushData()
      countEl.textContent = `${r.data.features.length.toLocaleString()}${r.stale ? ' · cached' : ''}`
    })
    const tideP = loadTide(opts.apiBase, signal).then((r) => {
      if (destroyed) return
      renderTide(tideSec, r, srcTide)
      tideData = r?.data ?? null
      const hi = nextHighM(tideData)
      headSub.textContent = hi.t ? `Next high ${mToFt(hi.m).toFixed(2)} ft · ${fmtTime(hi.t, true).replace(/^(Today|Tonight) /, '')}` : 'Miami · NOAA Virginia Key'
      // Mark tonight's high and the NWS minor-flood level on the slider track.
      const pct = (m: number) => `${(m / LEVEL_MAX) * 100}%`
      marks.innerHTML = (hi.t ? `<i class="bbm-mark bbm-mark-hi" style="left:${pct(hi.m)}" title="${hi.label}: ${mToFt(hi.m).toFixed(2)} ft"></i>` : '') +
        `<i class="bbm-mark bbm-mark-flood" style="left:${pct(THRESHOLDS[1].m)}" title="NWS minor flood: ${THRESHOLDS[1].ft.toFixed(2)} ft"></i>`
    })
    const zoneP = loadMyZone(opts.apiBase, opts.lat, opts.lon, signal).then((r) => {
      if (destroyed) return
      const span = zoneChip.querySelector('span:last-child') as HTMLElement
      if (!r) { span.textContent = 'Zone unavailable offline'; return }
      const z = r.data
      if (z?.zone) {
        zoneChip.innerHTML = `<i class="bbm-zonedot" style="background:${pal.zones[z.zone] || '#8E8E93'}"></i><span>You are in <b>Zone ${z.zone}</b>${r.stale ? ' <em>· cached</em>' : ''}</span>`
        zoneChip.dataset.zone = z.zone
      } else {
        span.textContent = z ? 'Not in an evacuation zone' : 'Outside Miami-Dade zones'
      }
    })
    const results = await Promise.allSettled([zonesP, floodP, tideP, zoneP])
    for (const res of results) if (res.status === 'rejected' && !destroyed) console.warn('[map] layer load failed', res.reason)
  }

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      if (storm) { cancelAnimationFrame(storm.raf); for (const t of storm.timers) clearTimeout(t); storm = null }
      cancelAnimationFrame(levelFrame)
      abort.abort()
      clearTimeout(readoutTimer)
      ro.disconnect()
      mo.disconnect()
      schemeMq?.removeEventListener?.('change', onScheme)
      window.removeEventListener('pointerup', onPointerUp)
      popup?.remove()
      marker?.remove()
      map?.remove()
      map = null
      root.remove()
    },
  }
}

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

function zoneHtml(f: MapGeoJSONFeature, zones: Record<string, string>): string {
  const z = f.properties?.ZONEID as string | null | undefined
  const cat = f.properties?.CATEGORY
  if (!z) return '<div class="bbm-pop"><b>No evacuation zone</b><small>Miami-Dade HurricaneEvacZone_gdb</small></div>'
  return `<div class="bbm-pop"><b class="bbm-pop-zone"><i style="background:${zones[z] || '#8E8E93'}"></i>Zone ${escHtml(z)}</b>` +
    `${cat != null && cat !== 0 ? `<span>Category ${escHtml(String(cat))}</span>` : ''}` +
    '<small>Planning zone. Check whether this zone was ordered to evacuate.</small></div>'
}

function dotHtml(f: MapGeoJSONFeature): string {
  const t = String(f.properties?.issue_type || '311 request')
  const raw = f.properties?.created
  const d = raw == null || raw === '' ? null : new Date(typeof raw === 'number' || /^\d+$/.test(String(raw)) ? Number(raw) : String(raw))
  const when = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  const addr = f.properties?.address ? escHtml(String(f.properties.address)) : ''
  const st = f.properties?.status ? escHtml(String(f.properties.status).toLowerCase()) : ''
  return `<div class="bbm-pop"><b>${escHtml(t)}</b>${addr ? `<span>${addr}</span>` : ''}` +
    `${when ? `<span>${when}${st ? ` · ${st}` : ''}</span>` : ''}<small>Miami-Dade 311, 2023</small></div>`
}
