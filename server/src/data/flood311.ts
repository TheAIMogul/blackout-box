// Miami-Dade 311 service requests, flooding/drainage subset, as GeoJSON points.
// data_311_<year>/FeatureServer/0 is a TABLE (geometryType null): geometry is built from the latitude/longitude fields.
// Filter field: issue_type. 2023 values matched (counts at 11:55 ET Oct 10 2026): DRAIN CLOGGED / CLEANING 1730,
// FLOODING / STANDING WATER - LOCALIZED 377, RER DRAINAGE CANALS FLOOD COMPLAINT 195, DRAIN TOPS CLEANED 187,
// DRAIN (STORM) MISSING COVER 86, DRAIN - REPAIR 85, CAVE - IN NEXT TO DRAIN 72, DRAIN - OBJECT REMOVAL 15.
import { cachedJson, DAY } from '../cache.js';
import { HttpError } from '../errors.js';
import { MDC } from './mdc.js';

export const FLOOD_WHERE = "(UPPER(issue_type) LIKE '%FLOOD%' OR UPPER(issue_type) LIKE '%DRAIN%') AND latitude IS NOT NULL AND longitude IS NOT NULL";
const FIELDS = 'ObjectId,ticket_id,issue_type,ticket_status,ticket_created_date_time,street_address,city,neighborhood_district,latitude,longitude';
const CAP = 5000;
const PAGE = 1000; // layer maxRecordCount

export async function flood311(year: string) {
  if (!/^20\d\d$/.test(year)) throw new HttpError(400, 'BAD_YEAR', 'year must be a 4-digit year like 2023');
  const layer = `${MDC}/data_311_${year}/FeatureServer/0`;
  const features: any[] = [];
  let fetchedAt = '';
  for (let offset = 0; offset < CAP; offset += PAGE) {
    const url =
      `${layer}/query?where=${encodeURIComponent(FLOOD_WHERE)}&outFields=${FIELDS}` +
      `&orderByFields=ObjectId&resultOffset=${offset}&resultRecordCount=${PAGE}&returnGeometry=false&f=json`;
    const r = await cachedJson<any>(url, { ttlMs: DAY, timeoutMs: 45_000 });
    if (r.body?.error) throw new HttpError(502, 'ARCGIS_ERROR', `311 ${year}: ${r.body.error.message || 'ArcGIS error'}`);
    fetchedAt ||= r.fetchedAt;
    const rows: any[] = r.body?.features || [];
    for (const row of rows) {
      const a = row.attributes || {};
      if (typeof a.latitude !== 'number' || typeof a.longitude !== 'number') continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
        properties: {
          id: a.ticket_id,
          issue_type: a.issue_type,
          status: a.ticket_status,
          created: a.ticket_created_date_time ? new Date(a.ticket_created_date_time).toISOString() : null,
          address: a.street_address,
          district: a.neighborhood_district,
        },
      });
      if (features.length >= CAP) break;
    }
    if (rows.length < PAGE || !r.body?.exceededTransferLimit || features.length >= CAP) break;
  }
  return {
    type: 'FeatureCollection' as const,
    features,
    _source: `Miami-Dade 311 data_311_${year}/FeatureServer/0 (table; points from latitude/longitude)`,
    _field: 'issue_type',
    _filter: FLOOD_WHERE,
    _count: features.length,
    _cap: CAP,
    fetchedAt,
  };
}
