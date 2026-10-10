import type { ExpressionSpecification, RasterDEMSourceSpecification } from 'maplibre-gl'

// ---------- Units: the UI is US (feet) everywhere; the terrain math below runs in metres internally. ----------
export const FT_TO_M = 0.3048
export const ftToM = (ft: number) => ft * FT_TO_M
export const mToFt = (m: number) => m / FT_TO_M
/** "2.90 ft" from metres */
export const fmtFt = (m: number, digits = 2) => `${mToFt(m).toFixed(digits)} ft`

// ---------- NOAA CO-OPS datums for Virginia Key 8723214, metres on the station datum (STND) ----------
// Read 2026-10-10 from api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/8723214/datums.json?units=metric
// and .../floodlevels.json?units=metric. Every water level in this UI is metres above MLLW (the tide-table datum).
const STND = { MLLW: 3.089, MHHW: 3.772, NAVD88: 3.703, NWS_MINOR: 4.163, NWS_MODERATE: 4.285, NWS_MAJOR: 4.529 }
const aboveMllw = (stnd: number) => Math.round((stnd - STND.MLLW) * 1000) / 1000

/** NAVD88 sits 0.614 m above MLLW here. The DEM (USGS 3DEP) is in NAVD88, so water level − this = DEM elevation. */
export const NAVD88_ABOVE_MLLW = aboveMllw(STND.NAVD88) // 0.614
/** Mean higher high water: the "typical high tide" fallback when NOAA predictions are unavailable. */
export const MHHW_M = aboveMllw(STND.MHHW) // 0.683

export type Threshold = { id: string; m: number; ft: number; label: string; short: string; note?: string }
/** Thresholds shown on the tide wave, slider and storm readout (ascending). */
export const THRESHOLDS: Threshold[] = [
  // Demo heuristic carried over from the feet version: 2.9 ft MLLW (≈ 0.2 m above MHHW). 2.9 × 0.3048 = 0.88392 m.
  { id: 'king', m: ftToM(2.9), ft: 2.9, label: 'King-tide line', short: 'King tide', note: 'demo heuristic' },
  { id: 'minor', m: aboveMllw(STND.NWS_MINOR), ft: 3.53, label: 'NWS minor flood', short: 'Minor flood' }, // 1.074 m
  { id: 'moderate', m: aboveMllw(STND.NWS_MODERATE), ft: Math.round(mToFt(aboveMllw(STND.NWS_MODERATE)) * 100) / 100, label: 'NWS moderate flood', short: 'Moderate' }, // 1.196 m
  { id: 'major', m: aboveMllw(STND.NWS_MAJOR), ft: Math.round(mToFt(aboveMllw(STND.NWS_MAJOR)) * 100) / 100, label: 'NWS major flood', short: 'Major flood' }, // 1.440 m
]
export const KING_TIDE_M = THRESHOLDS[0].m
export const NWS_MINOR_M = THRESHOLDS[1].m

// ---------- Slider ----------
// ---------- Slider (feet in the UI, metres internally) ----------
export const LEVEL_MAX_FT = 13
export const LEVEL_STEP_FT = 0.5
export const LEVEL_MAX = ftToM(LEVEL_MAX_FT) // metres

// ---------- DEM: AWS Terrain Tiles (Terrarium PNG encoding, public bucket, no key) ----------
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
export const DEM_ATTRIB =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a>: USGS 3DEP, NOAA ETOPO1'
export const demSource = (): RasterDEMSourceSpecification => ({
  type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, maxzoom: 15, encoding: 'terrarium', attribution: DEM_ATTRIB,
})

/**
 * Colour ramp for the `color-relief` flood layer at water level `levelM` (metres above MLLW).
 * Ground below the water surface is painted Apple blue, darker with depth; ground above is transparent.
 * Stops are DEM elevations (NAVD88). MapLibre turns this interpolate into a texture, so swapping it is cheap.
 */
export function floodRamp(levelM: number, dark: boolean): ExpressionSpecification {
  const w = levelM - NAVD88_ABOVE_MLLW // water surface in DEM datum
  const deep = dark ? 'rgba(0,64,221,0.88)' : 'rgba(0,52,190,0.82)'
  const mid = dark ? 'rgba(10,132,255,0.78)' : 'rgba(0,100,240,0.72)'
  const shallow = dark ? 'rgba(64,170,255,0.66)' : 'rgba(10,132,255,0.62)'
  const edge = dark ? 'rgba(100,200,255,0.6)' : 'rgba(40,150,255,0.55)'
  return ['interpolate', ['linear'], ['elevation'],
    w - 3, deep,
    w - 1, mid,
    w - 0.3, shallow,
    w - 0.03, edge,
    w, 'rgba(10,132,255,0)',
  ]
}
