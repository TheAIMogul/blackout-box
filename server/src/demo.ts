// DEMO_MODE fixture loader: fixtures/<name>.json, recorded from real calls by `npm run record`.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FIXTURES_DIR } from './config.js';
import { HttpError } from './errors.js';

const mem = new Map<string, unknown>();

export async function fixture<T = any>(name: string): Promise<T> {
  if (mem.has(name)) return structuredClone(mem.get(name)) as T;
  try {
    const data = JSON.parse(await fs.readFile(path.join(FIXTURES_DIR, name + '.json'), 'utf8'));
    mem.set(name, data);
    return structuredClone(data) as T;
  } catch {
    throw new HttpError(503, 'NO_FIXTURE', `DEMO_MODE: fixture ${name}.json is missing`);
  }
}

export async function hasFixture(name: string): Promise<boolean> {
  try {
    await fs.access(path.join(FIXTURES_DIR, name + '.json'));
    return true;
  } catch {
    return false;
  }
}

/** Mark a fixture response as demo output so the UI can label it. */
export function asDemo<T extends Record<string, any>>(obj: T, kind: 'model' | 'source' = 'source'): T {
  const out: Record<string, any> = { ...obj };
  if (kind === 'model' || '_model' in out) out._model = 'demo';
  out._demo = true;
  return out as T;
}
