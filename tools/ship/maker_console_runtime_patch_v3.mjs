import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v2.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console stale-draft patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console stale-draft patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  source = replaceOnce(
    source,
    "  if (locked.mode === expected) {\n    if (expected === 'paid' && locked.priceValue != null && Number(locked.priceValue) !== Number(prod.price_usd)) {",
    "  if (locked.mode === expected) {\n    if (!RESUME) {\n      stopRetrying('Existing ' + prod.name + ' draft has the expected locked ' + expected + ' monetization, but it predates this Rat Ship retry chain. Delete the incomplete draft/listing once and rerun Rat Ship so media and final-review proof can be rebuilt safely.');\n    }\n    if (expected === 'paid' && locked.priceValue != null && Number(locked.priceValue) !== Number(prod.price_usd)) {",
    'same-mode stale draft guard'
  );

  return source;
}
