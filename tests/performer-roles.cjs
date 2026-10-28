/* Targeted performer UI checks; uses the existing Playwright runtime, never real collection data. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
const bundled = path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let playwright;
try { playwright = require(process.env.CDC_PLAYWRIGHT_MODULE || 'playwright'); }
catch { playwright = require(bundled); }
const executablePath = [process.env.CDC_CHROMIUM_PATH, playwright.chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
let browser;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('PASS:', name); }
  catch (error) { results.push(false); console.error('FAIL:', name, error.stack); }
}
async function fixture(cds = []) {
  const state = {doc: {cds, meta: {albums: [], playlists: [], settings: {lang: 'en'}}}, errors: []};
  const context = await browser.newContext({viewport: {width: 1100, height: 850}, reducedMotion: 'reduce'});
  await context.addInitScript(() => { window.CDC_DESKTOP = true; localStorage.setItem('cdc.lang', 'en'); });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'cdc-performers.test') {
      if (url.pathname === '/') return route.fulfill({contentType: 'text/html', body: html});
      if (url.pathname === '/api/data') {
        if (route.request().method() === 'PUT') state.doc = route.request().postDataJSON();
        return route.fulfill({json: state.doc});
      }
    }
    if (url.hostname === 'api.discogs.com') {
      if (url.pathname === '/database/search') return route.fulfill({json: {results: [
        {id: 101, title: 'With credits', catno: 'QA001', format: ['CD']},
        {id: 102, title: 'Without credits', catno: 'QA001', format: ['CD']}
      ]}});
      return route.fulfill({json: {id: Number(url.pathname.split('/').pop()), title: 'Lookup CD',
        formats: [{name: 'CD', qty: '1'}], labels: [{name: 'QA', catno: 'QA001'}], tracklist: [],
        extraartists: url.pathname.endsWith('/101') ? [{name: 'Alex Example', role: 'Conductor, Piano'}] : []}});
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  page.on('pageerror', e => state.errors.push(e.message));
  await page.goto('http://cdc-performers.test/');
  await page.locator('#open-add').waitFor();
  return {page, state, close: async () => { await context.close(); assert.deepEqual(state.errors, []); }};
}
async function save(page) {
  await page.locator('#submit').click();
  await page.locator('#win-cd').waitFor({state: 'hidden'});
}
async function edit(page, title) {
  await page.locator('#grid .card').filter({has: page.getByRole('heading', {name: title, exact: true})}).click();
  await page.getByRole('button', {name: 'Edit', exact: true}).click();
}
async function lookup(page, index) {
  await page.locator('#lookup-q').fill('QA001');
  await page.locator('#lookup-go').click();
  await page.locator('#lookup-use-' + index).click();
  await page.locator('#lookup-go').waitFor({state: 'visible'});
  await page.waitForFunction(index => document.querySelector('#lookup-use-' + index).textContent === 'In use', index);
}
const selected = row => row.locator('input[type=checkbox]:checked').evaluateAll(ns => ns.map(n => n.value));
async function main() {
  await test('syntax and complete en/ja/zh translations; old role link removed', async () => {
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
    const start = html.indexOf('  var I18N = '), end = html.indexOf('  var LANGS = ', start);
    const dict = vm.runInNewContext(html.slice(start, end) + '\nI18N;');
    for (const lang of ['ja', 'zh']) assert.deepEqual(Object.keys(dict[lang]).sort(), Object.keys(dict.en).sort());
    assert(!html.includes('addPerformerRole'));
    assert(!html.includes('perf-more'));
  });
  browser = await playwright.chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  await test('keyboard multi-role selection, dismissal, pair persistence and edit/reload', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      await page.locator('#open-add').click();
      await page.locator('#title').fill('Performer QA');
      const row = page.locator('.prow').first(), summary = row.locator('summary');
      await row.locator('.perf-name').fill('  Alex Example  ');
      assert.equal(await row.locator('select').count(), 0);
      await summary.focus(); await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').inputValue(), 'Orchestra');
      await page.keyboard.press('Space');
      await row.getByRole('checkbox', {name: 'Pianist', exact: true}).check();
      await row.getByRole('checkbox', {name: 'Orchestra', exact: true}).uncheck();
      assert.deepEqual(await selected(row), ['Conductor', 'Pianist']);
      await page.keyboard.press('Escape');
      assert.equal(await row.locator('details').getAttribute('open'), null);
      assert.equal(await summary.evaluate(n => document.activeElement === n), true);
      assert.equal(await page.locator('#win-cd').isVisible(), true);
      await summary.click(); await row.locator('.perf-name').click();
      assert.equal(await row.locator('details').getAttribute('open'), null);
      await save(page);
      const expected = [{role: 'Conductor', name: 'Alex Example'}, {role: 'Pianist', name: 'Alex Example'}];
      assert.deepEqual(state.doc.cds[0].performers, expected);
      await page.reload(); await edit(page, 'Performer QA');
      assert.equal(await page.locator('.prow').count(), 1);
      assert.deepEqual(await selected(row), ['Conductor', 'Pianist']);
      await summary.click();
      await row.getByRole('checkbox', {name: 'Conductor', exact: true}).uncheck();
      assert.equal(await row.getByRole('checkbox', {name: 'Pianist', exact: true}).isDisabled(), true);
      await page.keyboard.press('Escape'); await save(page);
      assert.deepEqual(state.doc.cds[0].performers, [expected[1]]);
    } finally { await f.close(); }
  });
  await test('old same-name pairs combine; deduplication, unknown roles, blank names and removal', async () => {
    const performers = [{role: 'Pianist', name: 'Alex Example'}, {role: 'Conductor', name: 'Alex Example'},
      {role: 'Pianist', name: 'Alex Example'}, {role: 'Organist', name: 'Sam Example'}];
    const f = await fixture([{id: 'legacy', title: 'Legacy QA', addedAt: 1, performers}]), {page, state} = f;
    try {
      await edit(page, 'Legacy QA');
      assert.equal(await page.locator('.prow').count(), 2);
      assert.deepEqual(await selected(page.locator('.prow').first()), ['Conductor', 'Pianist']);
      assert.deepEqual(await selected(page.locator('.prow').nth(1)), ['Organist']);
      await page.locator('#add-perf').click();
      await save(page);
      assert.equal(state.doc.cds[0].performers.length, 3);
      await edit(page, 'Legacy QA');
      await page.locator('.prow .iconbtn').first().click(); await save(page);
      assert.deepEqual(state.doc.cds[0].performers, [{role: 'Organist', name: 'Sam Example'}]);
    } finally { await f.close(); }
  });
  await test('lookup groups roles, clears untouched lookup names, and retains user role edits', async () => {
    const f = await fixture(), {page} = f;
    try {
      await page.locator('#open-add').click(); await lookup(page, 0);
      const row = page.locator('.prow').first();
      assert.equal(await page.locator('.prow').count(), 1);
      assert.equal(await row.locator('.perf-name').inputValue(), 'Alex Example');
      assert.deepEqual(await selected(row), ['Conductor', 'Pianist']);
      assert.equal(await row.locator('.perf-name.filled').count(), 1);
      await lookup(page, 1);
      assert.equal(await row.locator('.perf-name').inputValue(), '');
      assert.deepEqual(await selected(row), ['Conductor']);
      await lookup(page, 0); await row.locator('summary').click();
      await row.getByRole('checkbox', {name: 'Singer', exact: true}).check();
      await page.keyboard.press('Escape'); await lookup(page, 1);
      assert.equal(await row.locator('.perf-name').inputValue(), 'Alex Example');
      assert.deepEqual(await selected(row), ['Conductor', 'Singer', 'Pianist']);
    } finally { await f.close(); }
  });
  await test('translated accessible menus fit light/dark desktop and narrow screens; reduced motion', async () => {
    const f = await fixture(), {page} = f;
    try {
      await page.locator('#open-add').click();
      for (const width of [1100, 420, 360, 320]) {
        await page.setViewportSize({width, height: 800});
        for (const lang of ['en', 'ja', 'zh']) {
          await page.locator('#lang-set').evaluate((n, lang) => { n.value = lang; n.dispatchEvent(new Event('change', {bubbles: true})); }, lang);
          const roles = {en: 'Roles (choose one or more)', ja: '役割（複数選択可）', zh: '角色（可多选）'}[lang];
          for (const theme of ['light', 'dark']) {
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            const row = page.locator('.prow').first();
            await row.locator('summary').click();
            await page.getByRole('group', {name: roles, exact: true}).waitFor();
            const geometry = await row.locator('.perf-role-options').evaluate(n => {
              const r = n.getBoundingClientRect(), panel = n.closest('.panel').getBoundingClientRect();
              return {fits: r.left >= 0 && r.right <= innerWidth && r.top >= panel.top && r.bottom <= panel.bottom,
                animation: getComputedStyle(n).animationName,
                ink: getComputedStyle(n.querySelector('label')).color};
            });
            assert.equal(geometry.fits, true, `${lang} ${theme} at ${width}px: menu clipped`);
            assert.equal(geometry.animation, 'none');
            assert.equal(geometry.ink, theme === 'light' ? 'rgb(20, 27, 36)' : 'rgb(230, 234, 239)');
            await row.getByRole('checkbox').last().scrollIntoViewIfNeeded();
            await page.keyboard.press('Escape');
          }
        }
      }
      await page.emulateMedia({reducedMotion: 'no-preference'});
      await page.locator('.prow summary').click();
      assert.equal(await page.locator('.perf-role-options').evaluate(n => getComputedStyle(n).animationName), 'pop-in');
    } finally { await f.close(); }
  });
  await test('last performer popup fits a short window and only one menu stays open', async () => {
    const f = await fixture(), {page} = f;
    try {
      await page.setViewportSize({width: 360, height: 450});
      await page.locator('#open-add').click();
      for (let i = 0; i < 8; i++) await page.locator('#add-perf').click();
      const last = page.locator('.prow').last();
      await last.locator('summary').click();
      await last.getByRole('checkbox', {name: 'Pianist', exact: true}).waitFor();
      const fits = await last.locator('.perf-role-options').evaluate(n => {
        const r = n.getBoundingClientRect(), panel = n.closest('.panel').getBoundingClientRect();
        return r.top >= panel.top && r.bottom <= panel.bottom;
      });
      assert.equal(fits, true, 'last performer popup is clipped by the form');
      await last.getByRole('checkbox', {name: 'Pianist', exact: true}).check();
      await page.locator('.prow').nth(7).locator('summary').click();
      assert.equal(await page.locator('.perf-roles[open]').count(), 1);
      await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
      assert.equal(await page.locator('#win-cd').isVisible(), true);
    } finally { await f.close(); }
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  console.log(`${results.filter(Boolean).length}/${results.length} performer checks passed`);
  if (results.includes(false)) process.exitCode = 1;
});
