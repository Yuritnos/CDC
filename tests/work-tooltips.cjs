/* Run: node tests/work-tooltips.cjs
   Reuses the isolated Playwright/native-binding pattern. All data stays in memory;
   every network request is intercepted, with no real collection/library access. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
const sourceHash = createHash('sha256').update(html).digest('hex').slice(0, 12);
let playwright;
try { playwright = require(process.env.CDC_PLAYWRIGHT_MODULE || 'playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const executablePath = [process.env.CDC_CHROMIUM_PATH, playwright.chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
let browser;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('PASS:', name); }
  catch (error) { results.push(false); console.error('FAIL:', name, error.stack); }
}
const perfs = [{role: 'Conductor', name: 'Album Artist'}, {role: 'Pianist', name: 'Album Artist'}];
const album = {id: 'tips', title: 'Tooltip QA', composer: 'Album Composer', type: 'Symphony', performers: perfs,
  works: [{title: 'Inherited work', tracks: []},
    {title: 'Equal work', composer: 'Album Composer', type: 'Symphony', performers: [perfs[1], perfs[0], perfs[0]], tracks: []},
    {title: 'Different work', composer: 'Work Composer', type: 'Opera',
      performers: [{role: 'Singer', name: 'Work Artist'}], duration: '12:34', tracks: []}]};
async function fixture(cds = [album]) {
  const state = {doc: structuredClone({cds, meta: {albums: [], playlists: [], settings: {
    lang: 'en', cardFields: ['composer', 'type', 'performers', 'works', 'totalTime']}}}), errors: [], saves: 0};
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  await context.exposeBinding('__cdcNativeInvoke', async (_, command, args = {}) => {
    switch (command) {
      case 'load_data': return structuredClone(state.doc);
      case 'save_data': state.doc = structuredClone(args.data); state.saves++; return null;
      case 'covers_root_dir': return 'C:\\isolated-tooltip-qa\\covers';
      case 'audio_root_dir': return 'C:\\isolated-tooltip-qa\\audio';
      case 'audio_present': return args.files.map(() => false);
      case 'tidy_covers': return null;
      default: throw new Error('Unexpected isolated command: ' + command);
    }
  });
  await context.addInitScript(() => {
    window.CDC_DESKTOP = true; localStorage.setItem('cdc.lang', 'en');
    window.__TAURI__ = {core: {invoke: (command, args) => window.__cdcNativeInvoke(command, args),
      convertFileSrc: file => location.origin + '/isolated/' + encodeURIComponent(file)}};
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'cdc-tooltips.test' && url.pathname === '/') return route.fulfill({contentType: 'text/html', body: html});
    return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(4000);
  page.on('pageerror', e => state.errors.push(e.message));
  await page.goto('http://cdc-tooltips.test/'); await page.locator('#card-tips').waitFor();
  return {page, state, close: async () => {await context.close(); assert.deepEqual(state.errors, [], 'uncaught browser errors');}};
}
const card = page => page.locator('#card-tips');
const tip = page => page.getByRole('tooltip');
async function assertPosition(page, button, context) {
  await button.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // Escape leaves the pointer over its old target; enter again for each geometry check.
  await page.mouse.move(0, 0);
  await button.hover();
  try { await tip(page).waitFor(); }
  catch (error) { error.message = context + ': ' + error.message; throw error; }
  const geometry = await button.evaluate(button => {
    const bounds = (button.closest('.card') || button.closest('.panel')).getBoundingClientRect();
    const title = button.parentElement.querySelector('p').getBoundingClientRect();
    const popup = document.getElementById(button.getAttribute('aria-describedby'));
    const p = popup.getBoundingClientRect(), b = button.getBoundingClientRect();
    const rect = r => ({left: r.left, right: r.right, top: r.top, bottom: r.bottom});
    return {bounds: rect(bounds), title: rect(title), popup: rect(p), button: rect(b),
      viewport: {width: innerWidth, height: innerHeight},
      scrollable: popup.scrollWidth <= popup.clientWidth + 1,
      aboveOrLeft: p.bottom <= title.top + 1 || p.right <= title.left + 1,
      noOverlap: p.right <= title.left + 1 || p.left >= title.right - 1 || p.bottom <= title.top + 1 || p.top >= title.bottom - 1};
  });
  const {popup: p, bounds: b, viewport: v} = geometry;
  assert(p.left >= b.left - 1, `${context}: popup leaks left of its card/panel: ${JSON.stringify(geometry)}`);
  assert(p.right <= Math.min(v.width, b.right) + 1 && p.left >= 0, `${context}: horizontal bounds ${JSON.stringify(geometry)}`);
  assert(p.top >= 0 && p.bottom <= v.height + 1, `${context}: vertical bounds ${JSON.stringify(geometry)}`);
  assert(geometry.noOverlap, `${context}: popup overlaps work title ${JSON.stringify(geometry)}`);
  assert(geometry.scrollable, `${context}: long text creates horizontal scrolling`);
  // There is enough space above the first work in these fixtures; left/above is preferred.
  assert(geometry.aboveOrLeft, `${context}: popup did not prefer the left or above ${JSON.stringify(geometry)}`);
}
async function main() {
  browser = await playwright.chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  await test('info icons appear only for actual differences and replace visible work expanders on shelf/profile', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      assert.equal(await card(page).locator('.work-info').count(), 1);
      assert.equal(await card(page).locator('.work-overrides, .work-title-row > summary').count(), 0);
      assert.equal(await tip(page).count(), 0);
      assert(!(await card(page).innerText()).includes('Work Composer'));
      const info = card(page).locator('.work-info');
      assert.equal(await info.getAttribute('aria-expanded'), 'false');
      assert((await info.getAttribute('aria-label')).includes('Different work'));
      assert.equal(await info.evaluate(n => n.nextElementSibling.textContent), 'Different work', 'icon is not before the work title');
      await card(page).locator('h3').click();
      assert.equal(await page.locator('#detail-body .work-info').count(), 1);
      assert.equal(await page.locator('#detail-body .work-overrides').count(), 0);
      assert.equal(await page.locator('#detail-body .pwork').nth(0).locator('.work-info').count(), 0);
      assert.equal(await page.locator('#detail-body .pwork').nth(1).locator('.work-info').count(), 0);
      assert(!(await page.locator('#detail-body').innerText()).includes('Work Composer'));
      assert.equal(state.saves, 0);
    } finally { await f.close(); }
  });
  await test('hover reveals composer/type/credits, pointer can enter popup and click does not open a card', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      const info = card(page).locator('.work-info');
      await info.hover(); await tip(page).waitFor();
      assert.equal(await info.getAttribute('aria-describedby'), await tip(page).getAttribute('id'));
      for (const text of ['Work Composer', 'Opera', 'Work Artist']) assert((await tip(page).innerText()).includes(text), text);
      assert.deepEqual(await tip(page).locator('.perfs .role').allTextContents(), ['Singer']);
      assert(!(await tip(page).innerText()).includes('Album Artist'), 'inherited credits repeated in override popup');
      await tip(page).hover();
      await page.waitForTimeout(220);
      assert.equal(await tip(page).isVisible(), true, 'popup closed while hovered');
      await page.mouse.move(1, 1); await tip(page).waitFor({state: 'hidden'});
      await info.click(); await tip(page).waitFor();
      assert.equal(await page.locator('#win-detail').isVisible(), false, 'info click opened the CD');
      await page.mouse.move(1, 1); await page.waitForTimeout(220);
      assert.equal(await tip(page).isVisible(), true, 'clicked popup did not persist for touch');
      await page.locator('#search').click(); await tip(page).waitFor({state: 'hidden'});
      assert.equal(await info.getAttribute('aria-expanded'), 'false');
      assert.equal(await info.getAttribute('aria-describedby'), null);
      assert.equal(state.saves, 0, 'popup interaction saved collection metadata');
    } finally { await f.close(); }
  });
  await test('keyboard focus/Enter show details and Escape closes from icon and popup links without opening the CD', async () => {
    const f = await fixture(), {page} = f;
    try {
      const info = card(page).locator('.work-info');
      await info.focus(); await tip(page).waitFor();
      await info.press('Escape'); await tip(page).waitFor({state: 'hidden'});
      assert.equal(await info.evaluate(n => n === document.activeElement), true);
      await info.press('Enter'); await tip(page).waitFor();
      assert.equal(await page.locator('#win-detail').isVisible(), false);
      const link = tip(page).getByRole('button', {name: 'Work Composer', exact: true});
      await link.focus(); await link.press('Escape'); await tip(page).waitFor({state: 'hidden'});
      assert.equal(await info.evaluate(n => n === document.activeElement), true);
      assert.equal(await info.getAttribute('aria-expanded'), 'false');
      await card(page).locator('h3').click();
      const profileInfo = page.locator('#detail-body .work-info');
      await profileInfo.focus(); await tip(page).waitFor();
      await profileInfo.press('Escape'); await tip(page).waitFor({state: 'hidden'});
      assert.equal(await page.locator('#win-detail').isVisible(), true, 'Escape closed the entire profile');
    } finally { await f.close(); }
  });
  await test('long-text popups stay within card/panel and viewport, away from work titles at narrow widths in both themes', async () => {
    const long = {...structuredClone(album), works: [{
      title: 'A long work title / 很长的作品名称 / 作品の長い題名 ' + 'LongWork'.repeat(12),
      composer: 'Long Composer / ' + 'LongName'.repeat(22), type: 'Long custom type / ' + '类型'.repeat(28),
      performers: [1, 2, 3].map(n => ({role: 'Singer', name: `Artist ${n} / ` + 'LongArtist'.repeat(16)})),
      duration: '1:23:45', tracks: []}]};
    const f = await fixture([long]), {page} = f;
    try {
      for (const width of [1280, 420, 360, 320]) {
        await page.setViewportSize({width, height: 900});
        for (const theme of ['light', 'dark']) {
          await page.locator('html').evaluate((n, theme) => n.dataset.theme = theme, theme);
          await assertPosition(page, card(page).locator('.work-info'), `${width}px ${theme} shelf`);
          await card(page).locator('.work-info').press('Escape');
          await card(page).locator('h3').click();
          const button = page.locator('#detail-body .work-info');
          await assertPosition(page, button, `${width}px ${theme} profile`);
          await button.press('Escape');
          await page.locator('#close-detail').click();
        }
      }
    } finally { await f.close(); }
  });
  await test('additional imported credits merge with globals; equal extras have no info icon and overrides remain independent', async () => {
    const extra = {role: 'Singer', name: 'Additional Soloist'};
    const cd = {...structuredClone(album), works: [
      {title: 'Extra work', performersMode: 'additional', performers: [extra], tracks: []},
      {title: 'Equal extras', performersMode: 'additional', performers: [perfs[0]], tracks: []},
      {title: 'Override work', performers: [extra], tracks: []}]};
    const f = await fixture([cd]), {page, state} = f;
    try {
      const rows = card(page).locator('.work-title-row');
      assert.equal(await rows.nth(0).locator('.work-info').count(), 1);
      assert.equal(await rows.nth(1).locator('.work-info').count(), 0);
      assert.equal(await rows.nth(2).locator('.work-info').count(), 1);
      await rows.nth(0).locator('.work-info').hover(); await tip(page).waitFor();
      assert.deepEqual(await tip(page).locator('.perfs .name').allTextContents(), ['Additional Soloist']);
      await rows.nth(0).locator('.work-info').press('Escape');
      await page.locator('#filter-btn').click(); await page.locator('#f-role').selectOption('Singer');
      await page.locator('#f-performer').getByRole('checkbox', {name: 'Additional Soloist', exact: true}).check();
      assert.deepEqual(await page.locator('#grid .card h3').allTextContents(), ['Tooltip QA']);
      assert.deepEqual(state.doc.cds[0], cd, 'viewing/filtering mutated additional credit data');
    } finally { await f.close(); }
  });
  await test('work/track durations and total stay independent of info icons', async () => {
    const cd = {...structuredClone(album), works: [
      {title: 'Whole work', composer: 'Work Composer', duration: '12:34', tracks: []},
      {title: 'Tracked work', composer: 'Work Composer', duration: '99:00', tracks: [{title: 'Movement', duration: '3:21'}]}]};
    const f = await fixture([cd]), {page} = f;
    try {
      assert((await card(page).innerText()).includes('15:55'));
      await card(page).locator('h3').click();
      const works = page.locator('#detail-body .pwork');
      assert.equal(await works.nth(0).locator('.pwork-duration').textContent(), '12:34');
      assert.equal(await works.nth(1).locator('.pwork-duration').count(), 0);
      assert.equal(await works.nth(1).locator('.ptracks .len').textContent(), '3:21');
      assert((await page.locator('#detail-body .ptotal').textContent()).includes('15:55'));
      const before = await works.locator('.pwork-duration').boundingBox();
      await works.nth(0).locator('.work-info').hover(); await tip(page).waitFor();
      assert.deepEqual(await works.locator('.pwork-duration').boundingBox(), before, 'popup shifted duration');
    } finally { await f.close(); }
  });
}
main().catch(error => {console.error(error); process.exitCode = 1;}).finally(async () => {
  if (browser) await browser.close();
  console.log(`${results.filter(Boolean).length}/${results.length} work tooltip checks passed (index.html SHA-256 ${sourceHash})`);
  if (results.includes(false)) process.exitCode = 1;
});
