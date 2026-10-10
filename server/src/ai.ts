// The four model jobs (Claude via Cloudflare AI Gateway). Prompts are the verbatim briefs (prompts.ts). Post-processing:
// strip fences, JSON.parse, retry once, validate in code, banned-phrase filter, fixed fallback copy.
import { loadEngine } from './engine.js';
import { HttpError } from './errors.js';
import { callModelJson, ModelResult } from './providers/index.js';
import type { ChatMsg } from './providers/types.js';
import {
  fill,
  P1_VISION_ITEMS_SYSTEM,
  P1_VISION_ITEMS_USER,
  P2_GROUNDED_QA_SYSTEM,
  P2_GROUNDED_QA_USER,
  P3_TRANSLATE_SYSTEM,
  P3_TRANSLATE_USER,
  P4_SCENE_READ_SYSTEM,
  P4_SCENE_READ_USER,
  RETRY_JSON,
  RETRY_JSON_VISION,
} from './prompts.js';
import { FIXED, filterAnswer, filterDescription, filterTranslation, Lang } from './safety.js';

export const meta = (r: ModelResult) => ({ _model: r.model, _provider: r.provider, _latencyMs: r.latencyMs, _fellBack: r.fellBack });

/* ---------- image input ---------- */
export function readImage(body: any): { imageBase64: string; mime: string } {
  let b64 = typeof body?.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  let mime = typeof body?.mime === 'string' && body.mime ? body.mime : 'image/jpeg';
  const m = b64.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) {
    mime = m[1];
    b64 = m[2];
  }
  if (!b64) throw new HttpError(400, 'NO_IMAGE', 'imageBase64 is required');
  if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(mime)) throw new HttpError(400, 'BAD_MIME', `Unsupported mime ${mime}`);
  if (b64.length > 20 * 1024 * 1024) throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Image over 20 MB; resize to a 1280 px long edge');
  return { imageBase64: b64.replace(/\s+/g, ''), mime: mime.replace('image/jpg', 'image/jpeg') };
}

/* ---------- P1: vision -> items ---------- */
const CONTAINERS = ['carton', 'bottle', 'jar', 'bag', 'box', 'tub', 'pen', 'vial', 'blister', 'other'];
const LOCATIONS = ['fridge', 'freezer', 'door', 'shelf', 'cabinet'];
const oneOf = (v: unknown, list: string[]) => (typeof v === 'string' && list.includes(v.toLowerCase()) ? v.toLowerCase() : null);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null);

export type Item = {
  id: string;
  name: string;
  category: 'food' | 'med';
  container: string | null;
  quantity: string | null;
  opened: boolean | null;
  brandText: string | null;
  location: string | null;
  confidence: number;
  foodClass?: string;
  source: string;
};

export async function normalizeItems(raw: unknown, provider: string): Promise<Item[]> {
  const list = Array.isArray(raw) ? raw : [];
  const classify = (await loadEngine())?.classifyFood;
  let f = 0;
  let m = 0;
  const out: Item[] = [];
  for (const x of list.slice(0, 40) as any[]) {
    const name = str(x?.name) || str(x?.brand_text);
    if (!name) continue;
    const kind = typeof x?.category === 'string' ? x.category.toLowerCase() : 'other';
    const category: Item['category'] = kind === 'medication' || kind === 'med' ? 'med' : 'food';
    const confidence = Math.max(0, Math.min(1, Number(x?.confidence) || 0));
    const item: Item = {
      id: category === 'med' ? `m${++m}` : `f${++f}`,
      name,
      category,
      container: oneOf(x?.container, CONTAINERS),
      quantity: str(x?.quantity),
      opened: typeof x?.opened === 'boolean' ? x.opened : null,
      brandText: str(x?.brand_text),
      location: oneOf(x?.location, LOCATIONS),
      confidence,
      source: `vision:${provider}`,
    };
    if (category === 'food') {
      if (kind !== 'food') item.foodClass = 'unknown';
      else if (classify) {
        try {
          item.foodClass = classify(name, { location: item.location, opened: item.opened }) || 'unknown';
        } catch {
          item.foodClass = 'unknown';
        }
      } else if (confidence < 0.5) item.foodClass = 'unknown';
    }
    out.push(item);
  }
  return out;
}

export async function visionItems(body: any) {
  const img = readImage(body);
  const { data, result, retried } = await callModelJson<any>(
    { task: 'vision', system: P1_VISION_ITEMS_SYSTEM, messages: [{ role: 'user', content: P1_VISION_ITEMS_USER }], ...img, maxTokens: 6000 },
    RETRY_JSON_VISION,
  );
  const items = await normalizeItems(data?.items, result.provider);
  return { items, unreadableCount: Number(data?.unreadable_count) || 0, hint: body?.hint ?? 'any', _retried: retried, ...meta(result) };
}

/* ---------- P3: translate ---------- */
const LANG_NAMES: Record<string, string> = { es: 'es', ht: 'ht', en: 'en' };
export function readLang(v: unknown, allowEn = true): Lang {
  if (v === 'es' || v === 'ht' || (allowEn && v === 'en')) return v;
  if (v === undefined || v === null || v === '') return 'en';
  throw new HttpError(400, 'BAD_LANG', 'lang must be en, es or ht');
}

export async function translate(text: string, to: 'es' | 'ht') {
  if (!text?.trim()) throw new HttpError(400, 'NO_TEXT', 'text is required');
  if (text.length > 6000) throw new HttpError(413, 'TEXT_TOO_LONG', 'text over 6000 characters');
  const { data, result } = await callModelJson<any>(
    { task: 'chat', system: fill(P3_TRANSLATE_SYSTEM, { lang: LANG_NAMES[to] }), messages: [{ role: 'user', content: fill(P3_TRANSLATE_USER, { text }) }], maxTokens: 1200 },
    RETRY_JSON,
  );
  const out = typeof data?.text === 'string' ? data.text : '';
  if (!out) throw new HttpError(502, 'MODEL_BAD_JSON', 'Translation reply had no text field');
  const f = filterTranslation(text, out);
  return { text: f.text, to, _filtered: f.filtered || undefined, _filterRule: f.rule, _note: f.filtered ? FIXED.translate_rejected[to] : undefined, ...meta(result) };
}

/* ---------- P4: describe ---------- */
export async function describe(body: any) {
  const img = readImage(body);
  const lang = readLang(body?.lang);
  const kind = ['scene', 'document', 'flood'].includes(body?.kind) ? body.kind : 'scene';
  const { data, result } = await callModelJson<any>(
    { task: 'vision', system: P4_SCENE_READ_SYSTEM, messages: [{ role: 'user', content: P4_SCENE_READ_USER }], ...img, maxTokens: 6000 },
    RETRY_JSON,
  );
  const description = typeof data?.description === 'string' ? data.description : '';
  const filtered = filterDescription(description || FIXED.scene.en, 'en');
  let text = filtered.text;
  let translated: ModelResult | null = null;
  if (lang !== 'en' && text) {
    try {
      const t = await translate(text, lang);
      text = t.text;
      translated = { model: t._model, provider: t._provider, latencyMs: t._latencyMs, text: t.text };
    } catch {
      text = filterDescription(text, lang).text; // keep English if translation fails
    }
  }
  const hazards: string[] = Array.isArray(data?.hazards) ? data.hazards.filter((h: unknown) => typeof h === 'string') : [];
  return {
    text,
    kind,
    lang,
    scene: typeof data?.scene === 'string' ? data.scene : 'other',
    hazards,
    hazardCard: hazards.some((h) => h !== 'none'),
    document: data?.document && typeof data.document === 'object' ? data.document : null,
    confidence: Math.max(0, Math.min(1, Number(data?.confidence) || 0)),
    _filtered: filtered.filtered || undefined,
    _translatedBy: translated ? translated.model : undefined,
    ...meta(result),
    _latencyMs: result.latencyMs + (translated?.latencyMs ?? 0),
  };
}

/* ---------- P2: grounded chat ---------- */
const EMERGENCY = /downed (power )?(wire|line)|power line down|gas (smell|leak)|smell(s)? (of )?gas|chest pain|can'?t breathe|trouble breathing|not breathing|water near (the )?(outlet|electric)|cable caído|olor a gas|dolor (en el|de) pecho|no puede respirar|fil kouran (ki )?tonbe|sant gaz|doulè nan pwatrin|pa ka respire/i;

const RX = {
  places: /where|power|charg|librar|fire ?station|shelter|cool|outlet|plug|d[oó]nde|luz|electric|corriente|cargar|biblioteca|bomber|refugio|kote|kouran|chaje|bibliyot|ponpye|abri/i,
  fema: /fema|insur|aid|assist|claim|help|seguro|ayuda|asistencia|reclam|asirans|èd|sekou/i,
  nws: /weather|hot|heat|temp|rain|storm|forecast|clima|calor|lluvia|tormenta|temperatura|tan an|chal[eè]|lapli|tanp[eè]t/i,
  statute: /refill|pharm|prescri|insur|law|receta|farmac|seguro|ley|famasi|preskripsyon|lwa|renouv/i,
  tide: /tide|flood|water|surge|marea|inund|agua|mare|inond|dlo/i,
};

const top = (arr: unknown, n: number) => (Array.isArray(arr) ? arr.slice(0, n) : arr);

/** P2 keyword router: always zone + food rules + FDA insulin; add the rest by topic; cap ~3,000 tokens. */
export function buildContext(bundle: any, question: string): Record<string, unknown> {
  if (!bundle || typeof bundle !== 'object') return {};
  const looksLikeBundle = 'zone' in bundle || 'places' in bundle || 'foodRules' in bundle;
  if (!looksLikeBundle) return bundle;
  const ctx: Record<string, unknown> = {
    location: bundle.location ?? bundle.profile,
    zone: bundle.zone,
    foodRules: bundle.foodRules,
    fdaEmergencyInsulin: bundle.fdaEmergencyInsulin,
  };
  for (const k of ['items', 'verdicts', 'outage', 'env', 'profile']) if (bundle[k]) ctx[k] = top(bundle[k], 20);
  if (RX.places.test(question) && bundle.places) {
    const p = bundle.places;
    ctx.places = { power: top(p.power, 3), library: top(p.library, 3), fire: top(p.fire, 3), note: p.note, _source: p._source };
  }
  if (RX.fema.test(question)) {
    ctx.fema = bundle.fema ? { ...bundle.fema, declarations: top(bundle.fema.declarations, 3) } : null;
    ctx.femaRegister = bundle.femaRegister;
  }
  if (RX.nws.test(question) && bundle.nws) ctx.nws = { ...bundle.nws, hourly: top(bundle.nws.hourly, 12) };
  if (RX.statute.test(question)) ctx.statute = bundle.statute;
  if (RX.tide.test(question) && bundle.tide) ctx.tide = { ...bundle.tide, predictions: top(bundle.tide.predictions, 4) };
  ctx.generatedAt = bundle.generatedAt;
  return ctx;
}

const NOT_SAVED: Record<Lang, string> = {
  en: 'I do not have that saved on this device. Check again when service returns.',
  es: 'No tengo eso guardado en este dispositivo. Vuelva a consultar cuando regrese el servicio.',
  ht: 'Mwen pa gen sa anrejistre sou aparèy sa a. Tcheke ankò lè sèvis la tounen.',
};

const CONTEXT_CAP = 12_000; // ~3,000 tokens for gemma4:e4b

export function contextJson(ctx: Record<string, unknown>): string {
  let s = JSON.stringify(ctx);
  if (s.length <= CONTEXT_CAP) return s;
  const slim: Record<string, any> = { ...ctx };
  for (const k of ['nws', 'tide', 'fema', 'places', 'verdicts', 'items']) {
    if (s.length <= CONTEXT_CAP) break;
    if (k in slim) {
      if (k === 'nws' && slim.nws) slim.nws = { ...slim.nws, hourly: top(slim.nws.hourly, 3) };
      else delete slim[k];
      s = JSON.stringify(slim);
    }
  }
  return s.length <= CONTEXT_CAP ? s : s.slice(0, CONTEXT_CAP);
}

export async function chat(body: any, fallbackBundle: () => Promise<any>) {
  const lang = readLang(body?.lang);
  const msgs: ChatMsg[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== 'user') throw new HttpError(400, 'NO_QUESTION', 'messages must end with a user message');
  const question = last.content;
  const bundle = body?.context && typeof body.context === 'object' ? body.context : await fallbackBundle();
  const ctx = buildContext(bundle, question);
  const system = fill(P2_GROUNDED_QA_SYSTEM, { lang, context_json: contextJson(ctx) });
  const history = msgs.slice(-7, -1);
  // Gemini and OpenAI-style APIs want the first turn to be the user's.
  while (history.length && history[0].role !== 'user') history.shift();
  const messages: ChatMsg[] = [...history, { role: 'user', content: fill(P2_GROUNDED_QA_USER, { question }) }];

  let answer = '';
  let sources: string[] = [];
  let call911 = EMERGENCY.test(question);
  let result: ModelResult;
  try {
    const r = await callModelJson<any>({ task: 'chat', system, messages, maxTokens: 1200 }, RETRY_JSON);
    result = r.result;
    answer = typeof r.data?.answer === 'string' ? r.data.answer : '';
    sources = Array.isArray(r.data?.sources) ? r.data.sources.filter((s: unknown) => typeof s === 'string').slice(0, 8) : [];
    call911 = call911 || r.data?.call_911 === true;
  } catch (e) {
    if (e instanceof HttpError && e.code === 'MODEL_BAD_JSON') throw new HttpError(502, 'MODEL_BAD_JSON', 'The model did not return a usable answer. Try again.');
    throw e;
  }
  const f = filterAnswer(answer || NOT_SAVED[lang], question, lang);
  return {
    text: f.text,
    lang,
    sources,
    call_911: call911,
    contextKeys: Object.keys(ctx),
    contextSource: body?.context ? 'client' : 'server-prep-bundle',
    _filtered: f.filtered || undefined,
    _filterRule: f.rule,
    ...meta(result),
  };
}
