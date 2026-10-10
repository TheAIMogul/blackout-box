// NWS api.weather.gov: points -> observation stations -> latest observation (degC -> degF) + hourly forecast (degF).
import { cachedJson, DAY } from '../cache.js';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { cToF } from './geo.js';

const H = () => ({ 'User-Agent': config.nwsUserAgent, Accept: 'application/geo+json' });

export async function nws(lat: number, lon: number) {
  const pts = await cachedJson<any>(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { ttlMs: 30 * DAY, headers: H() });
  const props = pts.body?.properties;
  if (!props?.forecastHourly) throw new HttpError(502, 'NWS_NO_GRID', 'NWS points lookup returned no forecast grid for this location');

  const stationsRes = await cachedJson<any>(props.observationStations, { ttlMs: 7 * DAY, headers: H() });
  const stationIds: string[] = (stationsRes.body?.features || []).map((f: any) => f.properties?.stationIdentifier).filter(Boolean);
  const candidates = [...new Set([...stationIds.slice(0, 3), 'KMIA', 'KOPF', 'KHWO'])];

  let obs: { tempF: number | null; heatIndexF: number | null; observedAt: string | null; station: string | null; stationName: string | null } = {
    tempF: null,
    heatIndexF: null,
    observedAt: null,
    station: null,
    stationName: null,
  };
  for (const id of candidates) {
    try {
      const o = await cachedJson<any>(`https://api.weather.gov/stations/${id}/observations/latest`, { ttlMs: 10 * 60_000, headers: H() });
      const p = o.body?.properties;
      const c = p?.temperature?.value;
      if (typeof c !== 'number') continue;
      const hi = p?.heatIndex?.value;
      obs = { tempF: cToF(c), heatIndexF: typeof hi === 'number' ? cToF(hi) : null, observedAt: p.timestamp, station: id, stationName: p.stationName ?? null };
      break;
    } catch {
      /* next station */
    }
  }

  let hourly: { t: string; tempF: number }[] = [];
  try {
    const hr = await cachedJson<any>(props.forecastHourly, { ttlMs: 3600_000, headers: H() });
    hourly = (hr.body?.properties?.periods || []).slice(0, 48).map((p: any) => ({
      t: p.startTime,
      tempF: p.temperatureUnit === 'C' ? cToF(p.temperature) : p.temperature,
    }));
  } catch {
    /* observation alone is still useful */
  }
  if (obs.tempF == null && !hourly.length) throw new HttpError(502, 'NWS_NO_DATA', 'NWS returned no observation and no hourly forecast');
  return { ...obs, hourly, grid: `${props.gridId}/${props.gridX},${props.gridY}`, fetchedAt: new Date().toISOString(), _source: 'NWS api.weather.gov (observations/latest + forecast/hourly)' };
}
