function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console runtime patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console runtime patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, { repoRoot, playwrightUrl }) {
  source = replaceOnce(
    source,
    "import { chromium } from 'playwright';",
    `import { chromium } from ${JSON.stringify(playwrightUrl)};`,
    'Playwright import'
  );

  source = replaceOnce(
    source,
    "const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');",
    `const ROOT = ${JSON.stringify(repoRoot)};`,
    'repository root declaration'
  );

  source = replaceOnce(
    source,
    '    if (JSON.stringify(selected) !== JSON.stringify(pending)) {',
    '    if (selected.length && JSON.stringify(selected) !== JSON.stringify(pending)) {',
    'gallery FileList verification'
  );

  source = replaceOnce(
    source,
    "    state.galleryProof = {mode:'ordered-batch',files:[...pending],selectedFileList:selected,before,after};",
    "    state.galleryProof = {mode:'ordered-batch',files:[...pending],selectedFileList:selected,fileListClearedAfterIngest:selected.length===0,before,after};",
    'gallery proof record'
  );

  const categoryHelper = `
async function selectCategoryValues(target, requestedValues) {
  const requested = Array.from(requestedValues || []).map(String).filter(Boolean);
  if (!requested.length) return;

  await target.keyboard.press('Escape').catch(() => {});
  const triggers = target.locator('button[aria-haspopup="listbox"]');
  let trigger = target.getByRole('button',{name:/^type$/i}).first();
  let triggerIndex = -1;

  if (await visible(trigger)) {
    const handle = await trigger.elementHandle();
    for (let i = 0; i < await triggers.count(); i++) {
      const same = handle && await triggers.nth(i).evaluate((el,needle) => el === needle, handle).catch(() => false);
      if (same) { triggerIndex = i; break; }
    }
  } else {
    trigger = null;
  }

  if (!trigger) {
    const rememberedIndex = recordedListboxIndex('Category');
    if (rememberedIndex >= 0 && rememberedIndex < await triggers.count()) {
      trigger = triggers.nth(rememberedIndex);
      triggerIndex = rememberedIndex;
    }
  }

  if (!trigger) {
    const boxes = await inspectListboxes(target);
    const box = boxes.find(item => requested.some(value => optionCandidates(value).some(candidate => item.options.some(option => option.toLowerCase() === candidate.toLowerCase()))));
    if (box) {
      trigger = target.locator('button[aria-haspopup="listbox"]').nth(box.index);
      triggerIndex = box.index;
    }
  }

  if (!trigger) throw new Error('Maker Console category/type listbox was not found');

  const beforeText = ((await trigger.textContent()) || '').replace(/\\s+/g,' ').trim();
  const resolved = new Map();
  const missing = [];

  for (const value of requested) {
    const already = optionCandidates(value).find(candidate => triggerIncludesValue('Category', beforeText, candidate));
    if (already) resolved.set(value, already);
    else missing.push(value);
  }

  if (missing.length) {
    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await trigger.click();
    await target.waitForTimeout(250);

    for (const value of missing) {
      let options = (await target.getByRole('option').allTextContents()).map(x => x.replace(/\\s+/g,' ').trim());
      const actual = optionCandidates(value).find(candidate => options.some(option => option.toLowerCase() === candidate.toLowerCase())) || null;
      if (!actual) {
        await target.keyboard.press('Escape').catch(() => {});
        throw new Error('Maker Console no longer offers category: ' + value);
      }

      const escaped = actual.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&');
      let option = target.getByRole('option',{name:new RegExp('^' + escaped + '$','i')}).first();
      if (!await visible(option)) {
        await trigger.click();
        await target.waitForTimeout(200);
        option = target.getByRole('option',{name:new RegExp('^' + escaped + '$','i')}).first();
      }
      await option.click();
      await target.waitForTimeout(180);
      resolved.set(value, actual);
    }

    await target.keyboard.press('Escape').catch(() => {});
    await target.waitForTimeout(300);
  }

  let afterText = ((await trigger.textContent()) || '').replace(/\\s+/g,' ').trim();
  for (const value of requested) {
    const actual = resolved.get(value) || value;
    if (!triggerIncludesValue('Category', afterText, actual)) {
      await target.waitForTimeout(500);
      afterText = ((await trigger.textContent()) || '').replace(/\\s+/g,' ').trim();
    }
    if (!triggerIncludesValue('Category', afterText, actual)) {
      throw new Error('category did not stay selected: ' + value + '; control now shows "' + afterText + '"');
    }
    state.listboxProof.push({label:'Category',requested:value,actual,index:triggerIndex,method:missing.includes(value)?'verified-one-open-multi-select':'already-selected'});
    console.log('Category: ' + value + (missing.includes(value) ? '' : ' (already selected)'));
  }
  save();
}
`;

  source = replaceOnce(
    source,
    '\nasync function configurePrice(target) {',
    categoryHelper + '\nasync function configurePrice(target) {',
    'category batch helper insertion point'
  );

  source = replaceOnce(
    source,
    "  for (const category of prod.marketplace_category) await selectListboxValue(target, 'Category', category);",
    "  await selectCategoryValues(target, prod.marketplace_category);",
    'category selection loop'
  );

  const oldLocked = `async function lockedMonetization(target) {
  const body = ((await target.locator('body').innerText().catch(() => '')) || '').replace(/\\s+/g,' ');
  if (!/Monetization/i.test(body) || !/can't switch between paid and free after submitting the product/i.test(body)) return null;
  const section = body.match(/Monetization(.{0,500})/i)?.[1] || body;
  if (/\\bPaid\\b/i.test(section) && !/\\bFree\\b/i.test(section)) return 'paid';
  if (/\\bFree\\b/i.test(section)) return 'free';
  return 'locked';
}

async function rejectUnsafeLockedDraft(target) {
  const locked = await lockedMonetization(target);
  if (!locked) return;

  const expected = Number(prod.price_usd) > 0 ? 'paid' : 'free';
  await snap(target,'locked-monetization');
  const reason = locked === expected
    ? \`Existing \${prod.name} product is already past the creation wizard with monetization locked to \${locked}. Rat Ship will not guess how to resume this incomplete draft. Delete the incomplete Maker Console draft/listing and run Rat Ship again.\`
    : \`Existing \${prod.name} product has monetization locked to \${locked}, but submission.json requires \${expected}\${expected === 'paid' ? \` at $\${Number(prod.price_usd).toFixed(2)}\` : ''}. Delete the incorrect Maker Console draft/listing and run Rat Ship again.\`;
  stopRetrying(reason);
}`;

  const newLocked = `async function lockedMonetization(target) {
  const body = ((await target.locator('body').innerText().catch(() => '')) || '').replace(/\\s+/g,' ');
  if (!/Monetization/i.test(body) || !/can't switch between paid and free after submitting the product/i.test(body)) return null;

  const monetization = target.getByText(/^monetization$/i).first();
  if (await monetization.count()) await monetization.scrollIntoViewIfNeeded().catch(() => {});

  const paid = target.getByRole('button',{name:/^paid$/i}).first();
  const free = target.getByRole('button',{name:/^free$/i}).first();
  const paidSnapshot = await paid.count() ? await selectionSnapshot(paid) : null;
  const freeSnapshot = await free.count() ? await selectionSnapshot(free) : null;
  const paidState = paidSnapshot ? semanticSelection(paidSnapshot) : null;
  const freeState = freeSnapshot ? semanticSelection(freeSnapshot) : null;

  let priceValue = null;
  const price = target.getByLabel(/^price$/i).or(target.locator('input[type="number"],input[inputmode="decimal"]')).first();
  if (await price.count()) {
    const raw = await price.inputValue().catch(() => '');
    const numeric = Number(raw);
    if (raw !== '' && Number.isFinite(numeric)) priceValue = numeric;
  }

  if (paidState === true && freeState !== true) return {mode:'paid',source:'controls',priceValue,paidSnapshot,freeSnapshot};
  if (freeState === true && paidState !== true) return {mode:'free',source:'controls',priceValue:0,paidSnapshot,freeSnapshot};

  if (done('4-details') && state.pricingProof?.mode === 'paid' && Number(state.pricingProof.value) === Number(prod.price_usd)) {
    return {mode:'paid',source:'saved-proof',priceValue:Number(state.pricingProof.value)};
  }
  if (done('4-details') && state.pricingProof?.mode === 'free' && Number(prod.price_usd) === 0) {
    return {mode:'free',source:'saved-proof',priceValue:0};
  }

  return {mode:'locked',source:'unknown',priceValue};
}

async function rejectUnsafeLockedDraft(target) {
  const locked = await lockedMonetization(target);
  if (!locked) return;

  const expected = Number(prod.price_usd) > 0 ? 'paid' : 'free';
  await snap(target,'locked-monetization');

  if (locked.mode === expected) {
    if (expected === 'paid' && locked.priceValue != null && Number(locked.priceValue) !== Number(prod.price_usd)) {
      stopRetrying('Existing ' + prod.name + ' product is paid, but its locked price is $' + Number(locked.priceValue).toFixed(2) + ' while submission.json requires $' + Number(prod.price_usd).toFixed(2) + '. Rat Ship will not change a locked price.');
    }
    console.log('Existing ' + prod.name + ' draft has locked ' + expected + ' monetization verified by ' + locked.source + '. Resuming safely.');
    return;
  }

  if (locked.mode === 'locked') {
    stopRetrying('Existing ' + prod.name + ' product has locked monetization, but Rat Ship could not verify whether it is paid or free from the actual controls. Refusing to guess.');
  }

  stopRetrying('Existing ' + prod.name + ' product has monetization locked to ' + locked.mode + ', but submission.json requires ' + expected + (expected === 'paid' ? ' at $' + Number(prod.price_usd).toFixed(2) : '') + '. Delete the incorrect Maker Console draft/listing and run Rat Ship again.');
}`;

  source = replaceOnce(source, oldLocked, newLocked, 'locked monetization handling');
  return source;
}
