import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

// Clean dist/
rmSync(join(root, 'dist'), { recursive: true, force: true });
mkdirSync(join(root, 'dist'), { recursive: true });

await build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/app.js',
  sourcemap: !process.argv.includes('--minify'),
  minify: process.argv.includes('--minify'),
  treeShaking: true,
  external: [
    // Keep native/binary modules external
    '@stoqey/ib',
  ],
  loader: {
    // Allow importing .md files as raw text
    '.md': 'text',
  },
  banner: {
    // Fix __dirname / __filename for ESM bundles. Also load .env here,
    // as the very first thing that runs in the bundle — before any
    // bundled module's top-level code executes (esbuild flattens all
    // modules into this single file in dependency order, and several
    // services eagerly construct singletons — e.g. IBConnection reads
    // getConfig() in its constructor — at module scope well before
    // app.ts's own code runs later in the file). Loading .env any later
    // (e.g. inside app.ts) is too late: those singletons already cached
    // a config built from process.env defaults.
    js: `#!/usr/bin/env node
import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname_ } from 'path';
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirname_(__filename);
try {
  process.loadEnvFile();
} catch {
  // No .env file present — fall back to whatever is already in process.env.
}
`.trim(),
  },
  logLevel: 'info',
});
