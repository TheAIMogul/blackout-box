// "Now" dashboard: current conditions + active warnings for one point, all in metric.
// Sources: NWS alerts + observations, NHC CurrentStorms.json, Open-Meteo (weather, UV, air quality), NOAA tide, Miami-Dade evac zone.
import { cachedJson } from '../cache.js';
import { config } from '../config.js';
import { evacZone } from './mdc.js';
import { nws } from './nws.js';
import { tide } from './tide.js';

const fToC = (f: number | null | undefined) => (typeof f === 'number' ? Math.round(((f - 32) * 5) / 9 * 10) / 10 : null);
const FT_TO_M = 0.3048;
const KT_TO_KMH = 1.852; // NHC JSON `intensity` is knots (Isaias 30 → advisory "35 MPH...55 KM/H")
const MPH_TO_KMH = 1.609344; // NHC JSON `movementSpeed` is mph (Isaias 10 → advisory "10 MPH...17 KM/H")
// NOAA Virginia Key (8723214): NWS minor coastal flood 4.163 − 3.089 = 1.074 m above MLLW (floodlevels/datums, units=metric),
// matching the map; 2.9 ft is our king-tide demo heuristic.
const MINOR_FLOOD_M = 1.07;
const KING_TIDE_M = Math.round(2.9 * FT_TO_M * 100) / 100;

export type Level = 'red' | 'orange' | 'yellow' | 'blue' | 'green';
export type Warning = { level: Level; icon: string; title: string; detail: string; source: string; url?: string; until?: string | null };

function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)));
}

function compass(deg: number) {
  return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(deg / 22.5) % 16];
}

/** NWS heat index categories (°F 80/90/103/125 → °C 27/32/39/52). */
function heatLevel(c: number): { level: Level; label: string } | null {
  if (c >= 52) return { level: 'red', label: 'Extreme danger' };
  if (c >= 39) return { level: 'orange', label: 'Danger' };
  if (c >= 32) return { level: 'yellow', label: 'Extreme caution' };
  if (c >= 27) return { level: 'blue', label: 'Caution' };
  return null;
}

function alertLevel(event: string): Level {
  if (/warning/i.test(event)) return 'red';
  if (/watch/i.test(event)) return 'orange';
  return 'yellow'; // advisories and statements
}

function alertIcon(event: string) {
  if (/hurricane|tropical/i.test(event)) return 'cyclone';
  if (/flood|surge|tide/i.test(event)) return 'flood';
  if (/heat/i.test(event)) return 'thermostat';
  if (/thunder|lightning|tornado/i.test(event)) return 'thunderstorm';
  if (/rip current|surf|marine|small craft/i.test(event)) return 'waves';
  return 'warning';
}

function firstSentence(s: string | null | undefined, max = 220) {
  if (!s) return '';
  let t = s.replace(/\s+/g, ' ').replace(/^\*\s*/, '').trim();
  // NWS bodies read "* WHAT...x. * WHERE...y. * WHEN...z." — lead with WHAT and WHEN.
  const what = t.match(/WHAT\.\.\.(.*?)(?=\s*\*\s*[A-Z ]+\.\.\.|$)/)?.[1];
  const when = t.match(/WHEN\.\.\.(.*?)(?=\s*\*\s*[A-Z ]+\.\.\.|$)/)?.[1];
  if (what) t = [what.trim(), when ? when.trim() : ''].filter(Boolean).join(' ');
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export async function now(lat: number, lon: number) {
  const H = { 'User-Agent': config.nwsUserAgent, Accept: 'application/geo+json' };
  const om = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m,uv_index,weather_code,is_day&hourly=precipitation_probability&forecast_hours=6&daily=sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=America%2FNew_York`;
  const aq = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5&timezone=America%2FNew_York`;

  const [alertsRes, stormsRes, omRes, aqRes, nwsRes, tideRes, zoneRes] = await Promise.all([
    safe(cachedJson<any>(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { ttlMs: 5 * 60_000, headers: H })),
    safe(cachedJson<any>('https://www.nhc.noaa.gov/CurrentStorms.json', { ttlMs: 15 * 60_000, headers: { 'User-Agent': config.nwsUserAgent } })),
    safe(cachedJson<any>(om, { ttlMs: 15 * 60_000 })),
    safe(cachedJson<any>(aq, { ttlMs: 60 * 60_000 })),
    safe(nws(lat, lon)),
    safe(tide('8723214')),
    safe(evacZone(lat, lon)),
  ]);

  const errors: string[] = [];
  const cur = omRes?.body?.current;
  const daily = omRes?.body?.daily;
  if (!cur) errors.push('open-meteo');

  // --- weather (Open-Meteo is metric natively; NWS station temps are converted)
  const nwsTempC = fToC((nwsRes as any)?.tempF);
  const nwsHeatC = fToC((nwsRes as any)?.heatIndexF);
  const sunset = daily?.sunset?.[0] ?? null;
  const sunrise = daily?.sunrise?.[0] ?? null;
  const nowMs = Date.now();
  const sunsetMs = sunset ? Date.parse(sunset + (sunset.length === 16 ? ':00-04:00' : '')) : NaN;
  const daylightLeftMin = Number.isFinite(sunsetMs) ? Math.max(0, Math.round((sunsetMs - nowMs) / 60000)) : null;
  const weather = cur
    ? {
        tempC: nwsTempC ?? cur.temperature_2m,
        feelsLikeC: nwsHeatC ?? cur.apparent_temperature,
        humidity: cur.relative_humidity_2m,
        windKmh: cur.wind_speed_10m,
        gustKmh: cur.wind_gusts_10m,
        uvIndex: cur.uv_index,
        uvMax: daily?.uv_index_max?.[0] ?? null,
        weatherCode: cur.weather_code,
        isDay: cur.is_day === 1,
        highC: daily?.temperature_2m_max?.[0] ?? null,
        lowC: daily?.temperature_2m_min?.[0] ?? null,
        rainChanceNext6h: omRes?.body?.hourly?.precipitation_probability ?? [],
        sunrise,
        sunset,
        daylightLeftMin,
        station: (nwsRes as any)?.station ?? null,
        source: nwsTempC != null ? 'NWS station observation (temperature, heat index) + Open-Meteo (wind, UV, rain, sun)' : 'Open-Meteo',
      }
    : null;

  // --- NWS alerts
  const alerts = ((alertsRes?.body?.features as any[]) || []).map((f) => {
    const p = f.properties || {};
    return {
      id: p.id as string,
      event: p.event as string,
      severity: p.severity as string,
      urgency: p.urgency as string,
      headline: p.headline as string,
      description: firstSentence(p.description),
      instruction: firstSentence(p.instruction),
      onset: p.onset ?? p.effective ?? null,
      ends: p.ends ?? p.expires ?? null,
      areaDesc: p.areaDesc as string,
      url: p['@id'] ?? p.id ?? null,
    };
  });
  if (!alertsRes) errors.push('nws-alerts');

  // --- NHC storms (all basins, nearest first)
  const storms = (((stormsRes?.body?.activeStorms as any[]) || []).map((s) => {
    const sLat = Number(s.latitudeNumeric);
    const sLon = Number(s.longitudeNumeric);
    return {
      id: s.id as string,
      name: s.name as string,
      classification: s.classification as string,
      basin: String(s.id || '').slice(0, 2) === 'al' ? 'Atlantic' : String(s.id || '').slice(0, 2) === 'ep' ? 'Eastern Pacific' : 'Central Pacific',
      windKmh: Math.round(Number(s.intensity) * KT_TO_KMH),
      pressureHpa: Number(s.pressure) || null,
      lat: sLat,
      lon: sLon,
      distanceKm: km(lat, lon, sLat, sLon),
      movement: s.movementSpeed != null ? `${compass(Number(s.movementDir))} ${Math.round(Number(s.movementSpeed) * MPH_TO_KMH)} km/h` : null,
      advisoryUrl: s.publicAdvisory?.url ?? null,
      updated: s.lastUpdate ?? null,
    };
  }) as any[]).sort((a, b) => a.distanceKm - b.distanceKm);
  if (!stormsRes) errors.push('nhc');

  // --- tide (metric)
  const preds = ((tideRes as any)?.predictions || []) as { t: string; v: number; type: string }[];
  const nowLocal = new Date().toLocaleString('sv-SE', { timeZone: 'America/New_York' }).slice(0, 16);
  const nextHigh = preds.find((p) => p.type === 'H' && p.t >= nowLocal) ?? null;
  const tideNow = (tideRes as any)?.latest;
  const tideOut = tideRes
    ? {
        station: 'Virginia Key',
        latestM: tideNow?.v != null ? Math.round(tideNow.v * FT_TO_M * 100) / 100 : null,
        latestAt: tideNow?.t ?? null,
        nextHigh: nextHigh ? { t: nextHigh.t, m: Math.round(nextHigh.v * FT_TO_M * 100) / 100 } : null,
        kingTideM: KING_TIDE_M,
        minorFloodM: MINOR_FLOOD_M,
        kingTide: !!nextHigh && nextHigh.v * FT_TO_M >= KING_TIDE_M,
      }
    : null;
  if (!tideRes) errors.push('noaa-tide');

  const air = aqRes?.body?.current ? { usAqi: aqRes.body.current.us_aqi as number, pm25: aqRes.body.current.pm2_5 as number } : null;
  const zone = zoneRes ? { zone: (zoneRes as any).zone ?? null, category: (zoneRes as any).category ?? null } : null;

  // --- warnings, most severe first
  const warnings: Warning[] = [];
  for (const a of alerts) {
    warnings.push({ level: alertLevel(a.event), icon: alertIcon(a.event), title: a.event, detail: a.description || a.headline, source: 'National Weather Service', url: a.url ?? undefined, until: a.ends });
  }
  for (const s of storms.filter((x) => x.basin === 'Atlantic' && x.distanceKm <= 1500)) {
    const level: Level = s.distanceKm <= 500 ? 'red' : s.distanceKm <= 1000 ? 'orange' : 'yellow';
    warnings.push({ level, icon: 'cyclone', title: `${s.classification === 'HU' ? 'Hurricane' : s.classification === 'TS' ? 'Tropical Storm' : s.classification === 'TD' ? 'Tropical Depression' : s.classification === 'PTC' ? 'Post-Tropical Cyclone' : 'Storm'} ${s.name}`, detail: `${s.distanceKm.toLocaleString('en-US')} km away · winds ${s.windKmh} km/h${s.movement ? ` · moving ${s.movement}` : ''}`, source: 'National Hurricane Center', url: s.advisoryUrl ?? undefined, until: null });
  }
  const feels = weather?.feelsLikeC;
  const heat = typeof feels === 'number' ? heatLevel(feels) : null;
  if (heat && heat.level !== 'blue') {
    warnings.push({ level: heat.level, icon: 'thermostat', title: `Heat: ${heat.label}`, detail: `Feels like ${Math.round(feels!)} °C. Without power, move to a cool place and drink water often.`, source: 'NWS heat index categories', until: null });
  }
  if (weather && typeof weather.uvIndex === 'number' && weather.uvIndex >= 6) {
    const lvl: Level = weather.uvIndex >= 11 ? 'red' : weather.uvIndex >= 8 ? 'orange' : 'yellow';
    warnings.push({ level: lvl, icon: 'wb_sunny', title: `UV ${weather.uvIndex >= 11 ? 'extreme' : weather.uvIndex >= 8 ? 'very high' : 'high'} (${Math.round(weather.uvIndex)})`, detail: 'Shade, hat and sunscreen between 10:00 and 16:00.', source: 'Open-Meteo UV index', until: null });
  }
  if (tideOut?.kingTide && tideOut.nextHigh) {
    warnings.push({ level: 'yellow', icon: 'tsunami', title: 'King tide', detail: `Next high ${tideOut.nextHigh.m.toFixed(2)} m at ${tideOut.nextHigh.t.slice(11)}. Low streets near the bay can flood; don't drive through water.`, source: 'NOAA Virginia Key 8723214', until: tideOut.nextHigh.t });
  }
  if (air && air.usAqi > 100) {
    warnings.push({ level: air.usAqi > 150 ? 'red' : 'orange', icon: 'air', title: `Air quality ${air.usAqi > 150 ? 'unhealthy' : 'unhealthy for sensitive groups'}`, detail: `US AQI ${air.usAqi}. Limit time outdoors if you have asthma.`, source: 'Open-Meteo air quality', until: null });
  }
  const rank: Record<Level, number> = { red: 0, orange: 1, yellow: 2, blue: 3, green: 4 };
  warnings.sort((a, b) => rank[a.level] - rank[b.level]);
  const overall: Level = warnings[0]?.level ?? 'green';
  if (!warnings.length) warnings.push({ level: 'green', icon: 'check_circle', title: 'No active warnings', detail: 'Nothing from NWS or NHC for your location right now.', source: 'NWS, NHC', until: null });

  return {
    generatedAt: new Date().toISOString(),
    location: { lat, lon },
    overall,
    weather,
    air,
    tide: tideOut,
    zone,
    alerts,
    storms,
    warnings,
    errors,
    _source: 'NWS alerts + observations, NHC CurrentStorms.json, Open-Meteo, NOAA CO-OPS 8723214, Miami-Dade HurricaneEvacZone_gdb',
  };
}
