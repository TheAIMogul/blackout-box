// NREL / NLR Alternative Fuel Stations (developer.nlr.gov; the nrel.gov host timed out this morning). EV chargers = "likely has power".
import { cachedJson, DAY } from '../cache.js';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { haversineMi } from './geo.js';
import type { Place } from './mdc.js';

export async function evChargers(lat: number, lon: number) {
  if (!config.dataGovKey) throw new HttpError(503, 'NO_KEY', 'DATA_GOV_API_KEY is not set (needed for NREL/NLR)');
  const url =
    `https://developer.nlr.gov/api/alt-fuel-stations/v1/nearest.json?latitude=${lat}&longitude=${lon}` +
    `&radius=5&limit=20&fuel_type=ELEC&status=E&access=public`;
  const r = await cachedJson<any>(url, { ttlMs: DAY, headers: { 'X-Api-Key': config.dataGovKey } });
  const features: Place[] = (r.body?.fuel_stations || []).map((s: any) => ({
    name: s.station_name,
    lat: s.latitude,
    lon: s.longitude,
    address: [s.street_address, s.city, s.state, s.zip].filter(Boolean).join(', '),
    phone: s.station_phone || undefined,
    hours: s.access_days_time || undefined,
    open24h: typeof s.access_days_time === 'string' ? /24 hours/i.test(s.access_days_time) : undefined,
    distanceMi: typeof s.distance === 'number' ? Math.round(s.distance * 100) / 100 : haversineMi(lat, lon, s.latitude, s.longitude),
  }));
  features.sort((a, b) => a.distanceMi - b.distanceMi);
  return { kind: 'power' as const, features, total: r.body?.total_results ?? features.length, fetchedAt: r.fetchedAt, _source: 'NREL/NLR Alternative Fuel Stations API (developer.nlr.gov), public EV chargers' };
}
