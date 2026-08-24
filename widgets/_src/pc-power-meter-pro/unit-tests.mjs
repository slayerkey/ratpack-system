import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const testFile = path.resolve(here, '../../_shared/pc-power-meter/power-math.test.cjs');
const result = spawnSync(process.execPath, [testFile], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
