// Miami-Dade County ArcGIS Online (org 8Pc9XBTAsYuxx9Ny): hurricane evacuation zone + "likely has power" places.
import { cachedJson, DAY } from '../cache.js';
import { haversineMi } from './geo.js';

export const MDC = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services';
const EVAC = `${MDC}/HurricaneEvacZone_gdb/FeatureServer/0`;

export type Zone = { zone: 'A' | 'B' | 'C' | 'D' | 'E' | null; category: number | null; color: string | null; inCounty: boolean; fetchedAt: string; _source: string };

export async function evacZone(lat: number, lon: number): Promise<Zone> {
  const url =
    `${EVAC}/query?geometry=${lon}%2C${lat}&geometryType=esriGeometryPoint&inSR=4326` +
    `&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;
  const r = await cachedJson<any>(url, { ttlMs: DAY });
  const feats: any[] = r.body?.features || [];
  const a = feats[0]?.attributes;
  const z = typeof a?.ZONEID === 'string' && /^[A-E]$/.test(a.ZONEID.trim()) ? (a.ZONEID.trim() as Zone['zone']) : null;
  return {
    zone: z,
    category: a ? (a.CATEGORY ?? null) : null,
    color: a?.COLOR ?? null,
    inCounty: feats.length > 0,
    fetchedAt: r.fetchedAt,
    _source: 'Miami-Dade County HurricaneEvacZone_gdb/FeatureServer/0 (ZONEID)',
  };
}

export type Place = { name: string; lat: number; lon: number; address?: string; phone?: string; hours?: string; open24h?: boolean; er?: boolean; distanceMi: number; url?: string };

const LAYERS = {
  hospital: 'Hospital_gdb', // 28 hospitals, EROOM flag, PHONE
  pharmacy: 'GroceryandDrugStores_Open', // county EOC list of open grocery/drug stores (instore_pharmacy, status)
  library: 'Library_gdb',
  fire: 'FireStation_gdb',
  shelter: 'EvacuationCenterShelters_Open',
} as const;
export type MdcKind = keyof typeof LAYERS;

export async function mdcPlaces(kind: MdcKind, lat: number, lon: number, radiusMi = 5) {
  const url =
    `${MDC}/${LAYERS[kind]}/FeatureServer/0/query?where=${encodeURIComponent(kind === 'pharmacy' ? "status='Open' AND instore_pharmacy='Yes' AND remove<>'Yes'" : '1=1')}&geometry=${lon}%2C${lat}&geometryType=esriGeometryPoint` +
    `&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=${radiusMi}&units=esriSRUnit_StatuteMile` +
    `&outFields=*&outSR=4326&f=geojson&resultRecordCount=50`;
  const r = await cachedJson<any>(url, { ttlMs: DAY });
  const features: Place[] = (r.body?.features || [])
    .map((f: any): Place | null => {
      const p = f.properties || {};
      const [x, y] = f.geometry?.coordinates || [p.LON, p.LAT];
      if (typeof x !== 'number' || typeof y !== 'number') return null;
      const name = p.BRANCH || p.NAME || p.store || p.shelter_name || p.SHELTER_NAME || p.name || `${kind} ${p.OBJECTID ?? ''}`.trim();
      const addr = [p.ADDRESS || p.address, p.CITY || p.city || p.grocerycity, p.ZIPCODE || p.zip || p.groceryzip].filter(Boolean).join(', ');
      const hours = [p.WKDAY && p.OPERHOUR ? `${p.WKDAY} ${p.OPERHOUR}` : null, p.WKDAY2 && p.OPERHOUR2 ? `${p.WKDAY2} ${p.OPERHOUR2}` : null]
        .filter(Boolean)
        .join('; ');
      return {
        name: String(name).trim(),
        lat: y,
        lon: x,
        address: addr || undefined,
        phone: p.PHONE || undefined,
        hours: hours || undefined,
        er: kind === 'hospital' ? /^(y|yes|1|true)$/i.test(String(p.EROOM ?? '')) || undefined : undefined,
        url: p.WEBSITE || undefined,
        distanceMi: haversineMi(lat, lon, y, x),
      };
    })
    .filter(Boolean)
    // EROOM is empty for every row in the county layer, so push specialty hospitals (eye, cancer, rehab, psychiatric)
    // behind general hospitals instead.
    .sort((a: Place, b: Place) => {
      const spec = (x: Place) => (kind === 'hospital' && /eye|cancer|rehab|psychiatr|behavioral|surg(ery|ical) center/i.test(x.name) ? 1 : 0);
      return spec(a) - spec(b) || a.distanceMi - b.distanceMi;
    })
    .slice(0, 10);
  return { kind, features, fetchedAt: r.fetchedAt, _source: `Miami-Dade County ${LAYERS[kind]}/FeatureServer/0` };
}
