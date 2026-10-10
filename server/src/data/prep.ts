// The prep bundle the web app stores in IndexedDB for offline use. Each part is fetched independently;
// a failed part becomes null and is listed in `errors` instead of failing the whole bundle.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CACHE_DIR } from '../config.js';
import { femaDeclarations } from './fema.js';
import { evacZone, mdcPlaces } from './mdc.js';
import { nws } from './nws.js';
import { shelters } from './shelters.js';
import { FDA_EMERGENCY_INSULIN, FEMA_REGISTER, FOOD_RULES, STATUTE } from './static.js';
import { tide } from './tide.js';

const settle = async <T>(p: Promise<T>, name: string, errors: Record<string, string>): Promise<T | null> => {
  try {
    return await p;
  } catch (e) {
    errors[name] = e instanceof Error ? e.message : String(e);
    return null;
  }
};

export async function prepBundle(lat: number, lon: number) {
  const errors: Record<string, string> = {};
  // Sequential-ish in two waves to stay light on this machine.
  const [zone, weather, fema, tides] = await Promise.all([
    settle(evacZone(lat, lon), 'zone', errors),
    settle(nws(lat, lon), 'nws', errors),
    settle(femaDeclarations(10), 'fema', errors),
    settle(tide('8723214'), 'tide', errors),
  ]);
  const [hospital, pharmacy, library, fire, shelter] = await Promise.all([
    settle(mdcPlaces('hospital', lat, lon, 10), 'places.hospital', errors),
    settle(mdcPlaces('pharmacy', lat, lon), 'places.pharmacy', errors),
    settle(mdcPlaces('library', lat, lon), 'places.library', errors),
    settle(mdcPlaces('fire', lat, lon), 'places.fire', errors),
    settle(shelters(lat, lon), 'shelters', errors),
  ]);
  const bundle = {
    generatedAt: new Date().toISOString(),
    location: { lat, lon },
    zone,
    nws: weather,
    places: {
      hospital: hospital?.features ?? null,
      pharmacy: pharmacy?.features ?? null,
      library: library?.features ?? null,
      fire: fire?.features ?? null,
      shelter: shelter?.shelters ?? null,
      note: 'Hospitals, open pharmacies, libraries, fire stations and hurricane shelters near you, from Miami-Dade County and FEMA data. Call before you go; hours change after a storm.',
      _source: 'Miami-Dade County Hospital_gdb + GroceryandDrugStores_Open + Library_gdb + FireStation_gdb; FEMA ESF#6 Shelter System (NSS)',
    },
    shelters: shelter,
    fema,
    femaRegister: FEMA_REGISTER,
    tide: tides,
    statute: STATUTE,
    fdaEmergencyInsulin: FDA_EMERGENCY_INSULIN,
    foodRules: FOOD_RULES,
    errors,
    _source: 'Miami-Dade ArcGIS, FEMA NSS shelters, NWS, OpenFEMA, NOAA CO-OPS, FDA, FoodSafety.gov/USDA, flsenate.gov',
  };
  lastBundle = bundle;
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, 'last-prep.json'), JSON.stringify(bundle)).catch(() => undefined);
  return bundle;
}

let lastBundle: unknown = null;

/** Most recent prep bundle (memory, then disk) for chat context injection. */
export async function lastPrep(): Promise<any | null> {
  if (lastBundle) return lastBundle;
  try {
    lastBundle = JSON.parse(await fs.readFile(path.join(CACHE_DIR, 'last-prep.json'), 'utf8'));
  } catch {
    /* none yet */
  }
  return lastBundle;
}
