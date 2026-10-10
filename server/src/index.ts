// Blackout Box API server (Express 5). Routes and shapes follow CONTRACT.md "Server API".
import cors from 'cors';
import { createHash } from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import { chat, describe, readImage, readLang, translate, visionItems } from './ai.js';
import { config, DEFAULT_LAT, DEFAULT_LON } from './config.js';
import { asDemo, fixture, hasFixture } from './demo.js';
import { HttpError } from './errors.js';
import { femaDeclarations } from './data/fema.js';
import { flood311 } from './data/flood311.js';
import { evacZone, mdcPlaces } from './data/mdc.js';
import { evChargers } from './data/nrel.js';
import { nws } from './data/nws.js';
import { openFdaLabel } from './data/openfda.js';
import { lastPrep, prepBundle } from './data/prep.js';
import { tide } from './data/tide.js';
import { isConfigured, probeModel, providerStatus } from './providers/index.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '25mb' }));

const DEMO = config.demo;
/** Model routes answer from fixtures when DEMO_MODE=1 or MODEL_PROVIDER=demo. */
const DEMO_AI = config.demo || config.provider === 'demo';

function latLon(req: Request) {
  const lat = req.query.lat === undefined ? DEFAULT_LAT : Number(req.query.lat);
  const lon = req.query.lon === undefined ? DEFAULT_LON : Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new HttpError(400, 'BAD_LATLON', 'lat and lon must be valid numbers');
  }
  return { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
}

/* ---------------- health ---------------- */
let online: { value: boolean; at: number } = { value: false, at: 0 };
async function checkOnline(): Promise<boolean> {
  if (Date.now() - online.at < 30_000) return online.value;
  let value = false;
  try {
    const r = await fetch('https://www.gstatic.com/generate_204', { signal: AbortSignal.timeout(2500) });
    value = r.status === 204 || r.ok;
  } catch {
    value = false;
  }
  online = { value, at: Date.now() };
  return value;
}

app.get('/api/health', async (_req, res) => {
  const isOnline = await checkOnline();
  if (DEMO_AI) {
    res.json({ ok: true, online: isOnline, demo: true, provider: 'demo', models: { vision: 'demo', chat: 'demo' }, dataFromFixtures: DEMO, _model: 'demo' });
    return;
  }
  const reachable = isConfigured() ? await Promise.race([probeModel(), new Promise<null>((r) => setTimeout(() => r(null), 20_000))]) : false;
  res.json({
    ok: true,
    online: isOnline,
    demo: false,
    provider: 'claude',
    models: { vision: config.visionModel, chat: config.chatModel },
    configured: isConfigured(),
    modelReachable: reachable,
    gateway: 'Cloudflare AI Gateway',
    ...providerStatus(),
    _model: config.chatModel,
  });
});

/* ---------------- model routes ---------------- */
const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');

app.post('/api/vision/items', async (req, res) => {
  if (DEMO_AI) {
    const { imageBase64 } = readImage(req.body);
    const byImage = `vision-items-${sha1(imageBase64).slice(0, 12)}`;
    const hint = req.body?.hint;
    let out: any;
    if (await hasFixture(byImage)) out = await fixture(byImage);
    else if (hint === 'meds' || hint === 'fridge') out = await fixture(`vision-items-${hint}`);
    else {
      const [f, m] = await Promise.all([fixture('vision-items-fridge'), fixture('vision-items-meds')]);
      out = { ...f, items: [...f.items, ...m.items], hint: 'any' };
    }
    res.json(asDemo(out, 'model'));
    return;
  }
  res.json(await visionItems(req.body));
});

app.post('/api/vision/describe', async (req, res) => {
  if (DEMO_AI) {
    readImage(req.body);
    const lang = readLang(req.body?.lang);
    const all = await fixture<Record<string, any>>('vision-describe');
    res.json(asDemo(all[lang] ?? all.en, 'model'));
    return;
  }
  res.json(await describe(req.body));
});

const words = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2));

app.post('/api/chat', async (req, res) => {
  if (DEMO_AI) {
    const lang = readLang(req.body?.lang);
    const msgs = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const q = String(msgs[msgs.length - 1]?.content ?? '');
    const all = await fixture<Record<string, any[]>>('chat');
    const pool = all[lang]?.length ? all[lang] : all.en;
    const qw = words(q);
    const best = pool
      .map((r) => ({ r, score: [...words(r.question || '')].filter((w) => qw.has(w)).length }))
      .sort((a, b) => b.score - a.score)[0].r;
    res.json(asDemo(best, 'model'));
    return;
  }
  res.json(await chat(req.body, async () => (await lastPrep()) ?? prepBundle(DEFAULT_LAT, DEFAULT_LON)));
});

app.post('/api/translate', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const to = req.body?.to;
  if (to !== 'es' && to !== 'ht') throw new HttpError(400, 'BAD_LANG', 'to must be es or ht');
  if (DEMO_AI) {
    const all = await fixture<Record<string, { source: string; text: string }[]>>('translate');
    const hit = (all[to] || []).find((r) => r.source.trim() === text.trim());
    res.json(asDemo(hit ? { text: hit.text, to, _model: 'demo' } : { text, to, untranslated: true, _model: 'demo' }, 'model'));
    return;
  }
  res.json(await translate(text, to));
});

/* ---------------- data routes ---------------- */
app.get('/api/openfda/label', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) throw new HttpError(400, 'NO_QUERY', 'q (brand or generic name) is required');
  if (DEMO) {
    const all = await fixture<Record<string, any>>('openfda-label');
    const key = Object.keys(all).find((k) => q.toLowerCase().includes(k)) ?? Object.keys(all).find((k) => k.includes(q.toLowerCase().split(' ')[0]));
    res.json(asDemo(key ? all[key] : { found: false, name: q, brand: null, generic: null, setId: null, storageText: null, limit: null, _source: 'openFDA (demo fixture)' }));
    return;
  }
  res.json(await openFdaLabel(q));
});

app.get('/api/nws', async (req, res) => {
  const { lat, lon } = latLon(req);
  res.json(DEMO ? asDemo(await fixture('nws')) : await nws(lat, lon));
});

app.get('/api/evac-zone', async (req, res) => {
  const { lat, lon } = latLon(req);
  res.json(DEMO ? asDemo(await fixture('evac-zone')) : await evacZone(lat, lon));
});

app.get('/api/places', async (req, res) => {
  const { lat, lon } = latLon(req);
  const kind = String(req.query.kind ?? 'power');
  if (!['power', 'library', 'fire', 'shelter'].includes(kind)) throw new HttpError(400, 'BAD_KIND', 'kind must be power, library, fire or shelter');
  if (DEMO) {
    res.json(asDemo(await fixture(`places-${kind}`)));
    return;
  }
  res.json(kind === 'power' ? await evChargers(lat, lon) : await mdcPlaces(kind as 'library' | 'fire' | 'shelter', lat, lon));
});

app.get('/api/fema', async (_req, res) => {
  res.json(DEMO ? asDemo(await fixture('fema')) : await femaDeclarations(10));
});

app.get('/api/tide', async (req, res) => {
  const station = String(req.query.station ?? '8723214');
  if (!/^\d{7}$/.test(station)) throw new HttpError(400, 'BAD_STATION', 'station must be a 7-digit NOAA station id');
  res.json(DEMO ? asDemo(await fixture('tide')) : await tide(station));
});

app.get('/api/flood311', async (req, res) => {
  const year = String(req.query.year ?? '2023');
  res.json(DEMO ? asDemo(await fixture('flood311')) : await flood311(year));
});

app.get('/api/prep', async (req, res) => {
  const { lat, lon } = latLon(req);
  res.json(DEMO ? asDemo({ ...(await fixture('prep')), generatedAt: new Date().toISOString() }) : await prepBundle(lat, lon));
});

/* ---------------- errors ---------------- */
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'No such API route')));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  const e = err as { type?: string; status?: number; message?: string };
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body over 25 MB', code: 'BODY_TOO_LARGE' });
    return;
  }
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Body is not valid JSON', code: 'BAD_JSON' });
    return;
  }
  console.error('[server] unhandled', err);
  res.status(500).json({ error: e?.message || 'Internal error', code: 'INTERNAL' });
});

app.listen(config.port, () => {
  console.log(
    `[blackout-box] server on http://localhost:${config.port} demo=${DEMO} provider=${DEMO_AI ? 'demo' : 'claude'} vision=${config.visionModel} chat=${config.chatModel} gateway=${isConfigured() ? 'configured' : 'NOT configured'}`,
  );
});
