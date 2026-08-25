import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { patchMakerConsoleSource } from './maker_console_runtime_patch_v5.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const core = readFileSync(join(HERE, 'maker_console_core.mjs'), 'utf8').replace(/\r\n?/g, '\n');
const patched = patchMakerConsoleSource(core, {
  repoRoot: ROOT,
  playwrightUrl: 'file:///ratpack-test/playwright.mjs'
});

assert.match(patched, /\['widget','plugin'\]\.includes\(prod\.type\)/);
assert.match(patched, /prod\.type === 'plugin' \? \/\\\.streamDeckPlugin\$\/i : \/\\\.icuewidget\$\/i/);
assert.match(patched, /productKindLabel = prod\.type === 'plugin' \? 'Plugin' : 'Widget'/);
assert.match(patched, /exactly one \$\{packageExtension\} required/);
assert.match(patched, /if \(prod\.type === 'widget'\) requiredMetadata\.push\('marketplace_dashboard_sizes'\)/);
assert.equal((patched.match(/prod\.marketplace_dashboard_sizes \|\| \[\]/g) || []).length, 2);
assert.match(patched, /Create \$\{productKindLabel\} draft/);
assert.match(patched, /new RegExp\(`\^\$\{productKindLabel\}\$`,'i'\)/);
assert.match(patched, /deleteConfirmedExistingDraft/);
assert.doesNotMatch(patched, /prod\.type !== 'widget'/);

const temp = join(tmpdir(), `ratpack-maker-console-${process.pid}.mjs`);
try {
  writeFileSync(temp, patched, 'utf8');
  const checked = spawnSync(process.execPath, ['--check', temp], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `${checked.stdout}\n${checked.stderr}`);
} finally {
  rmSync(temp, { force: true });
}

console.log('RAT SHIP MAKER CONSOLE PATCH PASS: widget + Stream Deck plugin runtime');
