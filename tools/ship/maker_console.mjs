import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { patchMakerConsoleSource } from './maker_console_runtime_patch.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CORE = join(HERE, 'maker_console_core.mjs');
const RUNTIME_DIR = join(ROOT, 'out', 'maker-console-runtime');
const RUNTIME = join(RUNTIME_DIR, 'maker_console_runtime.mjs');

mkdirSync(RUNTIME_DIR, { recursive: true });
const playwrightUrl = import.meta.resolve('playwright');
const source = readFileSync(CORE, 'utf8');
const patched = patchMakerConsoleSource(source, { repoRoot: ROOT, playwrightUrl });
writeFileSync(RUNTIME, patched, 'utf8');

await import(`${pathToFileURL(RUNTIME).href}?run=${Date.now()}`);
