// Lazy loader for the shared engine (agent A, modules/four-hour-rule/src/index.ts). Loaded with a dynamic import so
// the server still starts (and type-checks) if the engine is mid-edit; retried at most once a minute.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from './config.js';

export type EngineLimit = Record<string, unknown> | null;
type Engine = {
  limitForMed?: (label: Record<string, unknown>) => EngineLimit;
  classifyFood?: (name: string, opts?: { location?: string | null; opened?: boolean | null }) => string;
};

let engine: Engine | null = null;
let checkedAt = 0;
let lastErr: string | null = null;

export async function loadEngine(): Promise<Engine | null> {
  if (engine || Date.now() - checkedAt < 60_000) return engine;
  checkedAt = Date.now();
  try {
    engine = (await import(pathToFileURL(path.join(REPO_ROOT, 'modules/four-hour-rule/src/index.ts')).href)) as Engine;
    lastErr = null;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
    console.warn(`[engine] not loadable yet: ${lastErr}`);
  }
  return engine;
}
export const engineError = () => lastErr;
