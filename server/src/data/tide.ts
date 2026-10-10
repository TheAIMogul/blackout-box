// NOAA CO-OPS: 48 h high/low predictions (MLLW, feet, local time) + latest observed water level.
import { cachedJson } from '../cache.js';

const BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

export async function tide(station = '8723214') {
  const common = `station=${encodeURIComponent(station)}&datum=MLLW&units=english&time_zone=lst_ldt&format=json&application=BlackoutBox`;
  // date=today ignores range, so ask for 48 h from today's start explicitly (Miami local date).
  const beginDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replaceAll('-', '');
  const [pred, latest] = await Promise.all([
    cachedJson<any>(`${BASE}?${common}&product=predictions&interval=hilo&begin_date=${beginDate}&range=48`, { ttlMs: 6 * 3600_000 }),
    cachedJson<any>(`${BASE}?${common}&product=water_level&date=latest`, { ttlMs: 6 * 60_000 }).catch(() => null),
  ]);
  if (pred.body?.error) throw new Error(`NOAA: ${pred.body.error.message}`);
  const predictions = (pred.body?.predictions || []).map((p: any) => ({ t: p.t, v: Number(p.v), type: p.type as 'H' | 'L' }));
  const d = latest?.body?.data?.[0];
  return {
    station,
    stationName: latest?.body?.metadata?.name ?? null,
    datum: 'MLLW',
    units: 'ft',
    predictions,
    latest: d ? { t: d.t, v: Number(d.v) } : null,
    fetchedAt: pred.fetchedAt,
    _source: 'NOAA CO-OPS api.tidesandcurrents.noaa.gov (predictions hilo + water_level latest)',
  };
}
