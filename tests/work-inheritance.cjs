/* Run: node tests/work-inheritance.cjs
   Fresh Playwright contexts, in-memory native persistence and blocked external requests.
   Uses the existing runtime; never reads/writes a user's collection or audio library. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
const credits = [
  {role: 'Conductor', name: 'Album Person'}, {role: 'Pianist', name: 'Album Person'},
  {role: 'Orchestra', name: 'Album Orchestra'}
];
const workCredits = [{role: 'Singer', name: 'Work Soloist'}, {role: 'Pianist', name: 'Work Soloist'}];
const album = {id: 'inheritance', title: 'Inheritance QA', composer: 'Album Composer', type: 'Symphony',
  addedAt: 1, performers: credits, works: [
    {title: 'Inherited work', tracks: [{title: 'First movement', duration: '2:00'}]},
    {title: 'Equal work', composer: 'Album Composer', type: 'Symphony',
      performers: [credits[2], credits[1], credits[0], credits[0]], tracks: []},
    {title: 'Different work', composer: 'Work Composer', type: 'PianoConcerto',
      performers: workCredits, tracks: [{title: 'Final movement', duration: '3:00'}]}
  ]};
async function fixture({cds = [album], settings = {}, nativeAudio = false} = {}) {
  const state = {doc: structuredClone({cds, meta: {albums: [], playlists: [],
    settings: {lang: 'en', cardFields: ['composer', 'type', 'performers', 'works'], ...settings}}}), errors: [], saves: 0};
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  await context.exposeBinding('__cdcNativeInvoke', async (_, command, args = {}) => {
    switch (command) {
      case 'load_data': return structuredClone(state.doc);
      case 'save_data': state.doc = structuredClone(args.data); state.saves++; return null;
      case 'covers_root_dir': return 'C:\\isolated-work-qa\\covers';
      case 'audio_root_dir': return 'C:\\isolated-work-qa\\audio';
      case 'audio_present': return args.files.map(() => false);
      case 'tidy_covers': return null;
      default: throw new Error('Unexpected isolated command: ' + command);
    }
  });
  await context.addInitScript(({nativeAudio}) => {
    window.CDC_DESKTOP = true;
    localStorage.setItem('cdc.lang', 'en');
    window.__TAURI__ = {core: {
      invoke: (command, args) => {
        if (!nativeAudio && command === 'audio_root_dir') return Promise.reject(new Error('No audio in this fixture'));
        return window.__cdcNativeInvoke(command, args);
      },
      convertFileSrc: file => location.origin + '/isolated/' + encodeURIComponent(file)
    }};
  }, {nativeAudio});
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'cdc-work.test' && url.pathname === '/') return route.fulfill({contentType: 'text/html', body: html});
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  page.on('pageerror', e => state.errors.push(e.message));
  await page.goto('http://cdc-work.test/');
  await page.locator('#open-add').waitFor();
  if (cds.length) await page.locator('#grid .card').first().waitFor();
  return {page, state, close: async () => {
    await context.close(); assert.deepEqual(state.errors, [], 'uncaught browser errors');
  }};
}
const card = page => page.locator('#card-inheritance');
async function edit(page) {
  await card(page).locator('h3').click();
  await page.locator('.profile-actions > button').first().click();
  if (!await page.locator('#works-set').evaluate(n => n.open)) await page.locator('#works-set > summary').click();
}
async function save(page, state) {
  const before = state.saves;
  await page.locator('#submit').click();
  await page.locator('#win-cd').waitFor({state: 'hidden'});
  for (let i = 0; i < 100 && state.saves === before; i++) await new Promise(r => setTimeout(r, 20));
  assert(state.saves > before, 'save reached isolated persistence');
}
async function language(page, value) {
  await page.locator('#lang-set').evaluate((n, value) => {
    n.value = value; n.dispatchEvent(new Event('change', {bubbles: true}));
  }, value);
}
async function main() {
  await test('inheritance helpers resolve each blank independently and compare performer sets without order/duplicates', async () => {
    const start = html.indexOf('  function workMetadata('), end = html.indexOf('  function workDisclosure(', start);
    assert(start >= 0 && end > start, 'work inheritance helpers are present');
    const helpers = vm.runInNewContext(html.slice(start, end) + '\n({workMetadata, workOverrides});');
    const plain = value => JSON.parse(JSON.stringify(value));
    const before = structuredClone(album);
    assert.deepEqual(plain(helpers.workMetadata(album, {})), {composer: album.composer, type: album.type, performers: credits});
    assert.deepEqual(plain(helpers.workOverrides(album, album.works[0])), {});
    assert.deepEqual(plain(helpers.workOverrides(album, album.works[1])), {});
    assert.deepEqual(plain(helpers.workOverrides(album, album.works[2])),
      {composer: 'Work Composer', type: 'PianoConcerto', performers: workCredits});
    assert.deepEqual(plain(helpers.workMetadata(album, {type: 'Opera'})),
      {composer: album.composer, type: 'Opera', performers: credits});
    assert.deepEqual(plain(helpers.workMetadata({}, {composer: 'Only work', performers: []})),
      {composer: 'Only work', type: '', performers: []});
    assert.deepEqual(plain(helpers.workMetadata(album, {performersMode: 'additional', performers: [credits[0], ...workCredits]})),
      {composer: album.composer, type: album.type, performers: [...credits, ...workCredits]});
    assert.deepEqual(plain(helpers.workOverrides(album, {performersMode: 'additional', performers: [credits[0]]})), {});
    assert.deepEqual(plain(helpers.workMetadata(album, {performers: workCredits})).performers, workCredits,
      'normal overrides must not merge in global performers');
    assert.deepEqual(album, before, 'resolving metadata mutated the input');
  });
  browser = await playwright.chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  await test('album composer/type/performers are grouped in order; work editor details start folded', async () => {
    const f = await fixture(), {page} = f;
    try {
      await edit(page);
      assert.deepEqual(await page.locator('#albumOverall #composer, #albumOverall #type, #albumOverall #perf-set')
        .evaluateAll(ns => ns.map(n => n.id)), ['composer', 'type', 'perf-set']);
      assert.equal(await page.locator('#more-details #type').count(), 0);
      assert.equal(await page.locator('#work-list .w-details').count(), 3);
      assert.deepEqual(await page.locator('#work-list .w-details').evaluateAll(ns => ns.map(n => n.open)), [false, false, false]);
      const work = page.locator('#work-list .work').last();
      assert.equal(await work.locator('.w-title').isVisible(), true);
      assert.equal(await work.locator('.t-title').isVisible(), true);
      assert.equal(await work.locator('.w-composer').isVisible(), false);
      await work.locator('.w-details > summary').click();
      assert.equal(await work.locator('.w-composer').isVisible(), true);
      assert.equal(await work.locator('.w-type').isVisible(), true);
      assert.deepEqual(await work.locator('.perf-name').evaluateAll(ns => ns.map(n => n.value)), ['Work Soloist']);
      await work.locator('.w-details > summary').click();
      assert.equal(await work.locator('.w-composer').isVisible(), false);
    } finally { await f.close(); }
  });
  await test('cards/profiles show work-info only for differences; hover and keyboard do not open cards', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      for (const lang of ['en', 'ja', 'zh']) {
        await language(page, lang);
        const info = card(page).locator('.work-info');
        const popup = page.getByRole('tooltip');
        assert.equal(await info.count(), 1, 'inherited/equal fields created info icons');
        assert.equal(await info.getAttribute('aria-expanded'), 'false');
        assert.equal(await card(page).locator('.work-overrides').count(), 0);
        assert(!(await card(page).innerText()).includes('Work Soloist'));
        await info.hover(); await popup.waitFor();
        assert.equal(await info.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#win-detail').isVisible(), false, 'info hover opened the card');
        assert.deepEqual(await popup.locator('.perfs .name').allTextContents(), ['Work Soloist']);
        assert.equal(await popup.locator('.composer').textContent(), 'Work Composer');
        await info.focus(); await info.press('Escape');
        await popup.waitFor({state: 'hidden'});
        assert.equal(await info.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#win-detail').isVisible(), false, 'keyboard interaction opened the card');
        await card(page).locator('h3').click();
        assert.equal(await page.locator('#detail-body .work-overrides').count(), 0);
        assert.equal(await page.locator('#detail-body .pwork').nth(0).locator('.work-info').count(), 0);
        assert.equal(await page.locator('#detail-body .pwork').nth(1).locator('.work-info').count(), 0);
        const profileInfo = page.locator('#detail-body .work-info');
        assert.equal(await profileInfo.getAttribute('aria-expanded'), 'false');
        await profileInfo.hover(); await popup.waitFor();
        assert((await popup.innerText()).includes('Work Soloist'));
        await page.locator('#close-detail').click();
      }
      assert.deepEqual(state.doc.cds, [album], 'viewing/toggling details changed CD metadata');
    } finally { await f.close(); }
  });
  await test('without an album composer, a work-only composer stays in the tooltip and remains filterable', async () => {
    const composer = 'Work-only Composer';
    const f = await fixture({cds: [
      {id: 'inheritance', title: 'No album composer QA', composer: '',
        works: [{title: 'Independent work', composer, tracks: []}]},
      {id: 'unrelated', title: 'Unrelated QA'}]}), {page} = f;
    try {
      const info = card(page).locator('.work-info'), popup = page.getByRole('tooltip');
      assert.equal(await info.getAttribute('aria-expanded'), 'false');
      assert(!(await card(page).innerText()).includes(composer), 'work composer leaked onto the collapsed card');
      assert.equal(await card(page).locator('.card-body > .composer').count(), 0);
      await info.hover(); await popup.waitFor();
      assert((await popup.innerText()).includes(composer));
      assert.equal(await page.locator('#win-detail').isVisible(), false);
      await info.press('Escape'); await popup.waitFor({state: 'hidden'});
      await card(page).locator('h3').click();
      const profile = page.locator('#detail-body');
      assert.equal(await profile.locator('.work-info').getAttribute('aria-expanded'), 'false');
      assert(!(await profile.innerText()).includes(composer), 'work composer leaked onto the collapsed profile');
      assert.equal(await profile.locator('.profile-main > .composer').count(), 0);
      await profile.locator('.work-info').hover(); await popup.waitFor();
      assert((await popup.innerText()).includes(composer));
      await page.locator('#close-detail').click();
      await page.locator('#filter-btn').click();
      await page.locator('#f-composer').getByRole('checkbox', {name: composer, exact: true}).check();
      assert.deepEqual(await page.locator('#grid .card h3').allTextContents(), ['No album composer QA']);
    } finally { await f.close(); }
  });
  await test('album type sits below composer above grouped performers on cards and profiles in both themes', async () => {
    const f = await fixture(), {page} = f;
    try {
      for (const theme of ['light', 'dark']) {
        await page.locator('html').evaluate((n, theme) => n.dataset.theme = theme, theme);
        assert.deepEqual(await card(page).locator('.card-body').evaluate(n => Array.from(n.children).slice(0, 4)
          .map(n => n.textContent)), ['Inheritance QA', 'Album Composer', 'Symphony', 'Conductor / PianistAlbum PersonOrchestraAlbum Orchestra']);
        await card(page).locator('h3').click();
        assert.deepEqual(await page.locator('.profile-main').evaluate(n => Array.from(n.children).slice(0, 4)
          .map(n => n.tagName + ':' + n.className)), ['H2:', 'P:composer', 'P:album-work-type', 'DL:facts']);
        assert.deepEqual(await page.locator('.profile-main > .facts').first().locator('dd').allTextContents(), ['Album Person', 'Album Orchestra']);
        await page.locator('#close-detail').click();
      }
    } finally { await f.close(); }
  });
  await test('blank work fields persist as inheritance while explicit overrides survive a closed editor/save/reload', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      await edit(page);
      await page.locator('#composer').fill('Changed Album Composer');
      await page.locator('#type').fill('Opera');
      await page.locator('#perf-rows .perf-name').first().fill('Changed Album Person');
      const different = page.locator('#work-list .work').last();
      await different.locator('.w-details > summary').click();
      await different.locator('.w-composer').fill('Edited Work Composer');
      await different.locator('.w-type').fill('Tone poem / 交响诗');
      await different.locator('.perf-name').fill('Edited Work Soloist');
      await different.locator('.w-details > summary').click();
      await save(page, state);
      let stored = state.doc.cds[0];
      assert(!stored.works[0].composer, 'blank composer was replaced by the album value');
      assert(!stored.works[0].type, 'blank type was replaced by the album value');
      assert(!stored.works[0].performers?.length, 'blank performers were replaced by album performers');
      assert.equal(stored.works[2].composer, 'Edited Work Composer');
      assert.equal(stored.works[2].type, 'Tone poem / 交响诗');
      assert.deepEqual(stored.works[2].performers, workCredits.map(p => ({...p, name: 'Edited Work Soloist'})));
      assert.deepEqual(stored.performers, credits.map(p => ({...p, name: p.name === 'Album Person' ? 'Changed Album Person' : p.name})));
      await page.reload(); await edit(page);
      const inherited = page.locator('#work-list .work').first();
      assert.equal(await inherited.locator('.w-composer').inputValue(), '');
      assert.equal(await inherited.locator('.w-type').inputValue(), '');
      assert.equal(await inherited.locator('.perf-name').count(), 0);
      await different.locator('.w-details > summary').click();
      await different.locator('.w-composer').fill(''); await different.locator('.w-type').fill('');
      await different.locator('.prow .iconbtn').click();
      await save(page, state);
      stored = state.doc.cds[0];
      assert(!stored.works[2].composer && !stored.works[2].type && !stored.works[2].performers?.length);
      assert.equal(await card(page).locator('.work-info').count(), 1, 'cleared work still has an info icon');
    } finally { await f.close(); }
  });
  await test('work-specific performers are searchable and available in role-specific shelf filters', async () => {
    const other = {id: 'other', title: 'Other QA', performers: [{role: 'Conductor', name: 'Work Soloist'}]};
    const f = await fixture({cds: [album, other]}), {page} = f;
    try {
      await page.locator('#search').fill('Work Soloist');
      assert.deepEqual((await page.locator('#grid .card h3').allTextContents()).sort(), ['Inheritance QA', 'Other QA']);
      await page.locator('#search').fill('');
      await page.locator('#filter-btn').click();
      await page.locator('#f-role').selectOption('Singer');
      await page.locator('#f-performer').getByRole('checkbox', {name: 'Work Soloist', exact: true}).check();
      assert.deepEqual(await page.locator('#grid .card h3').allTextContents(), ['Inheritance QA']);
      await page.locator('#f-clear').click();
      await page.locator('#f-composer').getByRole('checkbox', {name: 'Work Composer', exact: true}).check();
      assert.deepEqual(await page.locator('#grid .card h3').allTextContents(), ['Inheritance QA']);
    } finally { await f.close(); }
  });
  await test('work-only people in the profile link to all matching CDs', async () => {
    const f = await fixture({cds: [album,
      {id: 'same-person', title: 'Same person QA', performers: [{role: 'Conductor', name: 'Work Soloist'}]},
      {id: 'same-composer', title: 'Same composer QA', composer: 'Work Composer'},
      {id: 'unrelated', title: 'Unrelated QA'}]}), {page} = f;
    try {
      await card(page).locator('h3').click();
      await page.locator('#detail-body .work-info').hover();
      await page.getByRole('tooltip').getByRole('button', {name: 'Work Composer', exact: true}).click();
      assert.equal(await page.locator('#win-detail').isVisible(), false);
      assert.deepEqual((await page.locator('#grid .card h3').allTextContents()).sort(), ['Inheritance QA', 'Same composer QA']);
      await page.locator('#f-clear').click(); await page.locator('#f-done').click();
      await card(page).locator('h3').click();
      await page.locator('#detail-body .work-info').hover();
      const person = page.getByRole('tooltip').getByRole('button', {name: 'Work Soloist', exact: true});
      assert.equal(await person.count(), 1, 'work-specific performer has no profile filter link');
      await person.click();
      assert.equal(await page.locator('#win-detail').isVisible(), false);
      assert.deepEqual((await page.locator('#grid .card h3').allTextContents()).sort(), ['Inheritance QA', 'Same person QA']);
      assert((await page.locator('#f-performer').innerText()).includes('Work Soloist'));
    } finally { await f.close(); }
  });
  await test('legacy set profiles and separate-disc editing preserve existing membership', async () => {
    const legacy = {...structuredClone(album), set: {id: 'old-set', title: 'Legacy box QA', disc: 2, total: 3}};
    const f = await fixture({cds: [legacy]}), {page, state} = f;
    try {
      assert((await card(page).innerText()).includes('Legacy box QA'));
      await card(page).locator('h3').click();
      assert((await page.locator('#detail-body').innerText()).includes('Legacy box QA'));
      await page.locator('.set-disc summary').click();
      await page.locator('#set-edit-' + legacy.id).click();
      assert.equal(await page.locator('#set-title, #set-disc, #set-total').count(), 3);
      await page.locator('#title').fill('Edited legacy QA');
      await save(page, state);
      for (const [key,value] of Object.entries(legacy.set)) assert.deepEqual(state.doc.cds[0].set[key], value);
      await page.reload();
      for (const [key,value] of Object.entries(legacy.set)) assert.deepEqual(state.doc.cds[0].set[key], value);
    } finally { await f.close(); }
  });
  if (!process.env.CDC_QA_SKIP_AUDIO) await test('native profile without audio omits the empty section but edit form keeps Add audio', async () => {
    const f = await fixture({nativeAudio: true}), {page} = f;
    try {
      await card(page).locator('h3').click();
      assert.equal(await page.locator('#detail-body .paudio-head').count(), 0, 'empty profile Audio section');
      assert.equal(await page.locator('#detail-body #audio-add').count(), 0, 'profile Add audio button');
      await page.locator('.profile-actions > button').first().click();
      if (!await page.locator('#form-audio-set').evaluate(n => n.open)) await page.locator('#form-audio-set > summary').click();
      assert.equal(await page.locator('#form-audio-add').isVisible(), true, 'edit form Add audio is unavailable');
    } finally { await f.close(); }
  });
}
main().catch(error => {console.error(error); process.exitCode = 1;}).finally(async () => {
  if (browser) await browser.close();
  const failed = results.filter(pass => !pass).length;
  console.log(`${results.length - failed}/${results.length} work inheritance checks passed (index.html SHA-256 ${sourceHash})`);
  if (failed) process.exitCode = 1;
});
