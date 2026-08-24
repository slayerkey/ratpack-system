import process from 'node:process';
import { runSessionQa } from '../work-session-tracker/session-qa.mjs';
await runSessionQa('pro', process.argv[2], process.argv[3]);
