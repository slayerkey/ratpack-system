import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packagedEntry = process.argv[2];
if (!packagedEntry) throw new Error('packaged index.html path is required');
const html = await readFile(packagedEntry, 'utf8');
if (!html.includes('PackRatPowerMath')) throw new Error('packaged widget is missing the inlined power math core');
if (!html.includes('PC POWER METER')) throw new Error('packaged widget is missing the power meter UI');
if (/src=["']\.\.\//i.test(html) || /href=["']\.\.\/\.\.\/_shared/i.test(html)) {
  throw new Error('packaged widget still contains a source-only shared path');
}

const here = path.dirname(fileURLToPath(import.meta.url));
const testFile = path.resolve(here, '../../_shared/pc-power-meter/power-math.test.cjs');
const result = spawnSync(process.execPath, [testFile], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log('PC POWER PACKAGED SMOKE PASS');
