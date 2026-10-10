/// <reference types="vite/client" />
import 'maplibre-gl/dist/maplibre-gl.css'
import './map.css'
import { Map as MLMap, NavigationControl, AttributionControl, Popup, Marker, setWorkerUrl } from 'maplibre-gl'
import type { StyleSpecification, GeoJSONSource, ExpressionSpecification, MapGeoJSONFeature } from 'maplibre-gl'
// MapLibre 6 derives its worker URL from import.meta.url, which breaks once Vite pre-bundles or
// hashes the main file. Point it at the (self-contained) worker file explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { loadZones, loadFlood311, loadTide, loadMyZone } from './data'
import { renderTide } from './tide'

setWorkerUrl(workerUrl)

export type MountOpts = { lat: number; lon: number; apiBase: string }

// Free, keyless vector styles (OpenFreeMap, no API key), tried in order. Light by default (console look);
// the dark style only when the OS asks for dark. A light style used in dark mode gets a dim overlay.
const OFM = 'https://tiles.openfreemap.org/styles'
const LIGHT_STYLES = [`${OFM}/positron`, `${OFM}/liberty`, `${OFM}/bright`, 'https://demotiles.maplibre.org/style.json']
const DARK_STYLES = [`${OFM}/dark`, ...LIGHT_STYLES]

// Miami-Dade's own zone order (COLOR field: A=R, B=O, C=Y, D=G, E=B) in the app's Material tokens.
const ZONE_COLORS: Record<string, string> = { A: '#d93025', B: '#e37400', C: '#f9ab00', D: '#188038', E: '#8ab4f8' }

type Palette = {
  bld: string; water: string; waterDeep: string; zoneNone: string; dotFlood: string; dotDrain: string; dotStroke: string
  heat: ExpressionSpecification; bg?: string; waterFill?: string
}
const LIGHT: Palette = {
  bld: '#dadce0', water: '#1a73e8', waterDeep: '#1a73e8', zoneNone: 'rgba(95,99,104,0.25)',
  dotFlood: '#1a73e8', dotDrain: '#12b5cb', dotStroke: '#ffffff', waterFill: '#d2e3fc',
  heat: ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(26,115,232,0)', 0.15, 'rgba(138,180,248,0.45)', 0.4, '#8ab4f8', 0.65, '#4285f4', 0.85, '#1a73e8', 1, '#174ea6'],
}
const DARK: Palette = {
  bld: '#3c4043', water: '#8ab4f8', waterDeep: '#4285f4', zoneNone: 'rgba(154,160,166,0.3)',
  dotFlood: '#8ab4f8', dotDrain: '#78d9ec', dotStroke: '#202124', bg: '#202124', waterFill: '#1b2a3d',
  heat: ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(138,180,248,0)', 0.15, 'rgba(66,133,244,0.45)', 0.4, '#4285f4', 0.65, '#8ab4f8', 0.85, '#d2e3fc', 1, '#ffffff'],
}

const ms = (name: string) => `<span class="bbm-ms material-symbols-outlined" aria-hidden="true">${name}</span>`

/** Load Material Symbols once if the host page has not (the app shell normally does). */
function ensureSymbolsFont() {
  if (document.querySelector('link[href*="Material+Symbols"]')) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=block'
  document.head.appendChild(l)
}
const zoneColorExpr = (fallback: string): ExpressionSpecification =>
  ['match', ['coalesce', ['get', 'ZONEID'], ''], 'A', ZONE_COLORS.A, 'B', ZONE_COLORS.B, 'C', ZONE_COLORS.C, 'D', ZONE_COLORS.D, 'E', ZONE_COLORS.E, fallback]

type GeoJSONData = Parameters<GeoJSONSource['setData']>[0]

const FT_TO_M = 0.3048

const ids = {
  dim: 'bbm-dim', zoneFill: 'bbm-zone-fill', zoneLine: 'bbm-zone-line', bld: 'bbm-bld', water: 'bbm-water',
  heat: 'bbm-311-heat', dots: 'bbm-311-dots',
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

export function mountMap(el: HTMLElement, opts: MountOpts): { destroy(): void } {
  const abort = new AbortController()
  const signal = abort.signal
  let map: MLMap | null = null
  let popup: Popup | null = null
  let marker: Marker | null = null
  let destroyed = false
  let flewToStreet = false
  const darkMode = !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const pal = darkMode ? DARK : LIGHT
  ensureSymbolsFont()

  // ---------- DOM ----------
  const root = h('div', 'bbm')
  const mapEl = h('div', 'bbm-map')
  const status = h('div', 'bbm-status', 'Loading map…')
  const toggles = h('div', 'bbm-toggles')
  toggles.setAttribute('role', 'group')
  toggles.setAttribute('aria-label', 'Map layers')
  toggles.innerHTML = `<span class="bbm-toggles-label">${ms('layers')}<span>Layers</span></span>`
  const panel = h('aside', 'bbm-panel')
  const sheetBtn = h('button', 'bbm-sheet-btn', `<span class="bbm-grip"></span>${ms('waves')}<span class="bbm-sheet-label">Flood &amp; tide</span><span class="bbm-chev">${ms('expand_more')}</span>`)
  sheetBtn.type = 'button'
  sheetBtn.setAttribute('aria-expanded', 'true')
  const body = h('div', 'bbm-panel-body')
  const tideCard = h('section', 'bbm-card bbm-tide', `<div class="bbm-card-h">${ms('waves')}<span>Tide · Virginia Key</span></div><p class="bbm-muted">Loading NOAA tide…</p>`)
  const floodCard = h('section', 'bbm-card bbm-flood')
  floodCard.innerHTML = `
    <div class="bbm-card-h">${ms('water')}<span>Flood level</span><output class="bbm-flood-out">0 ft</output></div>
    <input class="bbm-range" type="range" min="0" max="12" step="0.5" value="0" aria-label="Water level in feet">
    <div class="bbm-range-scale"><span>0</span><span>3</span><span>6</span><span>9</span><span>12 ft</span></div>
    <p class="bbm-fine">Demo: uniform water level, no terrain. Buildings fill blue from the ground up to this height and tint by the share of the building under water. Visible at street zoom (14+).</p>`
  const legendCard = h('section', 'bbm-card bbm-legend')
  legendCard.innerHTML = `
    <div class="bbm-card-h">${ms('map')}<span>Evacuation zones</span></div>
    <div class="bbm-myzone bbm-muted">Checking your zone…</div>
    <ul class="bbm-swatches">${Object.entries(ZONE_COLORS).map(([z, c]) => `<li><i style="background:${c}"></i>${z}</li>`).join('')}<li><i class="bbm-none"></i>none</li></ul>
    <p class="bbm-fine">Planning zones from Miami-Dade. Orders are separate: check whether your zone was ordered to evacuate. Tap a zone for its letter.</p>
    <div class="bbm-card-h bbm-h2">${ms('water_drop')}<span>311 flooding &amp; drainage, 2023</span><span class="bbm-count bbm-muted">…</span></div>
    <div class="bbm-heatbar"></div>
    <ul class="bbm-swatches bbm-dots"><li><i class="bbm-dot" style="background:${pal.dotFlood}"></i>flooding</li><li><i class="bbm-dot" style="background:${pal.dotDrain}"></i>drainage</li></ul>
    <p class="bbm-fine">Miami-Dade 311 requests where <code>issue_type</code> mentions FLOOD or DRAIN. Heat at city zoom, dots up close (tap one).</p>`
  body.append(tideCard, floodCard, legendCard)
  panel.append(sheetBtn, body)
  root.append(mapEl, toggles, panel, status)
  el.appendChild(root)

  const range = floodCard.querySelector('.bbm-range') as HTMLInputElement
  const out = floodCard.querySelector('.bbm-flood-out') as HTMLOutputElement
  const myZoneEl = legendCard.querySelector('.bbm-myzone') as HTMLElement
  const countEl = legendCard.querySelector('.bbm-count') as HTMLElement

  sheetBtn.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed')
    sheetBtn.setAttribute('aria-expanded', String(!collapsed))
  })

  // ---------- layer toggles ----------
  const vis: Record<'zones' | '311' | 'tide', boolean> = { zones: true, '311': true, tide: true }
  const layerIds: Record<'zones' | '311', string[]> = { zones: [ids.zoneFill, ids.zoneLine], '311': [ids.heat, ids.dots] }
  const applyVis = () => {
    tideCard.hidden = !vis.tide
    if (!map) return
    for (const k of ['zones', '311'] as const) {
      for (const id of layerIds[k]) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis[k] ? 'visible' : 'none')
    }
  }
  for (const [key, label] of [['zones', 'Zones'], ['311', '311 floods'], ['tide', 'Tide']] as const) {
    const b = h('button', 'bbm-chip is-on', `${ms('check')}<span>${label}</span>`)
    b.type = 'button'
    b.setAttribute('aria-pressed', 'true')
    b.addEventListener('click', () => {
      vis[key] = !vis[key]
      b.classList.toggle('is-on', vis[key])
      b.setAttribute('aria-pressed', String(vis[key]))
      applyVis()
    })
    toggles.appendChild(b)
  }

  // ---------- flood slider ----------
  let buildingsOk = false
  const bldColor = pal.bld
  const setLevel = (ft: number) => {
    if (!map || !buildingsOk) return
    const m = ft * FT_TO_M
    const hgt: ExpressionSpecification = ['coalesce', ['get', 'render_height'], 0]
    const waterTop: ExpressionSpecification = ['min', hgt, m]
    // Spec'd effect: a water-blue extrusion from the ground to min(level, building height).
    map.setPaintProperty(ids.water, 'fill-extrusion-height', waterTop)
    // Building sits on top of the water so the two extrusions never share a wall (no z-fighting).
    map.setPaintProperty(ids.bld, 'fill-extrusion-base', waterTop)
    // At street zoom a 2-4 m band is only a few pixels tall, so the rest of the building is also tinted
    // by the share of its height that is under water (height-based color). Fully submerged = solid water.
    map.setPaintProperty(ids.bld, 'fill-extrusion-color', ft > 0
      ? ['interpolate', ['linear'], ['min', 1, ['/', m, ['max', hgt, 0.5]]], 0, bldColor, 1, pal.waterDeep]
      : bldColor)
    map.setLayoutProperty(ids.water, 'visibility', ft > 0 ? 'visible' : 'none')
    if (ft > 0 && !flewToStreet && map.getZoom() < 14) {
      flewToStreet = true
      map.easeTo({ zoom: 16, pitch: 55, bearing: -20, duration: 1400 })
    }
  }
  // Every change re-evaluates building tiles in the worker, so apply at most every ~90 ms while dragging.
  let timer = 0
  range.addEventListener('input', () => {
    const ft = parseFloat(range.value)
    out.textContent = `${ft % 1 ? ft.toFixed(1) : ft} ft`
    range.style.setProperty('--bbm-fill', `${(ft / 12) * 100}%`)
    clearTimeout(timer)
    timer = window.setTimeout(() => setLevel(ft), 90)
  })

  // ---------- map ----------
  // Keep the map sized to its container (the tab may mount while hidden) and keep the camera centre in the
  // part of the map the panel does not cover: right of the side panel on desktop, above the bottom sheet on phones.
  const fitPadding = () => {
    if (!map) return
    map.resize()
    const narrow = root.clientWidth <= 640
    const p = panel.getBoundingClientRect()
    const pad = narrow
      ? { top: 48, bottom: Math.round(p.height), left: 0, right: 0 }
      : { top: 0, bottom: 0, left: 0, right: Math.round(p.width + 56) }
    map.setPadding(pad)
  }
  const ro = new ResizeObserver(() => fitPadding())
  ro.observe(root)
  ro.observe(panel)

  const setStatus = (msg: string | null) => {
    status.textContent = msg ?? ''
    status.hidden = !msg
  }

  ;(async () => {
    const picked = await pickStyle(darkMode ? DARK_STYLES : LIGHT_STYLES, signal)
    if (destroyed) return
    if (!picked) { setStatus('Basemap unavailable offline. Layers below still load from cache when possible.') }
    const style: StyleSpecification = picked?.style ?? { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': pal.bg || '#f8f9fa' } }] }
    console.info('[map] style', picked?.url ?? 'blank fallback')

    map = new MLMap({
      container: mapEl,
      style,
      center: [opts.lon, opts.lat],
      zoom: 11,
      maxPitch: 70,
      attributionControl: false,
    })
    map.addControl(new AttributionControl({ compact: true }), 'bottom-left')
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
    map.on('error', (e) => console.warn('[map]', e.error?.message || e))

    const youEl = h('div', 'bbm-you', '<span></span>')
    youEl.setAttribute('role', 'img')
    youEl.setAttribute('aria-label', 'Your location')
    youEl.title = 'Your location'
    marker = new Marker({ element: youEl }).setLngLat([opts.lon, opts.lat]).addTo(map)

    map.once('style.load', () => { if (picked) setStatus(null) })
    fitPadding()
    if (import.meta.env.DEV) (root as unknown as { __map?: MLMap }).__map = map // debugging hook, dev only
    const onStyle = () => {
      if (!map || destroyed) return
      const m = map
      const layers = m.getStyle().layers || []
      const firstSymbol = layers.find((l) => l.type === 'symbol')?.id

      // Basemap tweaks: tint water so the coast and canals read clearly on a flood map.
      const isDarkStyle = !!picked && picked.url.endsWith('/dark')
      if (picked && pal.waterFill && m.getLayer('water') && (isDarkStyle || picked.url.endsWith('/positron'))) {
        m.setPaintProperty('water', 'fill-color', pal.waterFill)
      }
      if (isDarkStyle && pal.bg && m.getLayer('background')) m.setPaintProperty('background', 'background-color', pal.bg)
      if (picked && darkMode && !isDarkStyle) {
        // Dark mode but the dark style failed: dim the light basemap.
        m.addSource(ids.dim, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } } })
        m.addLayer({ id: ids.dim, type: 'fill', source: ids.dim, paint: { 'fill-color': '#202124', 'fill-opacity': 0.6 } }, firstSymbol)
      }

      // Buildings: find the vector source that carries the OpenMapTiles `building` source-layer.
      const bLayer = layers.find((l) => 'source-layer' in l && l['source-layer'] === 'building') as { source?: string } | undefined
      if (bLayer?.source) {
        buildingsOk = true
        // Hand buildings over to our layers at z14+: hide the style's own extrusion (liberty) and stop its flat
        // footprint fill at z14 (that fill otherwise paints over extrusion roofs).
        for (const l of layers) {
          if (!('source-layer' in l) || l['source-layer'] !== 'building') continue
          if (l.type === 'fill-extrusion') m.setLayoutProperty(l.id, 'visibility', 'none')
          else if (l.type === 'fill') m.setLayerZoomRange(l.id, l.minzoom ?? 0, 14)
        }
        m.addLayer({
          id: ids.bld, type: 'fill-extrusion', source: bLayer.source, 'source-layer': 'building', minzoom: 14,
          paint: {
            'fill-extrusion-color': bldColor,
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': darkMode ? 0.9 : 0.85,
          },
        }, firstSymbol)
        m.addLayer({
          id: ids.water, type: 'fill-extrusion', source: bLayer.source, 'source-layer': 'building', minzoom: 14,
          layout: { visibility: 'none' },
          paint: { 'fill-extrusion-color': pal.water, 'fill-extrusion-height': 0, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.7 },
        }, firstSymbol)
      } else {
        range.disabled = true
        floodCard.querySelector('.bbm-fine')!.textContent = 'Flood slider needs building footprints; this fallback basemap has none.'
      }

      // Zones and 311 sources start empty; data fills in as it arrives. Zones sit under buildings.
      m.addSource('bbm-zones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: ids.zoneFill, type: 'fill', source: 'bbm-zones', paint: { 'fill-color': zoneColorExpr('rgba(0,0,0,0)'), 'fill-opacity': 0.35 } }, m.getLayer(ids.bld) ? ids.bld : firstSymbol)
      m.addLayer({ id: ids.zoneLine, type: 'line', source: 'bbm-zones', paint: { 'line-color': zoneColorExpr(pal.zoneNone), 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.2], 'line-opacity': 0.85 } }, m.getLayer(ids.bld) ? ids.bld : firstSymbol)

      m.addSource('bbm-311', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: ids.heat, type: 'heatmap', source: 'bbm-311', maxzoom: 16,
        paint: {
          'heatmap-weight': ['case', ['==', ['get', 'flood'], 1], 1, 0.6],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 11, 0.85, 15, 1.8],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 11, 10, 13, 16, 15, 24],
          'heatmap-color': pal.heat,
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 15.5, 0],
        },
      }, firstSymbol)
      m.addLayer({
        id: ids.dots, type: 'circle', source: 'bbm-311', minzoom: 13,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 17, 6],
          'circle-color': ['case', ['==', ['get', 'flood'], 1], pal.dotFlood, pal.dotDrain],
          'circle-stroke-color': pal.dotStroke,
          'circle-stroke-width': 1,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.95],
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1],
        },
      }, firstSymbol)
      applyVis()
      setLevel(parseFloat(range.value))

      // One click handler: a 311 dot wins over the zone polygon under it.
      m.on('click', (e) => {
        const live = [ids.dots, ids.zoneFill].filter((id) => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none')
        const hits = live.length ? m.queryRenderedFeatures(e.point, { layers: live }) : []
        const dot = hits.find((f) => f.layer.id === ids.dots)
        const zone = hits.find((f) => f.layer.id === ids.zoneFill)
        const html = dot ? dotHtml(dot) : zone ? zoneHtml(zone) : null
        popup?.remove()
        if (!html) return
        popup = new Popup({ closeButton: true, maxWidth: '260px', className: 'bbm-popup' }).setLngLat(e.lngLat).setHTML(html).addTo(m)
      })
      for (const id of [ids.dots, ids.zoneFill]) {
        m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', id, () => { m.getCanvas().style.cursor = '' })
      }

      styleReady = true
      pushData()
    }
    map.once('style.load', onStyle)
  })()

  // ---------- data: fetched in parallel with the basemap, pushed into sources once both exist ----------
  let styleReady = false
  let zonesData: GeoJSONData | null = null
  let floodData: GeoJSONData | null = null
  function pushData() {
    if (!map || !styleReady || destroyed) return
    if (zonesData) (map.getSource('bbm-zones') as GeoJSONSource | undefined)?.setData(zonesData)
    if (floodData) (map.getSource('bbm-311') as GeoJSONSource | undefined)?.setData(floodData)
  }
  void loadData()

  async function loadData() {
    const zonesP = loadZones(signal).then((r) => {
      if (destroyed || !r) return
      zonesData = r.data as unknown as GeoJSONData
      pushData()
      if (r.stale) legendCard.querySelector('.bbm-card-h span:not(.bbm-ms)')!.textContent = 'Evacuation zones (cached)'
    })
    const floodP = loadFlood311(opts.apiBase, signal).then((r) => {
      if (destroyed) return
      if (!r) { countEl.textContent = 'unavailable'; return }
      floodData = r.data as unknown as GeoJSONData
      pushData()
      countEl.textContent = `${r.data.features.length.toLocaleString()} requests${r.stale ? ' · cached' : ''}`
    })
    const tideP = loadTide(opts.apiBase, signal).then((r) => { if (!destroyed) renderTide(tideCard, r) })
    const zoneP = loadMyZone(opts.apiBase, opts.lat, opts.lon, signal).then((r) => {
      if (destroyed) return
      if (!r) { myZoneEl.textContent = 'Your zone: unavailable offline'; return }
      const z = r.data
      myZoneEl.classList.remove('bbm-muted')
      myZoneEl.innerHTML = !z
        ? `${ms('my_location')}<span>No Miami-Dade zone found for this location.</span>`
        : z.zone
          ? `${ms('my_location')}<span>You are in</span><span class="bbm-zone-chip"><i style="background:${ZONE_COLORS[z.zone] || '#9aa0a6'}"></i>Zone ${z.zone}</span>${r.stale ? ' <span class="bbm-muted">(cached)</span>' : ''}`
          : `${ms('my_location')}<span>Your location is not in an evacuation zone.</span>`
    })
    const results = await Promise.allSettled([zonesP, floodP, tideP, zoneP])
    for (const res of results) if (res.status === 'rejected' && !destroyed) console.warn('[map] layer load failed', res.reason)
  }

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      abort.abort()
      clearTimeout(timer)
      ro.disconnect()
      popup?.remove()
      marker?.remove()
      map?.remove()
      map = null
      root.remove()
    },
  }
}

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

function zoneHtml(f: MapGeoJSONFeature): string {
  const z = f.properties?.ZONEID as string | null | undefined
  const cat = f.properties?.CATEGORY
  if (!z) return '<div class="bbm-pop"><b>No evacuation zone</b><small>Miami-Dade HurricaneEvacZone_gdb</small></div>'
  return `<div class="bbm-pop"><b class="bbm-pop-zone"><i style="background:${ZONE_COLORS[z] || '#9aa0a6'}"></i>Zone ${escHtml(z)}</b>` +
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
