/* Run with Node and an existing Playwright installation (no install required).
   Optional: CDC_PLAYWRIGHT_MODULE, CDC_CHROMIUM_PATH, CDC_QA_ARTIFACTS.
   All collection writes and external requests are intercepted in a fresh browser context. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const assert = require('node:assert/strict');
const sourcePath = path.join(__dirname, '..', 'src', 'index.html');
const html = fs.readFileSync(sourcePath, 'utf8');
const sourceHash = createHash('sha256').update(html).digest('hex').slice(0, 12);
const bundled = path.join(process.env.USERPROFILE || '', '.cache', 'codex-runtimes',
  'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright');
let playwright;
if (process.env.CDC_PLAYWRIGHT_MODULE) playwright = require(process.env.CDC_PLAYWRIGHT_MODULE);
else {
  try { playwright = require('playwright'); } catch { playwright = require(bundled); }
}
const executablePath = [process.env.CDC_CHROMIUM_PATH, playwright.chromium.executablePath(),
  path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
let browser;
const results = [];
async function test(name, fn) {
  if (process.env.CDC_TEST_FILTER && !new RegExp(process.env.CDC_TEST_FILTER, 'i').test(name)) return;
  try { await fn(); results.push({name, pass: true}); console.log('PASS:', name); }
  catch (error) { results.push({name, pass: false}); console.error('FAIL:', name, error.stack); }
}
const multi = {
  id: 101, title: 'Symphony · Volume = One', formats: [{name: 'CD', qty: '2'}, {name: 'DVD', qty: '1'}],
  labels: [{name: 'QA Records', catno: 'QA001'}],
  extraartists: [{name: 'Composer (2)', role: 'Composed By'}],
  tracklist: [
    {type_: 'index', title: 'Symphony In C', sub_tracks: [
      {type_: 'track', position: '1-1', title: 'I. First', duration: '12:34'},
      {type_: 'track', position: '2-1', title: 'II. Second', duration: '3:21'}]},
    {type_: 'heading', title: 'Piano Concerto'},
    {type_: 'track', position: '2-2', title: 'Finale', duration: '4:56'}
  ]
};
const single = {id: 102, title: 'New Single', formats: [{name: 'CD', qty: '1'}],
  tracklist: [{type_: 'track', position: '1', title: 'New Track', duration: '2:22'}]};
const multiTitle = 'Symphony · Volume · One';
function deferred() {
  let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve};
}
async function until(check) {
  for (let n = 0; n < 160 && !check(); n++) await new Promise(resolve => setTimeout(resolve, 25));
  assert(check(), 'isolated persistence did not finish');
}
function silenceWav() {
  const pcmBytes = 8000 * 2, wav = Buffer.alloc(44 + pcmBytes);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcmBytes, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(pcmBytes, 40);
  return wav;
}
async function fixture({cds = [], settings = {}, nativeAudio = false, albums = [], playlists = [], order} = {}) {
  const state = {doc: {cds: structuredClone(cds), meta: {albums: structuredClone(albums), playlists: structuredClone(playlists), order, settings: {lang: 'en', ...settings}}},
    releases: {101: multi, 102: single}, holds: {}, failures: {}, requested: [], errors: [], commands: []};
  const context = await browser.newContext({viewport: {width: 1280, height: 860}, reducedMotion: 'reduce'});
  if (nativeAudio) await context.exposeBinding('__cdcNativeInvoke', async (_, command, args = {}) => {
    state.commands.push({command, args});
    switch (command) {
      case 'load_data': return structuredClone(state.doc);
      case 'save_data': if (state.saveFail) throw new Error('Isolated save failure'); state.doc = structuredClone(args.data); return null;
      case 'covers_root_dir': return 'C:\\isolated-qa\\covers';
      case 'audio_root_dir': return 'C:\\isolated-qa\\audio';
      case 'audio_present': return args.files.map(() => true);
      case 'tidy_covers': return null;
      case 'remove_cd_audio': return null;
      case 'remove_audio': return null;
      case 'cover_data': return state.coverData || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFo0AAAAASUVORK5CYII=';
      case 'save_cover': return 'saved-cover.png';
      default: throw new Error('Unexpected native command in isolated QA: ' + command);
    }
  });
  await context.addInitScript(({nativeAudio}) => {
    window.CDC_DESKTOP = true;
    localStorage.setItem('cdc.lang', 'en');
    if (nativeAudio) window.__TAURI__ = {core: {
      invoke: (command, args) => window.__cdcNativeInvoke(command, args),
      convertFileSrc: file => location.origin + '/qa-audio/' + encodeURIComponent(file)
    }};
  }, {nativeAudio});
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === 'cdc-integration.test') {
      if (url.pathname === '/') return route.fulfill({contentType: 'text/html', body: html});
      if (url.pathname === '/api/data') {
        if (request.method() === 'PUT' && state.saveFail) return route.fulfill({status: 500, body: 'Isolated save failure'});
        if (request.method() === 'PUT') state.doc = request.postDataJSON();
        return route.fulfill({json: state.doc});
      }
      if (url.pathname === '/avatar-default.svg') return route.fulfill({
        contentType: 'image/svg+xml', body: fs.readFileSync(path.join(path.dirname(sourcePath), 'avatar-default.svg'))});
      if (nativeAudio && url.pathname.startsWith('/qa-audio/')) return route.fulfill({
        contentType: 'audio/wav', body: silenceWav()});
    }
    if (url.hostname === 'api.discogs.com') {
      if (url.pathname === '/database/search') return route.fulfill({json: {results:
        Object.values(state.releases).map(r => ({id: r.id, title: r.title, catno: 'QA001', format: ['CD']}))}});
      const id = Number(url.pathname.split('/').pop());
      state.requested.push(id);
      if (state.holds[id]) await state.holds[id].promise;
      if (state.failures[id]) return route.fulfill({status: 503, json: {message: 'Delayed test failure'}});
      return route.fulfill({json: state.releases[id]});
    }
    // Native audio is simulated by the binding and in-memory WAV; no library files are used.
    // No real accounts, network services, fonts or cover downloads are used.
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  page.on('pageerror', e => state.errors.push(e.message));
  await page.goto('http://cdc-integration.test/');
  await page.locator('#open-add').waitFor();
  return {page, state, close: async () => {
    await context.close(); assert.deepEqual(state.errors, [], 'uncaught browser errors');
  }};
}
async function openCard(page, title) {
  await page.locator('#grid .card').filter({has: page.getByRole('heading', {name: title, exact: true})}).click();
}
// These integration cases exercise editing; section defaults have their own dedicated suite.
async function prepareEditor(page) {
  await page.locator('#win-cd').waitFor();
  await page.locator('#works-set').evaluate(n => n.open = true);
  if (await page.locator('#form-audio-set').isVisible()) {
    await page.locator('#form-audio-set').evaluate(n => n.open = true);
  }
}
async function openAdd(page) {
  await page.locator('#open-add').click();
  await prepareEditor(page);
}
async function edit(page) {
  await page.locator('.profile-actions > button').first().click();
  await prepareEditor(page);
}
async function save(page) {
  await page.locator('#submit').click();
  await page.locator('#win-cd').waitFor({state: 'hidden'});
}
async function search(page) {
  await page.locator('#lookup-q').fill('QA001');
  await page.locator('#lookup-go').click();
  await page.locator('#lookup-use-1').waitFor();
}
async function flush(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function releaseHeld(page, state, id) {
  const response = page.waitForResponse(r => r.url().endsWith('/releases/' + id));
  state.holds[id].resolve(); await (await response).finished(); await flush(page);
}
async function setLanguage(page, lang) {
  await page.locator('#lang-set').evaluate((n, value) => {
    n.value = value; n.dispatchEvent(new Event('change', {bubbles: true}));
  }, lang);
}
async function main() {
  await test('script syntax, complete en/ja/zh keys and translated placeholders', async () => {
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
    const start = html.indexOf('  var I18N = '), end = html.indexOf('  var LANGS = ', start);
    assert(start >= 0 && end > start);
    const dict = vm.runInNewContext(html.slice(start, end) + '\nI18N;');
    for (const lang of ['ja', 'zh']) {
      assert.deepEqual(Object.keys(dict[lang]).sort(), Object.keys(dict.en).sort());
      for (const key of Object.keys(dict.en)) {
        assert(dict[lang][key], `${lang}: ${key} is empty`);
        // English singular strings can spell out "one" where ja/zh retain the count.
        const vars = s => (s.match(/\{\w+\}/g) || []).filter(v => !(key.endsWith('.one') && v === '{n}')).sort();
        assert.deepEqual(vars(dict[lang][key]), vars(dict.en[key]), `${lang}: ${key}`);
      }
    }
    for (const m of html.matchAll(/data-i18n(?:-ph|-aria)?="([^"]+)"/g)) assert(dict.en[m[1]], m[1]);
  });
  browser = await playwright.chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  await test('Discogs titles normalize musical terms without lowercasing names or arbitrary source text', async () => {
    const start = html.indexOf('  function dgTitle('), end = html.indexOf('  /* Names that', start);
    assert(start >= 0 && end > start);
    const title = vm.runInNewContext(html.slice(start, end) + '\ndgTitle;');
    assert.equal(title('Allegro Ma Non Troppo'), 'Allegro ma non troppo');
    assert.equal(title('Symphony No. 5 In C Minor'), 'Symphony No. 5 in C minor');
    assert.equal(title('Trio In E-Flat Major'), 'Trio in E-flat major');
    assert.equal(title('Allegro by Yo-Yo Ma'), 'Allegro by Yo-Yo Ma');
    assert.equal(title('CD1 · Symphony No. 3 (2)'), 'CD1 · Symphony No. 3 (2)');
    assert.equal(title('St John Passion'), 'St John Passion');
  });
  await test('Discogs parent disc positions and heading lookahead keep movements on their disc', async () => {
    const start = html.indexOf('  function dgDiscLists('), end = html.indexOf('  var discogsSource', start);
    const split = vm.runInNewContext(html.slice(start, end) + '\ndgDiscLists;');
    const groups = split([
      {type_: 'track', position: '1-1', title: 'Disc one'},
      {type_: 'index', position: '2-1', title: 'Work on second disc', sub_tracks: [
        {type_: 'track', position: '1', title: 'Movement one'},
        {type_: 'track', position: '2', title: 'Movement two'}]},
      {type_: 'heading', title: 'Work on third disc'},
      {type_: 'track', position: 'CD3-1', title: 'Finale'}
    ]);
    assert.equal(groups[1].length, 1);
    assert.equal(groups[2][0].title, 'Work on second disc');
    assert.equal(groups[2][0].sub_tracks.length, 2);
    assert.equal(groups[3][0].type_, 'heading');
  });
  await test('zero-track work duration saves separately and transfers only across the first/last track boundary', async () => {
    const f = await fixture(), {page, state} = f;
    const customType = 'Tone poem / 诗篇';
    try {
      await openAdd(page);
      await page.locator('#title').fill('Duration QA');
      await page.locator('.w-title').fill('Overture');
      assert.equal(await page.locator('.w-type').evaluate(n => n.tagName), 'INPUT');
      assert.equal(await page.locator('.w-type').getAttribute('list'), 'work-type-options');
      await page.locator('.w-details > summary').click();
      await page.locator('.w-type').fill(customType);
      while (await page.locator('.trow').count()) await page.locator('.trow .iconbtn').first().click();
      assert.equal(await page.locator('.w-duration').isVisible(), true);
      await page.locator('.w-duration').fill('12:99');
      await page.locator('#submit').click();
      assert((await page.locator('#works-err').textContent()).length);
      assert.equal(await page.locator('.w-duration').evaluate(n => n === document.activeElement), true);
      assert.equal(await page.locator('.w-duration').getAttribute('aria-invalid'), 'true');
      await page.locator('.w-duration').fill('12:34');
      await save(page);
      assert.equal(state.doc.cds[0].works[0].duration, '12:34');
      assert.deepEqual(state.doc.cds[0].works[0].tracks, []);
      assert.equal(state.doc.cds[0].works[0].type, customType);
      await openCard(page, 'Duration QA');
      assert.equal(await page.locator('.pwork-title').textContent(), 'Overture');
      assert.equal(await page.locator('.pwork-duration').textContent(), '12:34');
      assert.equal(await page.locator('.ptracks li').count(), 0);
      assert((await page.locator('.ptotal').textContent()).includes('12:34'));
      await edit(page);
      assert.equal(await page.locator('.trow').count(), 0);
      assert.equal(await page.locator('.w-duration').inputValue(), '12:34');
      await page.getByRole('button', {name: '+ Add track', exact: true}).click();
      assert.equal(await page.locator('.w-duration').isHidden(), true);
      assert.equal(await page.locator('.w-duration').inputValue(), '');
      assert.equal(await page.locator('.trow').count(), 1);
      assert.equal(await page.locator('.t-len').first().inputValue(), '12:34');
      assert.equal(await page.locator('.t-len').first().isVisible(), true);
      await page.locator('.t-title').first().fill('Opening');
      await page.getByRole('button', {name: '+ Add track', exact: true}).click();
      assert.equal(await page.locator('.t-len').nth(1).inputValue(), '');
      await page.locator('.t-title').nth(1).fill('Finale');
      await page.locator('.t-len').nth(1).fill('3:21');
      await save(page);
      assert.deepEqual(state.doc.cds[0].works[0].tracks.map(t => t.duration), ['12:34', '3:21']);
      assert.equal(state.doc.cds[0].works[0].duration, undefined, 'work duration must not double-count track lengths');
      assert.equal(state.doc.cds[0].works[0].type, customType);
      await openCard(page, 'Duration QA');
      assert((await page.locator('.ptotal').textContent()).includes('15:55'));
      await edit(page);
      await page.locator('.trow .iconbtn').first().click();
      assert.equal(await page.locator('.w-duration').isHidden(), true, 'one track still uses its own duration');
      assert.equal(await page.locator('.t-len').inputValue(), '3:21');
      assert.equal(await page.locator('.t-len').isVisible(), true);
      await page.locator('.trow .iconbtn').click();
      assert.equal(await page.locator('.w-duration').inputValue(), '3:21');
      assert.equal(await page.locator('.w-duration').isVisible(), true);
      await save(page); await page.reload();
      await openCard(page, 'Duration QA');
      assert((await page.locator('.ptotal').textContent()).includes('3:21'));
      assert.equal(await page.locator('.pwork-title').textContent(), 'Overture');
      assert.equal(await page.locator('.pwork-duration').textContent(), '3:21');
      await edit(page);
      assert.equal(await page.locator('.trow').count(), 0);
      assert.equal(await page.locator('.w-duration').inputValue(), '3:21');
      assert.equal(await page.locator('.w-type').inputValue(), customType);
      assert.deepEqual(state.doc.cds[0].works[0].tracks, []);
    } finally { await f.close(); }
  });
  await test('custom CD/work types and hub text survive save/edit and drive cards and type filters', async () => {
    const overall = 'Historical anthology / 私家选集', workType = 'Night music / 夜曲', hub = 'Mirror ring · batch A';
    const f = await fixture({cds: [{id: 'other-type', title: 'Other type QA', type: 'Symphony'}],
      settings: {cardFields: ['type', 'workTypes', 'hub']}}), {page, state} = f;
    try {
      await openAdd(page); await page.locator('#title').fill('Custom type QA');
      assert.equal(await page.locator('#type').getAttribute('list'), 'work-type-options');
      await page.locator('#type').fill(overall);
      await page.locator('.w-title').fill('Nocturne');
      await page.locator('.w-details > summary').click(); await page.locator('.w-type').fill(workType);
      await page.locator('#more-details').evaluate(n => n.open = true);
      assert.equal(await page.locator('#hub').evaluate(n => n.tagName), 'INPUT');
      assert.equal(await page.locator('#hub').getAttribute('list'), 'hub-options');
      await page.locator('#hub').fill(hub); await save(page);
      const cd = state.doc.cds.find(c => c.title === 'Custom type QA');
      assert.equal(cd.type, overall); assert.equal(cd.hub, hub); assert.equal(cd.works[0].type, workType);
      const card = page.locator('#card-' + cd.id);
      for (const text of [overall, hub]) assert((await card.innerText()).includes(text), text);
      assert(!(await card.innerText()).includes(workType), 'work override stays out of the card text');
      assert.equal(await page.locator('.work-info-popup').count(), 0, 'work details start hidden');
      await card.locator('.work-info').hover();
      await page.locator('.work-info-popup').waitFor();
      assert((await page.locator('.work-info-popup').innerText()).includes(workType), workType);
      assert.equal(await page.locator('#win-detail').isVisible(), false, 'work info hover opened the profile');
      await page.locator('#filter-btn').click();
      for (const [type, title] of [[overall, 'Custom type QA'], [workType, 'Custom type QA'], ['Symphony', 'Other type QA']]) {
        await page.locator('#f-type label').filter({has: page.getByText(type, {exact: true})}).locator('input').check();
        assert.deepEqual(await page.locator('#grid .card h3').allTextContents(), [title]);
        await page.locator('#f-clear').click();
      }
      await page.locator('#f-done').click(); await openCard(page, 'Custom type QA');
      assert(!(await page.locator('#win-detail').innerText()).includes(workType), 'profile work override stays in the info popup');
      assert.equal(await page.locator('.work-info-popup').count(), 0, 'profile work details start hidden');
      await page.locator('#detail-body .work-info').hover();
      await page.locator('.work-info-popup').waitFor();
      assert((await page.locator('.work-info-popup').innerText()).includes(workType), workType);
      for (const text of [overall, hub]) assert((await page.locator('#win-detail').innerText()).includes(text), text);
      await edit(page);
      assert.equal(await page.locator('#type').inputValue(), overall);
      assert.equal(await page.locator('.w-type').inputValue(), workType);
      assert.equal(await page.locator('#hub').inputValue(), hub);
      await page.locator('#hub').fill(''); await page.locator('#type').fill(''); await save(page);
      const cleared = state.doc.cds.find(c => c.id === cd.id);
      assert.equal(cleared.hub, undefined); assert.equal(cleared.type, undefined);
      await page.reload(); await openCard(page, 'Custom type QA');
      assert.equal(await page.locator('#win-detail').getByText(hub, {exact: true}).count(), 0);
      await edit(page);
      assert.equal(await page.locator('#hub').inputValue(), '');
      assert.equal(await page.locator('#type').inputValue(), '');
      assert.equal(await page.locator('.w-type').inputValue(), workType);
    } finally { await f.close(); }
  });
  await test('localized type/hub datalist suggestions normalize known values without an Unknown choice', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      for (const [lang, type, hub, value, hubs] of [
        ['en', 'Piano concerto', 'Full silver hub', 'full', ['Full silver hub', 'Partial silver hub', 'Clear hub', 'Other']],
        ['ja', 'ピアノ協奏曲', '一部銀色ハブ', 'partial', ['全面銀色ハブ', '一部銀色ハブ', '透明ハブ', 'その他']],
        ['zh', '钢琴协奏曲', '胶圈', 'clear', ['满银圈', '半银圈', '胶圈', '其他']]
      ]) {
        await setLanguage(page, lang); await openAdd(page);
        assert.deepEqual(await page.locator('#hub-options option').evaluateAll(ns => ns.map(n => n.value)), hubs);
        assert((await page.locator('#work-type-options option').evaluateAll(ns => ns.map(n => n.value))).includes(type));
        await page.locator('#title').fill('Known ' + lang); await page.locator('#type').fill(type);
        await page.locator('.w-title').fill('Concerto');
        await page.locator('.w-details > summary').click(); await page.locator('.w-type').fill(type);
        await page.locator('#more-details').evaluate(n => n.open = true); await page.locator('#hub').fill(hub);
        await save(page);
        const cd = state.doc.cds.find(c => c.title === 'Known ' + lang);
        assert.equal(cd.type, 'PianoConcerto'); assert.equal(cd.works[0].type, 'PianoConcerto'); assert.equal(cd.hub, value);
        await openCard(page, cd.title);
        assert((await page.locator('#win-detail').innerText()).includes(hub));
        await edit(page);
        assert.equal(await page.locator('#type').inputValue(), type);
        assert.equal(await page.locator('.w-type').inputValue(), type);
        assert.equal(await page.locator('#hub').inputValue(), hub); await save(page);
      }
    } finally { await f.close(); }
  });
  await test('work-only audio gets virtual track slots and metadata fills work duration without creating tracks', async () => {
    const f = await fixture({nativeAudio: true, settings: {cardFields: ['totalTime']}, cds: [{
      id: 'virtual-audio', title: 'Virtual audio QA', works: [
        {title: 'Ambient work', duration: '12:34', tracks: []},
        {title: 'Untimed work', tracks: []},
        {title: 'Movement work', duration: '99:00', tracks: [{title: 'Finale', duration: '3:21'}]}
      ], audio: [1, 2, 3].map(n => ({file: 'virtual-audio/' + n + '.wav', name: n + '.wav', size: 16044, track: n}))
    }]}), {page, state} = f;
    try {
      await openCard(page, 'Virtual audio QA');
      await page.waitForFunction(() => document.querySelector('.ptotal')?.textContent.includes('15:56'));
      assert.deepEqual(await page.locator('#audio-track-0 option').evaluateAll(ns => ns.map(n => n.value)), ['0', '1', '2', '3']);
      assert.deepEqual(await page.locator('#audio-track-0 option').allTextContents(), [
        'No track', '1. Ambient work  (12:34)', '2. Untimed work  (0:01)', '3. Finale  (3:21)'
      ]);
      assert((await page.locator('#audio-play-0').getAttribute('aria-label')).includes('1. Ambient work'));
      assert.equal(await page.locator('#audio-play-0').isEnabled(), true);
      assert.equal(await page.locator('#audio-track-1').inputValue(), '2');
      assert.equal(state.doc.cds[0].works[0].duration, '12:34', 'typed duration stays unchanged');
      assert.equal(state.doc.cds[0].works[1].duration, '0:01');
      assert.deepEqual(state.doc.cds[0].works[1].tracks, []);
      assert((await page.locator('#card-virtual-audio').innerText()).includes('15:56'), 'sum includes work duration and ignores stale duration on tracked works');
      assert(state.commands.some(c => c.command === 'save_data'));
      await edit(page);
      assert.equal(await page.locator('.work').nth(1).locator('.trow').count(), 0);
      assert.equal(await page.locator('.w-duration').nth(1).inputValue(), '0:01');
      assert.equal(await page.locator('.w-duration').nth(2).isHidden(), true);
    } finally { await f.close(); }
  });
  await test('manual album creation, incomplete counts, shared edits and explicit disc overrides', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      await openAdd(page); await page.locator('#title').fill('Disc one');
      await page.locator('#composer').fill('Shared composer');
      await page.locator('#set-choice').selectOption('+new');
      await page.locator('#set-title').fill('Two-disc album');
      await page.locator('#set-total').fill('3');
      await page.locator('#more-details').evaluate(n => n.open = true);
      await page.locator('#label').fill('Original label');
      await page.locator('#barcode').fill('1234567890123'); await save(page);
      assert.equal(state.doc.cds.length, 1);
      await openCard(page, 'Two-disc album');
      assert((await page.locator('#detail-body').innerText()).includes('1 of 3 CDs catalogued'));
      await page.locator('#set-add').click(); await prepareEditor(page);
      await page.locator('#more-details').evaluate(n => n.open = true);
      assert.equal(await page.locator('#set-disc').inputValue(), '2');
      assert.equal(await page.locator('#label').inputValue(), 'Original label');
      await page.locator('#set-subtitle').fill('Bonus disc');
      await page.locator('#label').fill('Disc-only label');
      assert.equal(await page.locator('#set-follow-label').isChecked(), false);
      await save(page);
      assert.equal(state.doc.cds.length, 2, 'shared barcode does not trigger a duplicate warning');
      assert.equal(await page.locator('#grid .card').count(), 1);
      assert.equal(state.doc.cds.find(c => c.set.disc === 2).set.subtitle, 'Bonus disc');
      await openCard(page, 'Two-disc album'); await page.locator('#set-edit').click();
      await page.locator('#set-title').fill('Renamed album'); await page.locator('#label').fill('New shared label');
      await page.locator('#composer').fill('New composer'); await save(page);
      assert(state.doc.cds.every(c => c.set.title === 'Renamed album' && c.composer === 'New composer'));
      assert.equal(state.doc.cds.find(c => c.set.disc === 1).label, 'New shared label');
      assert.equal(state.doc.cds.find(c => c.set.disc === 2).label, 'Disc-only label');
      await openCard(page, 'Renamed album');
      const second = state.doc.cds.find(c => c.set.disc === 2);
      await page.locator('.set-disc').nth(1).locator('summary').click();
      await page.locator('#set-edit-' + second.id).click();
      await page.locator('#set-follow-label').check(); await save(page);
      assert.equal(state.doc.cds.find(c => c.id === second.id).label, 'New shared label');
    } finally { await f.close(); }
  });
  await test('multi-disc lookup imports all or selected discs atomically and retains per-disc works', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      await openAdd(page); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#lookup-multiple').check();
      assert((await page.locator('#lookup-disc-preview').innerText()).includes('Will save 2 discs'));
      await page.locator('#lookup-disc').selectOption('2');
      await page.locator('#lookup-disc').selectOption('1');
      state.saveFail = true; await page.locator('#submit').click();
      await page.locator('#submit:not(:disabled)').waitFor();
      assert.equal(state.doc.cds.length, 0); assert.equal(await page.locator('#win-cd').isVisible(), true);
      state.saveFail = false; await save(page);
      assert.equal(state.doc.cds.length, 2);
      assert.equal(new Set(state.doc.cds.map(c => c.set.id)).size, 1);
      assert.equal(state.doc.cds.find(c => c.set.disc === 1).works[0].tracks[0].title, 'I. First');
      assert.deepEqual(state.doc.cds.find(c => c.set.disc === 2).works.flatMap(w => w.tracks.map(t => t.title)), ['II. Second', 'Finale']);
      assert.equal(await page.locator('#grid .card').count(), 1);
      await openAdd(page); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#lookup-multiple').check();
      await page.locator('#lookup-disc-choices input[value="2"]').uncheck();
      await page.locator('#catalogNo').fill('Different edition'); await save(page);
      assert.equal(state.doc.cds.length, 3);
      assert.equal(await page.locator('#grid .card').count(), 2, 'same album title does not merge distinct editions');
    } finally { await f.close(); }
  });
  await test('link existing discs preserves their metadata; detach supports Undo', async () => {
    const member = {id:'link-one', title:'First', addedAt:1, label:'Shared', set:{id:'link-set',title:'Linked album',disc:1,total:2}};
    const standalone = {id:'link-two',title:'Existing standalone',addedAt:2,label:'Own label',manufacturer:'Own pressing',extra:{keep:true}};
    const f = await fixture({cds:[member,standalone]}), {page,state} = f;
    try {
      await openCard(page,'Linked album'); await page.locator('#set-link').click();
      await page.locator('.set-link-list input[value="link-two"]').check(); await page.locator('#set-link-save').click();
      await page.waitForFunction(() => document.querySelectorAll('.set-disc').length === 2);
      const linked = state.doc.cds.find(c=>c.id==='link-two');
      assert.equal(linked.set.disc,2); assert.equal(linked.label,'Own label'); assert.equal(linked.manufacturer,'Own pressing');
      assert.deepEqual(linked.extra,{keep:true}); assert(linked.set.overrides.includes('label'));
      await page.locator('.set-disc').nth(1).locator('summary').click();
      await page.locator('#set-detach-link-two').click();
      await page.waitForFunction(() => document.querySelectorAll('.set-disc').length === 1);
      assert.equal(state.doc.cds.find(c=>c.id==='link-two').set,undefined);
      await page.getByRole('button',{name:'Undo',exact:true}).click();
      await page.waitForFunction(() => document.querySelectorAll('.set-disc').length === 2);
      assert.equal(state.doc.cds.find(c=>c.id==='link-two').set.id,'link-set');
    } finally { await f.close(); }
  });
  await test('group selection includes every shown member; ungrouped Favorites can choose individual CDs', async () => {
    const discs = [1,2].map(n=>({id:'select-'+n,title:'Disc '+n,addedAt:n,set:{id:'selection',title:'Selection album',disc:n,total:2}}));
    const f = await fixture({cds:discs}), {page,state} = f;
    try {
      state.doc.meta.albums = [];
      await page.locator('#select-btn').click(); await page.locator('#grid .card').click();
      assert((await page.locator('#sel-count').innerText()).includes('2'));
      await page.locator('#sel-done').click(); await page.locator('#group-discs').click();
      assert.equal(await page.locator('#grid .card').count(),2);
      await page.locator('#select-btn').click(); await page.locator('#card-select-1').click();
      assert((await page.locator('#sel-count').innerText()).includes('1'));
      await page.locator('#sel-done').click();
      await page.locator('#search').fill('Selection album');
      assert.equal(await page.locator('#grid .card').count(),2,'album title is searchable in separate-disc view');
      await page.locator('#group-discs').click();
      assert.equal(await page.locator('#grid .card').count(),1);
      assert.equal(state.doc.meta.settings.groupDiscs,true);
    } finally { await f.close(); }
  });
  await test('whole-album playback and playlists follow disc/track order; enqueue preserves the playing entry', async () => {
    const discs = [2,1].map(n=>({id:'play-'+n,title:'Play '+n,addedAt:n,set:{id:'play-set',title:'Playback album',disc:n,total:2},
      works:[{title:'Work',tracks:[{title:'First',duration:'0:01'},{title:'Second',duration:'0:01'}]}],
      audio:[{file:'play-'+n+'/b.wav',name:'b.wav',track:2},{file:'play-'+n+'/a.wav',name:'a.wav',track:1}]}));
    const f = await fixture({cds:discs,nativeAudio:true}), {page,state} = f;
    try {
      await openCard(page,'Playback album'); await page.locator('#set-play').click();
      const queue = await page.evaluate(()=>JSON.parse(localStorage.getItem('cdc.playlist')));
      assert.deepEqual(queue.queue.map(x=>x.file),['play-1/a.wav','play-1/b.wav','play-2/a.wav','play-2/b.wav']);
      await page.locator('#set-enqueue').click();
      const after = await page.evaluate(()=>JSON.parse(localStorage.getItem('cdc.playlist')));
      assert.equal(after.queue.length,4); assert.deepEqual(after.queue[after.index],queue.queue[queue.index]);
      await page.locator('#set-playlist').selectOption('+new');
      await page.locator('#album-name').fill('Album playlist'); await page.locator('#album-form button[type="submit"]').click();
      assert.deepEqual(state.doc.meta.playlists[0].items.map(x=>x.file),queue.queue.map(x=>x.file));
      await page.locator('#close-detail').click();
      await page.getByRole('button',{name:/All music/}).first().click();
      assert.equal(await page.locator('#grid .card').count(),1);
      await page.locator('#grid .card').click();
      assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('cdc.playlist')))).queue.length,4);
    } finally { await f.close(); }
  });
  await test('album deletion restores both CDs and their playlist/Favorites membership with Undo', async () => {
    const discs = [1,2].map(n=>({id:'delete-'+n,title:'Delete '+n,addedAt:n,set:{id:'delete-set',title:'Delete album',disc:n,total:2}}));
    const f=await fixture({cds:discs,albums:[{id:'keep-fav',name:'Keep Favorite',cdIds:discs.map(c=>c.id)}],
      playlists:[{id:'keep-pl',name:'Keep playlist',items:[{cdId:'delete-2',file:'delete-2/audio.wav'}]}],
      order:{all:['delete-2','delete-1'],music:[]}}), {page,state}=f;
    try {
      await openCard(page,'Delete album'); await page.locator('#set-delete-all').click();
      assert((await page.locator('#detail-body').innerText()).includes('Delete all 2 catalogued CDs'));
      await page.locator('#set-remove-confirm').click();
      await page.locator('#toast-action').waitFor();
      await until(()=>state.doc.cds.length===0);
      assert.equal(state.doc.cds.length,0);
      await page.getByRole('button',{name:'Undo',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('#grid .card').length===1 && document.querySelector('#grid').textContent.includes('Delete album'));
      await until(()=>state.doc.cds.length===2 && state.doc.meta.albums[0].cdIds.length===2 && state.doc.meta.playlists[0].items.length===1);
      assert.equal(state.doc.cds.length,2); assert(state.doc.cds.every(c=>c.set.id==='delete-set'));
      assert.deepEqual(state.doc.meta.albums[0].cdIds,['delete-1','delete-2']);
      assert.deepEqual(state.doc.meta.playlists[0].items,[{cdId:'delete-2',file:'delete-2/audio.wav'}]);
      assert.deepEqual(state.doc.meta.order.all,['delete-2','delete-1']);
    } finally {await f.close();}
  });
  await test('shared album edits preserve physical fields, custom covers, empty overrides and unknown extensions', async () => {
    const shared={composer:'Shared composer',type:'',performers:[],label:'Shared label',issuer:'',releaseYear:'2000',catalogNo:'CAT',barcode:''};
    const discs=[1,2].map(n=>({id:'cover-'+n,title:'Cover '+n,addedAt:n,...shared,manufacturer:'Pressing '+n,recordingYear:'199'+n,
      photoFile:n===1?'shared.png':'own.png',extra:{n},
      set:{id:'cover-set',title:'Cover album',disc:n,total:2,shared,overrides:n===1?[]:['cover','label'],extra:{preserve:n}}}));
    discs[1].label='';
    const f=await fixture({cds:discs,nativeAudio:true}),{page,state}=f;
    try {
      await openCard(page,'Cover album'); await page.locator('#set-edit').click();
      await page.locator('#composer').fill('Changed composer'); await page.locator('#label').fill('Changed label');
      state.saveFail=true;await page.locator('#submit').click();await page.locator('#submit:not(:disabled)').waitFor();
      assert(state.doc.cds.every(c=>c.composer==='Shared composer'));
      state.saveFail=false;await save(page);
      for(const n of [1,2]) {
        const c=state.doc.cds.find(c=>c.id==='cover-'+n);
        assert.equal(c.composer,'Changed composer');assert.equal(c.manufacturer,'Pressing '+n);assert.equal(c.recordingYear,'199'+n);
        assert.deepEqual(c.extra,{n});assert.deepEqual(c.set.extra,{preserve:n});
      }
      assert.equal(state.doc.cds.find(c=>c.id==='cover-1').photoFile,'shared.png');
      assert.equal(state.doc.cds.find(c=>c.id==='cover-2').photoFile,'own.png');
      assert.equal(state.doc.cds.find(c=>c.id==='cover-2').label,'');
      assert.equal(state.commands.filter(c=>c.command==='save_cover').length,0,'untouched cover files stay untouched');
      await openCard(page,'Cover album');await page.locator('.set-disc').nth(1).locator('summary').click();
      await page.locator('#set-edit-cover-2').click();await page.locator('#set-follow-cover').check();await save(page);
      assert.equal(state.doc.cds.find(c=>c.id==='cover-2').photoFile,'shared.png');
    }finally{await f.close();}
  });
  await test('main album cover survives when every disc uses its own cover and exports embedded image data',async()=>{
    const shared={composer:'',type:'',performers:[],label:'',issuer:'',releaseYear:'',catalogNo:'',barcode:''};
    const discs=[1,2].map(n=>({id:'main-cover-'+n,title:'Own cover '+n,addedAt:n,photoFile:'own-'+n+'.png',
      set:{id:'main-cover-set',title:'Main cover album',disc:n,total:2,shared,cover:{photoFile:'album-main.png'},overrides:['cover']}}));
    const f=await fixture({cds:discs,nativeAudio:true}),{page,state}=f;
    try {
      await openCard(page,'Main cover album');
      assert((await page.locator('.profile-cover img').getAttribute('src')).includes('album-main.png'));
      await page.locator('#set-edit').click();
      const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=4;c.getContext('2d').fillRect(0,0,4,4);return c.toDataURL('image/png');});
      await page.locator('#photo').setInputFiles({name:'new-main.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
      await save(page);
      assert(state.doc.cds.every(c=>c.set.cover.photoFile==='saved-cover.png' && !c.set.cover.photo));
      assert.equal(state.doc.cds.find(c=>c.id==='main-cover-1').photoFile,'own-1.png');
      assert.equal(state.doc.cds.find(c=>c.id==='main-cover-2').photoFile,'own-2.png');
      assert.equal(state.commands.filter(c=>c.command==='save_cover').length,1,'shared content is written once');
      await openCard(page,'Main cover album');
      assert((await page.locator('.profile-cover img').getAttribute('src')).includes('saved-cover.png'));
      await page.locator('#close-detail').click();await page.locator('#open-settings').click();
      const downloading=page.waitForEvent('download');await page.locator('#export-json').click();const download=await downloading;
      const stream=await download.createReadStream(), chunks=[];for await(const chunk of stream)chunks.push(chunk);
      const exported=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert(exported.cds.every(c=>c.set.cover.photo.startsWith('data:image/') && !c.set.cover.photoFile));
      assert(state.doc.cds.every(c=>c.set.cover.photoFile==='saved-cover.png'),'export does not mutate local file references');
    }finally{await f.close();}
  });
  await test('switching shared edit scope preserves unsaved disc overrides, performer rows and role choices',async()=>{
    const shared={composer:'Composer',type:'',performers:[],label:'Default label',issuer:'',releaseYear:'',catalogNo:'',barcode:''};
    const discs=[1,2].map(n=>({id:'scope-'+n,title:'Scope '+n,addedAt:n,...shared,label:n===1?'Default label':'Own label',
      set:{id:'scope-set',title:'Scope album',disc:n,total:2,shared,overrides:n===1?[]:['label']}}));
    const f=await fixture({cds:discs}),{page,state}=f;
    try {
      await openCard(page,'Scope album');await page.locator('.set-disc').nth(1).locator('summary').click();
      await page.locator('#set-edit-scope-2').click();await page.locator('#more-details').evaluate(n=>n.open=true);
      await page.locator('#label').fill('Unsaved own label');await page.locator('#perf-rows .perf-name').fill('Unsaved person');
      await page.locator('#set-edit-shared').check();
      assert.equal(await page.locator('#label').inputValue(),'Default label');
      assert.equal(await page.locator('#set-follow-label').isDisabled(),true);
      await page.locator('#set-edit-shared').uncheck();
      assert.equal(await page.locator('#label').inputValue(),'Unsaved own label');
      assert.equal(await page.locator('#perf-rows .perf-name').inputValue(),'Unsaved person');
      assert.equal(await page.locator('#set-follow-label').isChecked(),false);
      await save(page);
      assert.equal(state.doc.cds.find(c=>c.id==='scope-2').label,'Unsaved own label');
      assert.equal(state.doc.cds.find(c=>c.id==='scope-2').performers[0].name,'Unsaved person');
      assert.equal(state.doc.cds.find(c=>c.id==='scope-1').label,'Default label');
    }finally{await f.close();}
  });
  await test('album custom reordering moves every member together, and incomplete disc numbers are validated',async()=>{
    const discs=[{id:'order-a',title:'A',addedAt:3},{id:'order-b1',title:'B1',addedAt:2,set:{id:'order-b',title:'B album',disc:1,total:3}},
      {id:'order-b2',title:'B2',addedAt:1,set:{id:'order-b',title:'B album',disc:2,total:3}}];
    const f=await fixture({cds:discs,order:{all:['order-a','order-b1','order-b2'],music:[]}}),{page,state}=f;
    try {
      await page.locator('#card-order-b1').focus();await page.keyboard.press('Alt+ArrowLeft');
      assert.deepEqual(state.doc.meta.order.all,['order-b1','order-b2','order-a']);
      await openCard(page,'B album');await page.locator('#set-add').click();
      await page.locator('#set-disc').fill('2');await page.locator('#submit').click();
      assert((await page.locator('#set-err').innerText()).includes('already contains disc 2'));
      assert.equal(state.doc.cds.length,3);
      await page.locator('#set-disc').fill('3');await page.locator('#set-total').fill('2');await page.locator('#submit').click();
      assert((await page.locator('#set-err').innerText()).length>0);
      await page.locator('#close-cd').click();await page.locator('#cd-unsaved-keep').click();
      assert.equal(await page.locator('#set-disc').inputValue(),'3');
      await page.locator('#close-cd').click();await page.locator('#cd-unsaved-discard').click();
      assert.equal(state.doc.cds.length,3);
    }finally{await f.close();}
  });
  await test('album profile/form fit all locales and themes; folds retain state without replaying animations',async()=>{
    const discs=[1,2].map(n=>({id:'layout-'+n,title:'Disc '+n,addedAt:n,composer:'Shared composer',set:{id:'layout-set',title:'A complete album / box set',disc:n,total:3},
      works:[{title:'A work on disc '+n,tracks:[{title:'A movement',duration:'1:00'}]}]}));
    const f=await fixture({cds:discs}),{page}=f;
    try {
      await openCard(page,'A complete album / box set');await page.emulateMedia({reducedMotion:'no-preference'});
      await page.locator('.set-disc').first().locator('summary').click();
      assert.equal(await page.locator('.set-disc').first().getAttribute('open'),'');
      await setLanguage(page,'ja');
      assert.equal(await page.locator('.set-disc[open]').count(),1);
      assert.equal(await page.locator('.set-disc .is-unfolding').count(),0,'redraw does not replay opening');
      await page.emulateMedia({reducedMotion:'reduce'});
      for(const width of [1280,420,360])for(const lang of ['en','ja','zh'])for(const theme of ['light','dark']) {
        await page.setViewportSize({width,height:860});await setLanguage(page,lang);
        await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
        assert.equal(await page.locator('#win-detail .panel').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,`${lang}/${theme}/${width} profile`);
      }
      if(process.env.CDC_QA_ARTIFACTS){fs.mkdirSync(process.env.CDC_QA_ARTIFACTS,{recursive:true});await page.screenshot({path:path.join(process.env.CDC_QA_ARTIFACTS,'multicd-mobile.png')});}
      await page.locator('#set-edit').click();
      for(const width of [1280,360])for(const lang of ['en','ja','zh']) {
        await page.setViewportSize({width,height:860});await setLanguage(page,lang);
        assert.equal(await page.locator('#win-cd .panel').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,`${lang}/${width} form`);
      }
    }finally{await f.close();}
  });
  await test('legacy sets group on the shelf; disc edits preserve membership extensions and untouched siblings', async () => {
    const membership = {id: 'legacy-box', title: 'Box QA', disc: 1, total: 2, extra: {keep: true}};
    const sibling = {id: 'legacy-two', title: 'Set disc two', addedAt: 2,
      set: {...membership, disc: 2}, cardFields: ['set']};
    const f = await fixture({cds: [{id: 'legacy-one', title: 'Set disc one', addedAt: 1,
      set: membership, cardFields: ['set']}, sibling], settings: {cardFields: ['set']}}), {page, state} = f;
    try {
      assert.equal(await page.locator('#grid .card').count(), 1);
      assert.equal((await page.locator('#grid').innerText()).includes('Box QA'), true);
      await page.locator('#open-settings').click();
      await page.locator('#cf-toggle').click();
      assert.equal(await page.locator('#cf-set, #cf-workTypes').count(), 0);
      assert.equal((await page.locator('#win-settings').innerText()).includes('Album or box set'), false);
      await page.locator('#close-settings').click();
      await openAdd(page);
      assert.equal(await page.locator('#set-fields, #set-title').count(), 2);
      assert.equal(await page.locator('#ff-set, #ff-workTypes').count(), 0);
      await page.locator('#title').fill('Standalone CD');
      await page.locator('#more-details').evaluate(n => n.open = true);
      for (const value of ['1899', '1987–1985', '1985,', '1985–']) {
        await page.locator('#recordingYear').fill(value); await page.locator('#submit').click();
        assert((await page.locator('#recordingYear-err').textContent()).length, value);
      }
      await page.locator('#recordingYear').fill('1985–1987, 1990');
      await page.locator('#hub').fill('Full silver hub'); await save(page);
      const added = state.doc.cds.find(c => c.title === 'Standalone CD');
      assert.equal(added.recordingYear, '1985–1987, 1990'); assert.equal(added.hub, 'full');
      assert.equal(Object.hasOwn(added, 'set'), false);
      await page.locator('#group-discs').click();
      await openCard(page, 'Set disc one');
      assert.equal(await page.locator('#disc-album-open').count(), 1);
      assert.equal(await page.locator('.set-siblings').count(), 0);
      assert.equal(await page.getByRole('button', {name: 'Add another disc to this set', exact: true}).count(), 0);
      await edit(page);
      await page.locator('#title').fill('Edited disc one');
      await page.locator('#more-details').evaluate(n => n.open = true);
      await page.locator('#hub').fill('Partial silver hub'); await save(page);
      assert.deepEqual(state.doc.cds.find(c => c.id === 'legacy-one').set.extra, membership.extra);
      assert.equal(state.doc.cds.find(c => c.id === 'legacy-one').set.id, membership.id);
      assert.deepEqual(state.doc.cds.find(c => c.id === sibling.id), sibling);
      await page.reload(); await openCard(page, 'Edited disc one');
      assert((await page.locator('#win-detail').innerText()).includes('Partial silver hub'));
      await edit(page);
      // Online replacement during an edit must preserve the old membership too.
      await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#lookup-disc-row').waitFor();
      await page.locator('#lookup-disc').selectOption('2'); await save(page);
      assert.deepEqual(state.doc.cds.find(c => c.id === 'legacy-one').set.extra, membership.extra);
      assert.equal(state.doc.cds.find(c => c.id === 'legacy-one').set.disc, membership.disc);
      assert.deepEqual(state.doc.cds.find(c => c.id === sibling.id), sibling);
    } finally { await f.close(); }
  });
  await test('legacy set data roundtrips JSON export and both import modes', async () => {
    const legacy = {id: 'legacy-import', title: 'Stored set disc', addedAt: 1,
      set: {id: 'old-box', title: 'Stored box', disc: 2, total: 3, extension: {preserve: true}}};
    const f = await fixture({cds: [legacy]}), {page, state} = f;
    try {
      await page.locator('#open-settings').click();
      const download = page.waitForEvent('download');
      await page.locator('#export-json').click();
      const stream = await (await download).createReadStream();
      const chunks = []; for await (const chunk of stream) chunks.push(chunk);
      const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert.deepEqual(exported.cds[0].set, legacy.set);
      const imported = {...legacy, id: 'another-legacy', title: 'Imported set disc'};
      for (const replace of [false, true]) {
        await page.locator('#import-file').setInputFiles({name: 'legacy.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify({cds: [imported], meta: {}}))});
        await page.locator(replace ? '#import-replace' : '#import-merge').click();
        await page.locator('#import-ask').waitFor({state: 'hidden'});
        assert.deepEqual(state.doc.cds.find(c => c.id === imported.id).set, legacy.set);
        assert.equal(state.doc.cds.length, replace ? 1 : 2);
      }
      // Backups use the same unrestricted document reader as JSON import.
      const start = html.indexOf('  function readCdcDoc('), end = html.indexOf('  function renderRestore(', start);
      const read = vm.runInNewContext(html.slice(start, end) + '\nreadCdcDoc;');
      assert.deepEqual(read({cds: [legacy], meta: {}}).cds[0].set, legacy.set);
    } finally { await f.close(); }
  });
  await test('obsolete workTypes choices migrate to works and deduplicate before the six-field limit', async () => {
    const start = html.indexOf('  function capFields('), end = html.indexOf('  function cardFields(', start);
    assert(start >= 0 && end > start);
    const cap = vm.runInNewContext('var CARD_FIELD_MAX = 6, FAV_TAGS_OFF = "-albums";\n' + html.slice(start, end) + '\ncapFields;');
    const input = ['workTypes', 'works', 'composer', 'label', 'issuer', 'recordingYear', 'releaseYear', '-albums'];
    assert.deepEqual(Array.from(cap(input)), ['works', 'composer', 'label', 'issuer', 'recordingYear', 'releaseYear', '-albums']);
    assert.equal(input[0], 'workTypes', 'read-time migration must not mutate stored choices');
    const f = await fixture({cds: [{id: 'work-migration', title: 'Migrated choices',
      cardFields: ['workTypes', 'works'], works: [{title: 'Visible work', tracks: []}]}],
      settings: {cardFields: ['workTypes', 'works']}}), {page} = f;
    try {
      assert((await page.locator('#grid').innerText()).includes('Visible work'));
      await openCard(page, 'Migrated choices'); await edit(page);
      await page.locator('#ff-toggle').click();
      assert.equal(await page.locator('#ff-workTypes').count(), 0);
      assert.equal(await page.locator('#ff-works').isChecked(), true);
    } finally { await f.close(); }
  });
  await test('Discogs cross-disc works, disc selection, source punctuation and saved selected disc', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      await openAdd(page); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#lookup-disc-row').waitFor();
      assert.equal(await page.locator('#title').inputValue(), multiTitle);
      assert.equal(await page.locator('#type').inputValue(), '', 'mixed release must not infer one overall CD type');
      assert.equal(await page.locator('#lookup-disc option').count(), 2);
      assert.equal(await page.locator('.t-title').count(), 1);
      assert.equal(await page.locator('.t-title').inputValue(), 'I. First');
      await page.locator('#lookup-disc').selectOption('2');
      assert.deepEqual(await page.locator('.t-title').evaluateAll(ns => ns.map(n => n.value)), ['II. Second', 'Finale']);
      assert.deepEqual(await page.locator('.w-type').evaluateAll(ns => ns.map(n => n.value)), ['Symphony', 'Piano concerto']);
      assert.equal(await page.locator('#set-fields').count(), 1);
      await save(page);
      assert.equal(Object.hasOwn(state.doc.cds[0], 'set'), false);
      assert.deepEqual(state.doc.cds[0].works.flatMap(w => w.tracks.map(t => t.title)), ['II. Second', 'Finale']);
      await openCard(page, multiTitle); await edit(page);
      assert.equal(await page.locator('#set-fields').count(), 1);
      assert.equal(await page.locator('.w-duration').first().isHidden(), true);
      assert.equal(await page.locator('.t-len').first().inputValue(), '3:21');
      assert.equal(await page.locator('.t-len').first().isVisible(), true);
    } finally { await f.close(); }
  });
  await test('Discogs infers overall type for a uniform release and clears its automatic type for a mixed release', async () => {
    const f = await fixture({settings: {cardFields: ['type']}}), {page, state} = f;
    try {
      state.releases[103] = {id: 103, title: 'Uniform symphonies', formats: [{name: 'CD', qty: '2'}], tracklist: [
        {type_: 'track', position: '1-1', title: 'Symphony No. 1', duration: '1:11'},
        {type_: 'track', position: '2-1', title: 'Symphony No. 2', duration: '2:22'}
      ]};
      await openAdd(page); await search(page);
      await page.locator('#lookup-use-2').click();
      await page.waitForFunction(() => document.getElementById('title').value === 'Uniform symphonies');
      assert.equal(await page.locator('#type').inputValue(), 'Symphony');
      await page.locator('#lookup-disc').selectOption('2');
      assert.equal(await page.locator('#type').inputValue(), 'Symphony');
      await page.locator('#lookup-use-0').click();
      await page.waitForFunction(() => document.getElementById('title').value === 'Symphony · Volume · One');
      assert.equal(await page.locator('#type').inputValue(), '');
      await page.locator('#lookup-use-2').click();
      await page.waitForFunction(() => document.getElementById('title').value === 'Uniform symphonies');
      await save(page);
      assert.equal(state.doc.cds[0].type, 'Symphony');
      assert((await page.locator('#grid .card .meta').allTextContents()).includes('Symphony'));
    } finally { await f.close(); }
  });
  await test('late details cannot replace a newer release or resurrect its disc selector', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      state.holds[101] = deferred();
      await openAdd(page); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#lookup-use-1').click();
      await page.waitForFunction(() => document.getElementById('title').value === 'New Single');
      await releaseHeld(page, state, 101);
      assert.equal(await page.locator('#title').inputValue(), 'New Single');
      assert.equal(await page.locator('#lookup-disc-row').isHidden(), true);
      assert.equal(await page.locator('#set-editor').isHidden(), true);
      assert.equal(await page.locator('.w-title').inputValue(), 'New Track');
      assert.equal(await page.locator('.t-title').count(), 0, 'same-name single track stays collapsed after stale details arrive');
    } finally { await f.close(); }
  });
  await test('late details cannot fill a reset form after saving a manually entered CD', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      state.holds[101] = deferred();
      await openAdd(page); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#title').fill('Manual CD'); await save(page);
      await openAdd(page); await releaseHeld(page, state, 101);
      assert.equal(await page.locator('#title').inputValue(), '');
      assert.equal(await page.locator('#lookup-disc-row').isHidden(), true);
      assert.equal(state.doc.cds.length, 1); assert.equal(state.doc.cds[0].title, 'Manual CD');
    } finally { await f.close(); }
  });
  await test('late detail errors cannot replace the current lookup status', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      state.holds[101] = deferred(); state.failures[101] = true;
      await openAdd(page); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#lookup-use-1').click();
      await page.waitForFunction(() => document.getElementById('title').value === 'New Single');
      await releaseHeld(page, state, 101);
      assert.equal(await page.locator('#title').inputValue(), 'New Single');
      assert.equal((await page.locator('#lookup-status').textContent()).includes('Could not reach Discogs'), false);
    } finally { await f.close(); }
  });
  await test('localized import/form/profile controls fit desktop and narrow widths', async () => {
    const f = await fixture(), {page} = f;
    try {
      await openAdd(page); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#lookup-disc-row').waitFor(); await page.locator('#lookup-disc').selectOption('2');
      for (const width of [1280, 420, 360]) {
        await page.setViewportSize({width, height: 800});
        for (const lang of ['en', 'ja', 'zh']) {
          await setLanguage(page, lang);
          const expected = {en: 'Disc 2 of 2', ja: '全2枚中のディスク2', zh: '第 2 碟，共 2 碟'}[lang];
          assert.equal(await page.locator('#lookup-disc').inputValue(), '2');
          assert.equal(await page.locator('#lookup-disc option:checked').textContent(), expected);
          const overflow = await page.locator('#cd-form .input, #cd-form button, #cd-form fieldset').evaluateAll(ns =>
            ns.filter(n => n.getClientRects().length && !n.classList.contains('sr')).filter(n => {
              const r = n.getBoundingClientRect(); return r.x < -1 || r.right > innerWidth + 1;
            }).map(n => n.id || n.className));
          assert.deepEqual(overflow, [], `${lang} form at ${width}px`);
          assert.equal(await page.locator('#win-cd .panel').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
        }
      }
      await save(page); await openCard(page, multiTitle);
      for (const width of [1280, 420, 360]) {
        await page.setViewportSize({width, height: 800});
        for (const lang of ['en', 'ja', 'zh']) {
          await setLanguage(page, lang);
          assert.equal(await page.locator('#win-detail .panel').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true, `${lang} profile at ${width}px`);
          const overflow = await page.locator('.set-siblings button, #win-detail .psect > .linkbtn').evaluateAll(ns =>
            ns.filter(n => {const r = n.getBoundingClientRect(); return r.x < -1 || r.right > innerWidth + 1;}).map(n => n.textContent));
          assert.deepEqual(overflow, [], `${lang} set navigation at ${width}px`);
          if (process.env.CDC_QA_ARTIFACTS && width === 420) {
            fs.mkdirSync(process.env.CDC_QA_ARTIFACTS, {recursive: true});
            await page.screenshot({path: path.join(process.env.CDC_QA_ARTIFACTS, `profile-${lang}.png`)});
          }
        }
      }
    } finally { await f.close(); }
  });
}
main().catch(error => {console.error(error); process.exitCode = 1;}).finally(async () => {
  if (browser) await browser.close();
  const failed = results.filter(r => !r.pass).length;
  console.log(`${results.length - failed}/${results.length} integration checks passed (index.html SHA-256 ${sourceHash})`);
  if (failed) process.exitCode = 1;
});
