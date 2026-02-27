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
    // Fix __dirname / __filename for ESM bundles
    js: `#!/usr/bin/env node
import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname_ } from 'path';
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirname_(__filename);
`.trim(),
  },
  logLevel: 'info',
});
