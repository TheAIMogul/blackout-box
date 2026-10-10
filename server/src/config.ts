// Central env config. Values are read once at startup; keys are never logged.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');
export const CACHE_DIR = path.join(SERVER_ROOT, '.cache');
export const FIXTURES_DIR = path.join(REPO_ROOT, 'fixtures');

const env = process.env;
const flag = (v: string | undefined) => v === '1' || v === 'true' || v === 'yes';

export const config = {
  port: Number(env.PORT || 3001),
  demo: flag(env.DEMO_MODE),
  /** claude | demo. demo serves model routes from fixtures/ (DEMO_MODE=1 also implies it). */
  provider: (env.MODEL_PROVIDER || 'claude').toLowerCase() === 'demo' ? ('demo' as const) : ('claude' as const),
  gateway: {
    accountId: env.CF_ACCOUNT_ID || '',
    token: env.CF_API_TOKEN || '',
    gatewayId: env.CF_GATEWAY_ID || 'default',
  },
  visionModel: env.VISION_MODEL || 'google/gemini-3.5-flash',
  chatModel: env.CHAT_MODEL || 'anthropic/claude-fable-5.1',
  dataGovKey: env.DATA_GOV_API_KEY || '',
  nwsUserAgent: env.NWS_USER_AGENT || 'BlackoutBox (hackathon)',
  modelTimeoutMs: 60_000,
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim()),
};

export const DEFAULT_LAT = 25.77;
export const DEFAULT_LON = -80.19;
