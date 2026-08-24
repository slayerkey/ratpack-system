import { runWeatherQa } from '../../_shared/weather-timeline/qa-smoke.mjs';
await runWeatherQa(process.argv[2], process.argv[3], { pro: true });
