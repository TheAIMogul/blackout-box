// Records DEMO_MODE fixtures from REAL calls (live keys in env). Usage:
//   npm run record              # everything
//   npm run record -- data ai   # only some steps: data, flood, fda, chat, translate, vision, describe, items
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chat, describe, translate, visionItems } from './ai.js';
import { DEFAULT_LAT, DEFAULT_LON, FIXTURES_DIR, REPO_ROOT } from './config.js';
import { flood311 } from './data/flood311.js';
import { mdcPlaces } from './data/mdc.js';
import { evChargers } from './data/nrel.js';
import { openFdaLabel } from './data/openfda.js';
import { prepBundle } from './data/prep.js';
import { config } from './config.js';
import { probeModel } from './providers/index.js';

const steps = new Set(process.argv.slice(2));
const want = (s: string) => steps.size === 0 || steps.has(s);
const LABEL_PNG = path.resolve(REPO_ROOT, '..', 'reports/decision-models/label.png');

async function save(name: string, data: unknown) {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURES_DIR, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
  console.log(`  wrote fixtures/${name}.json`);
}
async function step(name: string, fn: () => Promise<void>) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`[ok] ${name} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.log(`[FAIL] ${name}: ${e instanceof Error ? e.message : e}`);
  }
}
const recorded = (o: Record<string, unknown>) => ({ ...o, _recordedAt: new Date().toISOString() });

let bundle: any = null;

if (want('data'))
  await step('prep bundle + parts', async () => {
    bundle = await prepBundle(DEFAULT_LAT, DEFAULT_LON);
    await save('prep', recorded(bundle));
    await save('evac-zone', recorded(bundle.zone));
    await save('nws', recorded(bundle.nws));
    await save('fema', recorded(bundle.fema));
    await save('tide', recorded(bundle.tide));
    await save('places-power', recorded(await evChargers(DEFAULT_LAT, DEFAULT_LON)));
    for (const k of ['library', 'fire', 'shelter'] as const) await save(`places-${k}`, recorded(await mdcPlaces(k, DEFAULT_LAT, DEFAULT_LON)));
    if (Object.keys(bundle.errors).length) console.log('  prep part errors:', bundle.errors);
  });

if (want('flood'))
  await step('flood311 2023 (subset)', async () => {
    const fc = await flood311('2023');
    // Keep every flooding/standing-water report plus an even sample of drainage requests, ~1,200 points total.
    const flood = fc.features.filter((f: any) => /FLOOD/i.test(f.properties.issue_type));
    const drain = fc.features.filter((f: any) => !/FLOOD/i.test(f.properties.issue_type));
    const stride = Math.max(1, Math.ceil(drain.length / Math.max(1, 1200 - flood.length)));
    const features = [...flood, ...drain.filter((_: unknown, i: number) => i % stride === 0)];
    await save('flood311', recorded({ ...fc, features, _count: features.length, _subsetOf: fc._count }));
  });

if (want('fda'))
  await step('openFDA labels', async () => {
    const out: Record<string, unknown> = {};
    for (const q of ['Lantus', 'Humalog', 'Trulicity', 'Metformin Hydrochloride', 'Amoxicillin']) {
      const r = await openFdaLabel(q);
      out[q.split(' ')[0].toLowerCase()] = recorded(r);
      console.log(`  ${q}: found=${r.found} limit=${JSON.stringify(r.limit && { kind: (r.limit as any).kind, days: (r.limit as any).days, maxTempF: (r.limit as any).maxTempF })}`);
    }
    await save('openfda-label', out);
  });

const reachable = await probeModel(true);
console.log(`[info] Claude via AI Gateway reachable=${reachable} vision=${config.visionModel} chat=${config.chatModel}`);

if (want('chat'))
  await step('chat en/es/ht', async () => {
    const ctx = bundle ?? JSON.parse(await fs.readFile(path.join(FIXTURES_DIR, 'prep.json'), 'utf8'));
    const qs: Record<string, string[]> = {
      en: ['Am I in an evacuation zone?', 'Where can I charge my phone or find power nearby?', 'My insulin pen has been out of the fridge for 30 hours and it is 84°F inside. Is it still OK?'],
      es: ['¿Estoy en una zona de evacuación?', '¿Dónde puedo cargar mi teléfono cerca de aquí?'],
      ht: ['Èske mwen nan yon zòn evakyasyon?', 'Ki kote mwen ka jwenn kouran pou chaje telefòn mwen?'],
    };
    const out: Record<string, unknown[]> = {};
    for (const [lang, list] of Object.entries(qs)) {
      out[lang] = [];
      for (const question of list) {
        const r = await chat({ lang, messages: [{ role: 'user', content: question }] }, async () => ctx);
        out[lang].push(recorded({ question, ...r }));
        console.log(`  [${lang}] ${question} -> ${r.text.slice(0, 90)}...`);
      }
    }
    await save('chat', out);
  });

if (want('translate'))
  await step('translate es/ht', async () => {
    const sources = [
      'Zone B. Check whether Zone B has been ordered to evacuate (miamidade.gov or 311).',
      'Your fridge has been without power for more than 4 hours. USDA says to discard refrigerated perishable food.',
    ];
    const out: Record<string, unknown[]> = { es: [], ht: [] };
    for (const to of ['es', 'ht'] as const)
      for (const source of sources) {
        const r = await translate(source, to);
        out[to].push(recorded({ source, ...r }));
        console.log(`  [${to}] ${r.text.slice(0, 90)}`);
      }
    await save('translate', out);
  });

const labelB64 = await fs.readFile(LABEL_PNG).then((b) => b.toString('base64')).catch(() => null);

if (want('vision') && labelB64)
  await step('vision/items on label.png', async () => {
    const r = await visionItems({ imageBase64: labelB64, mime: 'image/png', hint: 'meds' });
    const key = createHash('sha1').update(labelB64).digest('hex').slice(0, 12);
    await save(`vision-items-${key}`, recorded({ ...r, _image: 'reports/decision-models/label.png' }));
    console.log('  items:', r.items.map((i) => `${i.name} (${i.category}, ${i.confidence})`).join('; '));
  });

if (want('describe') && labelB64)
  await step('vision/describe on label.png (en + es/ht via P3)', async () => {
    const en = await describe({ imageBase64: labelB64, mime: 'image/png', kind: 'document', lang: 'en' });
    const out: Record<string, unknown> = { en: recorded(en) };
    for (const lang of ['es', 'ht'] as const) {
      const t = await translate(en.text, lang);
      out[lang] = recorded({ ...en, text: t.text, lang, _translatedBy: t._model });
    }
    await save('vision-describe', out);
    console.log('  en:', en.text.slice(0, 120));
  });

if (want('items'))
  await step('vision item lists for the demo script (from the 4-Hour Rule brief fixtures)', async () => {
    // No fridge photo exists on this machine yet; these lists are the brief's demo items mapped to the CONTRACT Item shape.
    const note = 'Item list from specs/four-hour-rule-brief.html DEMO_MODE fixtures (not a live model read). Re-record with a real photo.';
    const fridge = [
      ['2% milk', 'carton', '1 gallon', true, null, 'door', 0.93, 'discard_4h'],
      ['Eggs', 'carton', '12', true, null, 'fridge', 0.95, 'discard_4h'],
      ['Cooked chicken (leftovers)', 'tub', null, true, null, 'fridge', 0.78, 'discard_4h'],
      ['Cheddar cheese block', 'bag', null, true, null, 'fridge', 0.88, 'keep'],
      ['Butter', 'box', null, true, null, 'door', 0.9, 'keep'],
      ['Ketchup', 'bottle', null, true, 'Heinz', 'door', 0.97, 'keep'],
      ['Baby formula (ready-to-feed), opened', 'bottle', null, true, null, 'fridge', 0.7, 'discard_4h'],
      ['Frozen chicken breasts', 'bag', null, false, null, 'freezer', 0.86, 'frozen_refreeze'],
    ].map(([name, container, quantity, opened, brandText, location, confidence, foodClass], i) => ({
      id: `f${i + 1}`, name, category: 'food', container, quantity, opened, brandText, location, confidence, foodClass, source: 'fixture:four-hour-rule-brief',
    }));
    const meds = [
      ['Lantus SoloStar', 'pen', '5 pens', false, 'LANTUS SoloStar insulin glargine injection 100 units/mL', 'shelf', 0.96],
      ['Humalog KwikPen', 'pen', null, true, 'HUMALOG KwikPen insulin lispro injection 100 units/mL', 'shelf', 0.94, 20],
      ['Amoxicillin for oral suspension 250 mg/5 mL', 'bottle', '150 mL', true, 'Amoxicillin for Oral Suspension USP 250 mg/5 mL', 'shelf', 0.9, 10],
      ['Metformin 500 mg tablets', 'bottle', null, true, 'Metformin HCl 500 mg', 'cabinet', 0.92],
    ].map(([name, container, quantity, opened, brandText, location, confidence, openedDaysAgo], i) => ({
      id: `m${i + 1}`, name, category: 'med', container, quantity, opened, brandText, location, confidence,
      ...(openedDaysAgo != null ? { openedDaysAgo } : {}), source: 'fixture:four-hour-rule-brief',
    }));
    await save('vision-items-fridge', { items: fridge, unreadableCount: 0, hint: 'fridge', _model: 'fixture', _note: note });
    await save('vision-items-meds', { items: meds, unreadableCount: 0, hint: 'meds', _model: 'fixture', _note: note });
  });

if (want('health'))
  await step('health snapshot', async () => {
    await save('health', recorded({ ok: true, online: true, demo: false, provider: 'claude', models: { vision: config.visionModel, chat: config.chatModel }, modelReachable: reachable }));
  });
