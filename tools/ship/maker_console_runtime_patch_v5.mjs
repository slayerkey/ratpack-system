import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v4.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console Stream Deck plugin patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console Stream Deck plugin patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceCount(source, before, after, expected, label) {
  const count = source.split(before).length - 1;
  if (count !== expected) {
    throw new Error(`Maker Console Stream Deck plugin patch expected ${expected} ${label} occurrence(s), found ${count}`);
  }
  return source.split(before).join(after);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  source = replaceOnce(
    source,
    "if (prod.slug !== slug || prod.type !== 'widget') throw new Error('submission metadata does not match requested widget');",
    "if (prod.slug !== slug || !['widget','plugin'].includes(prod.type)) throw new Error('submission metadata does not match requested Rat Ship product');\nconst productKindLabel = prod.type === 'plugin' ? 'Plugin' : 'Widget';\nconst packageExtension = prod.type === 'plugin' ? '.streamDeckPlugin' : '.icuewidget';",
    'submission type guard'
  );

  source = replaceOnce(
    source,
    "const packages = readdirSync(KIT).filter(f => /\\.icuewidget$/i.test(f));",
    "const packagePattern = prod.type === 'plugin' ? /\\.streamDeckPlugin$/i : /\\.icuewidget$/i;\nconst packages = readdirSync(KIT).filter(f => packagePattern.test(f));",
    'package extension filter'
  );

  source = replaceOnce(
    source,
    "if (packages.length !== 1) missing.push(`exactly one .icuewidget required, found ${packages.length}`);\nfor (const key of ['name','version','price_usd','marketplace_category','marketplace_dashboard_sizes','marketplace_language']) {\n  if (prod[key] == null || (Array.isArray(prod[key]) && !prod[key].length)) missing.push(`submission.${key}`);\n}",
    "if (packages.length !== 1) missing.push(`exactly one ${packageExtension} required, found ${packages.length}`);\nconst requiredMetadata = ['name','version','price_usd','marketplace_category','marketplace_language'];\nif (prod.type === 'widget') requiredMetadata.push('marketplace_dashboard_sizes');\nfor (const key of requiredMetadata) {\n  if (prod[key] == null || (Array.isArray(prod[key]) && !prod[key].length)) missing.push(`submission.${key}`);\n}",
    'type-aware preflight metadata'
  );

  source = replaceCount(
    source,
    "for (const size of prod.marketplace_dashboard_sizes) {",
    "for (const size of (prod.marketplace_dashboard_sizes || [])) {",
    2,
    'dashboard-size loops'
  );

  source = replaceOnce(
    source,
    "    await step('1-create','Create Widget draft',async() => {\n      await click(page,/create product|new product|add product/i);\n      const choice = page.getByRole('radio',{name:/^widget$/i}).or(page.getByText(/^widget$/i)).or(page.getByRole('button',{name:/^widget$/i})).first();\n      await choice.click();\n      await click(page,/^(next|continue)$/i);\n    });",
    "    await step('1-create',`Create ${productKindLabel} draft`,async() => {\n      await click(page,/create product|new product|add product/i);\n      const productKindPattern = new RegExp(`^${productKindLabel}$`,'i');\n      const choice = page.getByRole('radio',{name:productKindPattern}).or(page.getByText(productKindPattern,{exact:true})).or(page.getByRole('button',{name:productKindPattern})).first();\n      await choice.waitFor({state:'visible',timeout:15000});\n      await choice.click();\n      await click(page,/^(next|continue)$/i);\n    });",
    'product type selection'
  );

  source = replaceOnce(
    source,
    "    await step('2-file','Upload .icuewidget',async() => {",
    "    await step('2-file',`Upload ${packageExtension}`,async() => {",
    'package upload label'
  );

  source = replaceCount(
    source,
    "await step('4-details','Set category, dashboard sizes, orientation, language and price',async() => configureDetails(page));",
    "await step('4-details',prod.type === 'plugin' ? 'Set category, language and price' : 'Set category, dashboard sizes, orientation, language and price',async() => configureDetails(page));",
    2,
    'details step labels'
  );

  return source;
}
