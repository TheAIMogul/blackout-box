// openFDA drug label storage text, with the cold-chain gotchas:
//  - prefer labels that have storage_and_handling (+AND+_exists_:storage_and_handling), limit=10
//  - skip repackagers (A-S Medication NDC 50090 etc.) whose labels carry no storage text
//  - generic search uses .exact to avoid combination products
//  - fallback storage text: storage_and_handling[0] -> how_supplied[0] from "Store" -> package_label_principal_display_panel[0]
//  - 404 NOT_FOUND = empty result, not an error
import { cachedJson, DAY } from '../cache.js';
import { config } from '../config.js';
import { loadEngine } from '../engine.js';

const BASE = 'https://api.fda.gov/drug/label.json';
const REPACKAGER =
  /A-S Medication|Bryant Ranch|Proficient Rx|NuCare|Preferred Pharmaceuticals|RemedyRepack|Quality Care|PD-Rx|Direct[_ ]Rx|Henry Schein|Asclemed|Lake Erie Medical|Medsource|Aphena|Denton Pharma|Golden State Medical|St\.? Mary'?s Medical|Unit Dose Services|NorthStar|Northwind|Coupler|Clinical Solutions Wholesale|HJ Harkins|Rebel Distributors|Physicians Total Care|Cardinal Health|McKesson|Major Pharmaceuticals/i;

export type Limit = {
  kind: 'hours_above_temp' | 'days_at_room_temp' | 'none';
  hours?: number;
  days?: number;
  maxTempF?: number;
  source: string;
  quote?: string;
};

const term = (field: string, value: string) => `${field}:"${encodeURIComponent(value).replace(/%20/g, '+')}"`;

function storageFrom(r: any): { text: string; field: string } | null {
  const sh = r.storage_and_handling?.[0];
  if (typeof sh === 'string' && /store|°\s*F|refrigerat/i.test(sh)) return { text: sh, field: 'storage_and_handling' };
  const hs = r.how_supplied?.[0];
  if (typeof hs === 'string') {
    const i = hs.search(/\bStor(e|age)\b/);
    if (i >= 0) return { text: hs.slice(i), field: 'how_supplied' };
  }
  const pd = r.package_label_principal_display_panel?.[0];
  if (typeof pd === 'string') {
    const i = pd.search(/\bStore\b/i);
    if (i >= 0) return { text: pd.slice(i), field: 'package_label_principal_display_panel' };
  }
  // Pen products from repackagers often carry storage only in the patient Instructions for Use ("How should I store…").
  for (const field of ['instructions_for_use', 'patient_medication_information', 'information_for_patients'] as const) {
    const v = r[field]?.[0];
    if (typeof v !== 'string') continue;
    const i = v.search(/How (should I|do I) store|\bStore your\b|\bStorage\b/i);
    if (i >= 0 && /°|º|refrigerat/i.test(v.slice(i, i + 800))) return { text: v.slice(i, i + 800), field };
  }
  return null;
}

const isRepackager = (r: any) =>
  REPACKAGER.test((r.openfda?.manufacturer_name || []).join(' ')) ||
  (r.openfda?.product_ndc || r.openfda?.package_ndc || []).some((n: string) => n.startsWith('50090'));

/** Regex-first rule parser. Numbers always come from the quoted label text. Takes the shortest day limit (conservative). */
export function parseLimit(text: string, source: string): { limit: Limit | null; doNotFreeze: boolean; refrigerated: boolean } {
  // Ignore sentences about diluted product, pumps and IV use; they carry shorter limits that do not apply to a pen or vial at home.
  const t = text
    .replace(/\s+/g, ' ')
    .split(/(?<=\.)\s+/)
    .filter((sen) => !/diluted|infusion|pump|reservoir|intravenous|\bIV\b|tubing/i.test(sen))
    .join(' ');
  const temps = [...t.matchAll(/(\d{2,3})\s*[°º˚]\s*F/g)].map((m) => Number(m[1])).filter((n) => n >= 32 && n <= 120);
  // Prefer the label's own allowance phrasing ("for a total of 28 days", "used within 28 days"); else any "N days".
  const phrased = [...t.matchAll(/(?:total of|within|for up to|up to|for)\s+(\d{1,3})\s*days?\b/gi)].map((m) => Number(m[1]));
  const anyDays = [...t.matchAll(/(\d{1,3})\s*days?\b/gi)].map((m) => Number(m[1]));
  const days = (phrased.length ? phrased : anyDays).filter((n) => n >= 1 && n <= 90);
  const doNotFreeze = /do not freeze|don'?t freeze|not be frozen|if it has been frozen/i.test(t);
  const refrigerated =
    /refrigerat/i.test(t) && /36\s*[°º˚]?\s*(F|to|–|-)|\b2\s*[°º˚]\s*(C|to)|in (a|the) refrigerator/i.test(t);
  const maxTempF = temps.length ? Math.max(...temps) : undefined;
  const sentenceWith = (re: RegExp) => t.split(/(?<=\.)\s+/).find((s) => re.test(s))?.slice(0, 400);
  if (days.length && refrigerated) {
    const d = Math.min(...days);
    return {
      limit: { kind: 'days_at_room_temp', days: d, maxTempF, source, quote: sentenceWith(new RegExp(`\\b${d}\\s*days?\\b`, 'i')) },
      doNotFreeze,
      refrigerated,
    };
  }
  if (maxTempF != null) {
    return {
      limit: { kind: 'none', maxTempF, source, quote: sentenceWith(new RegExp(`${maxTempF}\\s*[°º˚]\\s*F`)) },
      doNotFreeze,
      refrigerated,
    };
  }
  return { limit: null, doNotFreeze, refrigerated };
}

async function search(q: string) {
  const key = config.dataGovKey;
  const url = `${BASE}?search=${q}&limit=10`;
  const r = await cachedJson<any>(url, { ttlMs: DAY, okStatuses: [404], headers: key ? { 'X-Api-Key': key } : {} });
  return { results: (r.status === 404 ? [] : r.body?.results || []) as any[], disclaimer: r.body?.meta?.disclaimer as string | undefined, url, fetchedAt: r.fetchedAt };
}

export async function openFdaLabel(qRaw: string) {
  const q = qRaw.trim().replace(/\s+/g, ' ').slice(0, 80);
  const first = q.split(' ')[0];
  const exists = '+AND+_exists_:storage_and_handling';
  const queries = [
    term('openfda.brand_name', q) + exists,
    term('openfda.generic_name.exact', q.toUpperCase()) + exists,
    ...(first !== q ? [term('openfda.brand_name', first) + exists] : []),
    term('openfda.brand_name', q),
    term('openfda.generic_name.exact', q.toUpperCase()),
    term('openfda.generic_name', q),
    ...(first !== q ? [term('openfda.brand_name', first)] : []),
  ];
  let disclaimer: string | undefined;
  const tried: string[] = [];
  const ql = q.toLowerCase();
  // Rank: exact brand or exact generic name first, then names that start with q, then anything else
  // (a plain "amoxicillin" search otherwise returns amoxicillin-clavulanate; "humalog" returns Humalog Mix50/50).
  // A pen / injection on the label must match an injectable product, not the same brand's tablets (Ozempic pen vs oral Ozempic).
  const injectable = /\b(pen|inject|injection|syringe|vial|subcutaneous|kwikpen|solostar|flextouch)\b/i.test(q);
  const routeAdj = (r: any) => {
    if (!injectable) return 0;
    const routes: string[] = (r.openfda?.route || []).map((x: string) => x.toUpperCase());
    if (routes.some((x) => /SUBCUTANEOUS|INTRAMUSCULAR|INTRAVENOUS/.test(x))) return 1.5;
    if (routes.includes('ORAL')) return -2;
    return 0;
  };
  const score = (r: any) => {
    const brands: string[] = (r.openfda?.brand_name || []).map((b: string) => b.toLowerCase());
    const gens: string[] = (r.openfda?.generic_name || []).map((g: string) => g.toLowerCase());
    const adj = routeAdj(r);
    if (brands.includes(ql) || gens.includes(ql)) return 3 + adj;
    if (brands.some((b) => b === first.toLowerCase())) return 2.5 + adj;
    if (brands.some((b) => b.startsWith(ql + ' ') && !/\bmix\b|\band\b/.test(b))) return 2 + adj;
    if (gens.some((g) => g === ql || (g.startsWith(ql) && !/\band\b/.test(g)))) return 2 + adj;
    return 1 + adj;
  };
  type Pick = { r: any; st: { text: string; field: string }; fetchedAt: string; query: string; s: number };
  let fallback = null as Pick | null;
  let chosen = null as Pick | null;
  for (const query of queries) {
    let res;
    try {
      res = await search(query);
    } catch {
      continue;
    }
    tried.push(query);
    disclaimer ??= res.disclaimer;
    // Repackagers are kept only as a lower-ranked choice, and only when their label carries storage text.
    const cands = res.results
      .map((r) => ({ r, st: storageFrom(r), s: score(r) - (isRepackager(r) ? 0.5 : 0) }))
      .filter((c) => c.st)
      .sort((a, b) => b.s - a.s);
    const best = cands[0] ? { r: cands[0].r, st: cands[0].st!, fetchedAt: res.fetchedAt, query, s: cands[0].s } : null;
    if (best && best.s >= 3) {
      chosen = best;
      break;
    }
    if (best && (!fallback || best.s > fallback.s)) fallback = best;
  }
  chosen ??= fallback;
  if (chosen) {
    const { r, st } = chosen;
    const setId = r.set_id ?? null;
    const src = `openFDA drug label set_id ${setId} (effective ${r.effective_time ?? '?'}), field ${st.field}`;
    const parsed = parseLimit(st.text, src);
    // The engine's limitForMed() is the source of truth for the Limit shape; the local regex parser is the fallback.
    const eng = await loadEngine();
    let limit: unknown = parsed.limit;
    let limitBy = 'server-regex';
    if (eng?.limitForMed) {
      try {
        limit = eng.limitForMed({
          storageText: st.text,
          name: q,
          brand: r.openfda?.brand_name?.[0],
          generic: r.openfda?.generic_name?.[0],
          setId: setId ?? undefined,
          effectiveTime: r.effective_time,
          openfda: r.openfda,
        });
        limitBy = 'engine.limitForMed';
      } catch (e) {
        console.warn(`[openfda] limitForMed failed, using regex parser: ${(e as Error).message}`);
      }
    }
    return {
      found: true,
      name: q,
      brand: r.openfda?.brand_name?.[0] ?? null,
      generic: r.openfda?.generic_name?.[0] ?? null,
      manufacturer: r.openfda?.manufacturer_name?.[0] ?? null,
      route: r.openfda?.route?.[0] ?? null,
      setId,
      effectiveTime: r.effective_time ?? null,
      storageField: st.field,
      storageText: st.text.slice(0, 4000),
      limit,
      _limitBy: limitBy,
      doNotFreeze: parsed.doNotFreeze,
      refrigerated: parsed.refrigerated,
      disclaimer: disclaimer ?? 'Do not rely on openFDA to make decisions regarding medical care.',
      fetchedAt: chosen.fetchedAt,
      _query: chosen.query,
      _source: 'openFDA drug label API (api.fda.gov/drug/label.json)',
    };
  }
  return {
    found: false,
    name: q,
    brand: null,
    generic: null,
    setId: null,
    storageText: null,
    limit: null,
    disclaimer: disclaimer ?? 'Do not rely on openFDA to make decisions regarding medical care.',
    _tried: tried.length,
    _source: 'openFDA drug label API (api.fda.gov/drug/label.json)',
  };
}
