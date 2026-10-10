// Data loaders for the map tab. Each loader tries the app server first (`apiBase`),
// then the public source directly (all three send `Access-Control-Allow-Origin: *`),
// then the last good copy in Cache Storage so the tab still draws something offline.

export type Pt = { type: 'Point'; coordinates: [number, number] }
export type Feature<G = unknown, P = Record<string, unknown>> = { type: 'Feature'; geometry: G; properties: P }
export type FC<G = unknown, P = Record<string, unknown>> = { type: 'FeatureCollection'; features: Feature<G, P>[] }

export type TidePoint = { t: string; v: number; type?: string }
export type Tide = { station: string; predictions: TidePoint[]; latest: TidePoint | null; _source: string }
export type Zone = { zone: 'A' | 'B' | 'C' | 'D' | 'E' | null; category: number | null; _source: string } | null

export const SOURCES = {
  zones: 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/HurricaneEvacZone_gdb/FeatureServer/0',
  flood311: 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/data_311_2023/FeatureServer/0',
  noaa: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
}

// 311 filter. The 2023 layer is a table (no geometry); points come from its
// `latitude` / `longitude` fields. Field: `issue_type`. Verified 2026-10-10: 2,747 rows across
// DRAIN CLOGGED / CLEANING (1730), FLOODING / STANDING WATER - LOCALIZED (377),
// RER DRAINAGE CANALS FLOOD COMPLAINT (195), DRAIN TOPS CLEANED (187), DRAIN (STORM) MISSING COVER (86),
// DRAIN - REPAIR (85), CAVE - IN NEXT TO DRAIN (72), DRAIN - OBJECT REMOVAL (15).
export const FLOOD_WHERE = "UPPER(issue_type) LIKE '%FLOOD%' OR UPPER(issue_type) LIKE '%DRAIN%'"

const CACHE = 'bb-map-v1'

async function fetchJSON<T>(url: string, signal: AbortSignal, timeoutMs = 15000): Promise<T> {
  const ctl = new AbortController()
  const onAbort = () => ctl.abort()
  signal.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    const type = res.headers.get('content-type') || ''
    if (!type.includes('json')) throw new Error(`not JSON (${type}) ${url}`)
    const body = await res.json()
    if (body && typeof body === 'object' && 'error' in body && !('features' in body) && !('predictions' in body)) {
      throw new Error(`error body ${url}`)
    }
    return body as T
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

async function cachePut(key: string, data: unknown) {
  try {
    if (typeof caches === 'undefined') return
    const c = await caches.open(CACHE)
    await c.put(new Request(`https://bb-map.local/${key}`), new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } }))
  } catch { /* storage blocked: fine */ }
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (typeof caches === 'undefined') return null
    const c = await caches.open(CACHE)
    const r = await c.match(new Request(`https://bb-map.local/${key}`))
    return r ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

/** Run loaders in order; first success is cached. If all fail, return the cached copy (marked stale). */
async function firstOk<T>(key: string, signal: AbortSignal, loaders: Array<() => Promise<T>>): Promise<{ data: T; stale: boolean } | null> {
  for (const load of loaders) {
    if (signal.aborted) return null
    try {
      const data = await load()
      void cachePut(key, data)
      return { data, stale: false }
    } catch (e) {
      if (signal.aborted) return null
      console.debug('[map] loader failed, trying next', key, (e as Error).message)
    }
  }
  const cached = await cacheGet<T>(key)
  return cached ? { data: cached, stale: true } : null
}

const q = (params: Record<string, string | number>) =>
  Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')

// ---------- Evacuation zones (polygons straight from Miami-Dade; there is no server route for polygons) ----------

export async function loadZones(signal: AbortSignal) {
  const page = (offset: number) =>
    fetchJSON<FC & { properties?: { exceededTransferLimit?: boolean } }>(
      `${SOURCES.zones}/query?${q({
        where: '1=1',
        outFields: 'ZONEID,CATEGORY',
        f: 'geojson',
        outSR: 4326,
        geometryPrecision: 5,
        maxAllowableOffset: 0.0001, // ~11 m simplification; ~490 KB for all 2,147 polygons
        orderByFields: 'OBJECTID',
        resultRecordCount: 2000,
        resultOffset: offset,
      })}`,
      signal,
      30000,
    )
  return firstOk<FC>('zones', signal, [
    async () => {
      const features: Feature[] = []
      for (let offset = 0; offset < 20000; offset += 2000) {
        const p = await page(offset)
        features.push(...p.features)
        if (!p.properties?.exceededTransferLimit) break
      }
      if (!features.length) throw new Error('no zone features')
      return { type: 'FeatureCollection', features }
    },
  ])
}

export async function loadMyZone(apiBase: string, lat: number, lon: number, signal: AbortSignal) {
  return firstOk<Zone>(`zone-${lat.toFixed(4)}-${lon.toFixed(4)}`, signal, [
    async () => {
      const r = await fetchJSON<{ zone?: string | null; category?: number | null; inCounty?: boolean; _source?: string }>(
        `${apiBase}/evac-zone?lat=${lat}&lon=${lon}`, signal, 6000)
      if (!('zone' in r)) throw new Error('bad evac-zone shape')
      if (r.inCounty === false) return null // outside the county's mapped area
      return { zone: (r.zone ?? null) as NonNullable<Zone>['zone'], category: r.category ?? null, _source: r._source || 'server /evac-zone' }
    },
    async () => {
      const r = await fetchJSON<{ features: { attributes: { ZONEID: string | null; CATEGORY: number | null } }[] }>(
        `${SOURCES.zones}/query?${q({
          geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: 4326,
          spatialRel: 'esriSpatialRelIntersects', outFields: 'ZONEID,CATEGORY', returnGeometry: 'false', f: 'json',
        })}`, signal, 10000)
      if (!r.features?.length) return null // outside the county's mapped area
      const a = r.features[0].attributes
      return { zone: (a.ZONEID ?? null) as NonNullable<Zone>['zone'], category: a.CATEGORY ?? null, _source: 'Miami-Dade HurricaneEvacZone_gdb' }
    },
  ])
}

// ---------- 311 flooding / drainage ----------

function toPoints(fc: FC): FC<Pt> {
  const out: Feature<Pt>[] = []
  for (const f of fc.features || []) {
    const p = (f.properties || {}) as Record<string, unknown>
    let coords: [number, number] | null = null
    const g = f.geometry as { type?: string; coordinates?: [number, number] } | null
    if (g && g.type === 'Point' && Array.isArray(g.coordinates)) coords = g.coordinates
    else if (typeof p.longitude === 'number' && typeof p.latitude === 'number') coords = [p.longitude, p.latitude]
    if (!coords || Math.abs(coords[1]) < 1 || Math.abs(coords[0]) < 1) continue // drop 0,0 / null rows
    const type = String(p.issue_type ?? p.type ?? '')
    out.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        issue_type: type, flood: /FLOOD/i.test(type) ? 1 : 0, created: p.created ?? p.ticket_created_date_time ?? null,
        address: p.address ?? p.street_address ?? null, status: p.status ?? p.ticket_status ?? null,
      },
    })
  }
  return { type: 'FeatureCollection', features: out }
}

export async function loadFlood311(apiBase: string, signal: AbortSignal) {
  return firstOk<FC<Pt>>('flood311-2023', signal, [
    async () => {
      const fc = await fetchJSON<FC>(`${apiBase}/flood311?year=2023`, signal, 20000)
      if (fc.type !== 'FeatureCollection') throw new Error('bad flood311 shape')
      return toPoints(fc)
    },
    async () => {
      const base = `${SOURCES.flood311}/query`
      const count = await fetchJSON<{ count: number }>(`${base}?${q({ where: FLOOD_WHERE, returnCountOnly: 'true', f: 'json' })}`, signal)
      const pages: Promise<{ features: { attributes: Record<string, unknown> }[] }>[] = []
      for (let off = 0; off < Math.min(count.count, 5000); off += 1000) {
        pages.push(fetchJSON(`${base}?${q({
          where: FLOOD_WHERE, outFields: 'issue_type,latitude,longitude,ticket_created_date_time',
          returnGeometry: 'false', orderByFields: 'ObjectId', resultRecordCount: 1000, resultOffset: off, f: 'json',
        })}`, signal, 30000))
      }
      const rows = (await Promise.all(pages)).flatMap((p) => p.features || [])
      return toPoints({ type: 'FeatureCollection', features: rows.map((r) => ({ type: 'Feature', geometry: null, properties: r.attributes })) })
    },
  ])
}

// ---------- NOAA tide, Virginia Key 8723214 ----------

function ymdInMiami(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return parts.replace(/-/g, '')
}

/** Wall-clock time in Miami as "YYYY-MM-DD HH:MM", the format NOAA returns for time_zone=lst_ldt. */
function miamiWall(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`
}

const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v)))

export async function loadTide(apiBase: string, signal: AbortSignal, station = '8723214') {
  let shortServer: Tide | null = null
  return firstOk<Tide>(`tide-${station}`, signal, [
    async () => {
      const r = await fetchJSON<{ station?: string; predictions?: { t: string; v: string | number; type?: string }[]; latest?: { t: string; v: string | number } | null; _source?: string }>(
        `${apiBase}/tide?station=${station}`, signal, 8000)
      if (!Array.isArray(r.predictions)) throw new Error('bad tide shape')
      const predictions = r.predictions.map((p) => ({ t: p.t, v: num(p.v), type: p.type })).sort((a, b) => a.t.localeCompare(b.t))
      // The panel needs the next high; if the server's window ends within 12 h (e.g. it asked NOAA for
      // `date=today`), use NOAA directly for a real 48 h window.
      const tide: Tide = {
        station: r.station || station,
        predictions,
        latest: r.latest ? { t: r.latest.t, v: num(r.latest.v) } : null,
        _source: r._source || 'NOAA CO-OPS via server',
      }
      if (!predictions.length || predictions[predictions.length - 1].t < miamiWall(new Date(Date.now() + 12 * 3600e3))) {
        shortServer = tide // still better than nothing if NOAA is unreachable (offline demo)
        throw new Error('server tide window too short')
      }
      return tide
    },
    async () => {
      // NB: `date=today&range=48` returns only today's 4 hi/lo; `begin_date` + `range=48` returns 48 h.
      const common = { station, datum: 'MLLW', units: 'english', time_zone: 'lst_ldt', format: 'json', application: 'blackout-box' }
      const [pred, wl] = await Promise.all([
        fetchJSON<{ predictions: { t: string; v: string; type: string }[] }>(
          `${SOURCES.noaa}?${q({ ...common, product: 'predictions', interval: 'hilo', begin_date: ymdInMiami(), range: 48 })}`, signal),
        fetchJSON<{ data?: { t: string; v: string }[] }>(`${SOURCES.noaa}?${q({ ...common, product: 'water_level', date: 'latest' })}`, signal)
          .catch(() => ({ data: [] as { t: string; v: string }[] })),
      ])
      if (!pred.predictions?.length) throw new Error('no predictions')
      const last = wl.data?.[wl.data.length - 1]
      return {
        station,
        predictions: pred.predictions.map((p) => ({ t: p.t, v: num(p.v), type: p.type })),
        latest: last && last.v !== '' ? { t: last.t, v: num(last.v) } : null,
        _source: 'NOAA CO-OPS 8723214 Virginia Key',
      }
    },
    async () => {
      if (!shortServer) throw new Error('no server tide')
      return shortServer
    },
  ])
}
