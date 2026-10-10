// Bundles the Worker entry + the unchanged server/src code into dist/worker.js, swapping five server modules
// for Worker versions (see SWAPS). npm packages (express, cors) stay external; wrangler bundles them from
// worker/node_modules with nodejs_compat. Run by wrangler via build.command.
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = path.resolve(here, '../server/src') + path.sep;
const SHIMS = path.join(here, 'src/shims');

/** server/src-relative module (as imported, .js) -> worker shim */
const SWAPS = {
  'config.js': 'config.ts',
  'cache.js': 'cache.ts',
  'demo.js': 'demo.ts',
  'engine.js': 'engine.ts',
  'providers/claude.js': 'claude.ts',
};

const swapPlugin = {
  name: 'server-swaps',
  setup(build) {
    build.onResolve({ filter: /^(\.{1,2}\/.*\.js|node:fs)$/ }, (args) => {
      if (!args.importer.startsWith(SERVER_SRC)) return undefined;
      if (args.path === 'node:fs') {
        return args.importer === path.join(SERVER_SRC, 'data/prep.ts') ? { path: path.join(SHIMS, 'fs-noop.ts') } : undefined;
      }
      const rel = path.relative(SERVER_SRC, path.resolve(path.dirname(args.importer), args.path)).split(path.sep).join('/');
      return SWAPS[rel] ? { path: path.join(SHIMS, SWAPS[rel]) } : undefined;
    });
  },
};

await esbuild.build({
  entryPoints: [path.join(here, 'src/index.ts')],
  outfile: path.join(here, 'dist/worker.js'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  packages: 'external',
  external: ['cloudflare:*', 'node:*'],
  legalComments: 'none',
  logLevel: 'info',
  plugins: [swapPlugin],
});
