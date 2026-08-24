import process from 'node:process';
import { runSessionQa } from './session-qa.mjs';
await runSessionQa('lite', process.argv[2], process.argv[3]);
