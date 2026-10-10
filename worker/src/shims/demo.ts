// Worker replacement for server/src/demo.ts: fixtures/*.json are bundled into the Worker at build time
// (esbuild glob import) instead of read from disk. Same exports and behavior.
import { HttpError } from '../../../server/src/errors.ts';

async function load(name: string): Promise<unknown | undefined> {
  if (!/^[a-z0-9-]+$/i.test(name)) return undefined;
  try {
    return (await import(`../../../fixtures/${name}.json`)).default;
  } catch {
    return undefined;
  }
}

export async function fixture<T = any>(name: string): Promise<T> {
  const data = await load(name);
  if (data === undefined) throw new HttpError(503, 'NO_FIXTURE', `DEMO_MODE: fixture ${name}.json is missing`);
  return structuredClone(data) as T;
}

export async function hasFixture(name: string): Promise<boolean> {
  return (await load(name)) !== undefined;
}

/** Mark a fixture response as demo output so the UI can label it. */
export function asDemo<T extends Record<string, any>>(obj: T, kind: 'model' | 'source' = 'source'): T {
  const out: Record<string, any> = { ...obj };
  if (kind === 'model' || '_model' in out) out._model = 'demo';
  out._demo = true;
  return out as T;
}
