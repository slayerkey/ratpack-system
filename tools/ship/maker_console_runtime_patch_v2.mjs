import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console resume patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console resume patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  source = replaceOnce(
    source,
    "const mark = id => { if (!done(id)) state.done.push(id); save(); };",
    `const mark = id => {
  if (!done(id)) state.done.push(id);
  if (page && !page.isClosed()) state.lastUrl = page.url();
  save();
};`,
    'state mark helper'
  );

  const oldOpen = `  const editing = await openExisting(page);

  if (editing) {
    console.log(\`Existing \${prod.name} Maker Console product found for \${prod.name}. Continuing that draft/listing.\`);
    page = await livePage();
    await enterExistingEditor(page);
    page = await livePage();
    await rejectUnsafeLockedDraft(page);`;

  // Current core message does not repeat "for <name>"; keep a second exact form so
  // the compatibility layer fails loudly if neither known shape is present.
  const actualOpen = `  const editing = await openExisting(page);

  if (editing) {
    console.log(\`Existing Maker Console product found for \${prod.name}. Continuing that draft/listing.\`);
    page = await livePage();
    await enterExistingEditor(page);
    page = await livePage();
    await rejectUnsafeLockedDraft(page);`;

  const newOpen = `  let editing = false;
  let directResume = false;
  if (RESUME && state.lastUrl && /^https:\\/\\/maker\\.elgato\\.com\\//i.test(state.lastUrl)) {
    await page.goto(state.lastUrl,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(1800);
    directResume = true;
    editing = true;
    console.log('Resuming ' + prod.name + ' at the last verified Maker Console step.');
  } else {
    editing = await openExisting(page);
  }

  if (editing) {
    if (!directResume) {
      console.log(\`Existing Maker Console product found for \${prod.name}. Continuing that draft/listing.\`);
      page = await livePage();
      await enterExistingEditor(page);
    }
    page = await livePage();
    await rejectUnsafeLockedDraft(page);`;

  if (source.includes(actualOpen)) {
    source = replaceOnce(source, actualOpen, newOpen, 'existing draft entry');
  } else {
    source = replaceOnce(source, oldOpen, newOpen, 'existing draft entry');
  }

  return source;
}
