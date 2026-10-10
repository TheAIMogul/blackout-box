// Nearest hurricane shelters from FEMA's ESF#6 Shelter System (formerly NSS), ArcGIS MapServer, no key.
// Layer 0 = shelters open right now; layer 1 = known shelter facilities that are currently closed.
// Miami-Dade's own evacuation-center layers return 0 features outside an activation (checked 2026-10-10).
import { cachedJson } from '../cache.js';

const NSS = 'https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/MapServer';

function miles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

async function layer(id: 0 | 1, lat: number, lon: number) {
  const d = 0.35; // ~24 mi box around the user
  const url = `${NSS}/${id}/query?where=1%3D1&geometry=${lon - d},${lat - d},${lon + d},${lat + d}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=shelter_name,address_1,city,zip,latitude,longitude,shelter_status_code,population_code,facility_usage_code,evacuation_capacity,loc_name&returnGeometry=false&resultRecordCount=500&f=json`;
  const res = await cachedJson<any>(url, { ttlMs: id === 0 ? 10 * 60_000 : 24 * 3600_000 });
  return ((res.body?.features as any[]) || []).map((f) => f.attributes);
}

export async function shelters(lat: number, lon: number, limit = 5) {
  const [open, known] = await Promise.all([layer(0, lat, lon).catch(() => []), layer(1, lat, lon).catch(() => [])]);
  const seen = new Set<string>();
  const rows = [...open.map((a) => ({ a, open: true })), ...known.map((a) => ({ a, open: false }))]
    // drop ZIP-centroid geocodes (e.g. a Homestead school placed downtown); keep street/GPS-located sites
    .filter(({ a }) => typeof a.latitude === 'number' && typeof a.longitude === 'number' && !/zip/i.test(String(a.loc_name || '')))
    .map(({ a, open: isOpen }) => ({
      name: String(a.shelter_name || 'Shelter').trim(),
      address: [a.address_1, a.city, a.zip].filter(Boolean).join(', '),
      lat: a.latitude as number,
      lon: a.longitude as number,
      open: isOpen,
      petFriendly: /PET/i.test(String(a.population_code || '')),
      specialNeeds: /MEDICAL|SPECIAL|SPNS/i.test(String(a.population_code || '') + String(a.facility_usage_code || '')),
      distanceMi: Math.round(miles(lat, lon, a.latitude, a.longitude) * 10) / 10,
    }))
    .filter((s) => {
      const k = s.name.toLowerCase() + '|' + s.address.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    // open shelters first, then nearest
    .sort((x, y) => Number(y.open) - Number(x.open) || x.distanceMi - y.distanceMi);
  return {
    anyOpen: rows.some((s) => s.open),
    shelters: rows.slice(0, limit),
    note: rows.some((s) => s.open)
      ? 'Open now, per FEMA and the American Red Cross.'
      : 'No shelters are open right now. These are known Miami-Dade shelter sites; they open when the county orders an evacuation. Check miamidade.gov or call 311.',
    _source: 'FEMA ESF#6 Shelter System (NSS) via gis.fema.gov',
  };
}
