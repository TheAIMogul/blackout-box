// Worker replacement for server/src/config.ts. Same exports; values come from Worker vars/secrets
// (cloudflare:workers env) instead of process.env, and there is no filesystem layout.
import { env as cfEnv } from 'cloudflare:workers';

const env = cfEnv as unknown as Record<string, string | undefined>;
const flag = (v: string | undefined) => v === '1' || v === 'true' || v === 'yes';

/** Port the Express app "listens" on inside the Worker; httpServerHandler routes requests to it. */
export const WORKER_PORT = 3001;

export const SERVER_ROOT = '/bundle/server';
export const REPO_ROOT = '/bundle';
export const CACHE_DIR = '/tmp/blackout-box-cache'; // unused in the Worker (Cache API instead)
export const FIXTURES_DIR = '/bundle/fixtures'; // unused in the Worker (fixtures are bundled)

export const config = {
  port: WORKER_PORT,
  demo: flag(env.DEMO_MODE),
  provider: (env.MODEL_PROVIDER || 'claude').toLowerCase() === 'demo' ? ('demo' as const) : ('claude' as const),
  gateway: {
    accountId: env.CF_ACCOUNT_ID || '',
    token: env.CF_API_TOKEN || '',
    gatewayId: env.CF_GATEWAY_ID || 'default',
  },
  visionModel: env.VISION_MODEL || 'google/gemini-3.5-flash',
  chatModel: env.CHAT_MODEL || 'anthropic/claude-fable-5.1',
  dataGovKey: env.DATA_GOV_API_KEY || '',
  nwsUserAgent: env.NWS_USER_AGENT || 'BlackoutBox (hackathon; blackoutbox.micahberkley.com)',
  modelTimeoutMs: 60_000,
  corsOrigins: (env.CORS_ORIGINS || 'https://blackoutbox.micahberkley.com').split(',').map((s) => s.trim()),
};

export const DEFAULT_LAT = 25.77;
export const DEFAULT_LON = -80.19;
