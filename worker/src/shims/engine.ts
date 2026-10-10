// Worker replacement for server/src/engine.ts: the engine is bundled statically instead of loaded from disk.
import * as engineModule from '../../../modules/four-hour-rule/src/index.ts';

export type EngineLimit = Record<string, unknown> | null;
type Engine = {
  limitForMed?: (label: Record<string, unknown>) => EngineLimit;
  classifyFood?: (name: string, opts?: { location?: string | null; opened?: boolean | null }) => string;
};

export async function loadEngine(): Promise<Engine | null> {
  return engineModule as unknown as Engine;
}
export const engineError = (): string | null => null;
