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
async function fixture() {
  const state = {doc: {cds: [], meta: {albums: [], playlists: [], settings: {lang: 'en'}}},
    releases: {101: multi, 102: single}, holds: {}, failures: {}, requested: [], errors: []};
  const context = await browser.newContext({viewport: {width: 1280, height: 860}, reducedMotion: 'reduce'});
  await context.addInitScript(() => {
    window.CDC_DESKTOP = true;
    localStorage.setItem('cdc.lang', 'en');
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === 'cdc-integration.test') {
      if (url.pathname === '/') return route.fulfill({contentType: 'text/html', body: html});
      if (url.pathname === '/api/data') {
        if (request.method() === 'PUT') state.doc = request.postDataJSON();
        return route.fulfill({json: state.doc});
      }
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
    // No real accounts, audio library, network services, fonts or cover downloads are used.
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
  await test('single-work duration survives adding/removing tracks, validation and edit/reload', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      await page.locator('#open-add').click();
      await page.locator('#title').fill('Duration QA');
      await page.locator('.w-title').fill('Overture');
      await page.locator('.w-type').selectOption('Overture');
      await page.locator('.w-duration').fill('12:99');
      await page.locator('#submit').click();
      assert((await page.locator('#works-err').textContent()).length);
      assert.equal(await page.locator('.w-duration').evaluate(n => n === document.activeElement), true);
      await page.locator('.w-duration').fill('12:34');
      await page.locator('#work-list .linkbtn').click();
      assert.equal(await page.locator('.w-duration').isHidden(), true);
      assert.equal(await page.locator('.t-len').first().inputValue(), '12:34');
      assert.equal(await page.locator('.t-len').first().isVisible(), true);
      await page.locator('.t-title').nth(1).fill('Second');
      await page.locator('.t-len').nth(1).fill('3:21');
      await page.locator('.trow .iconbtn').first().click();
      assert.equal(await page.locator('.w-duration').inputValue(), '3:21');
      await page.locator('.w-duration').fill('12:34');
      await page.locator('#work-list .linkbtn').click();
      await page.locator('.t-title').nth(1).fill('Finale');
      await page.locator('.t-len').nth(1).fill('3:21');
      await save(page);
      assert.deepEqual(state.doc.cds[0].works[0].tracks.map(t => t.duration), ['12:34', '3:21']);
      assert.equal(state.doc.cds[0].works[0].type, 'Overture');
      await openCard(page, 'Duration QA');
      assert((await page.locator('#win-detail').innerText()).includes('15:55'));
      await page.getByRole('button', {name: 'Edit', exact: true}).click();
      await page.locator('.trow .iconbtn').nth(1).click();
      assert.equal(await page.locator('.w-duration').inputValue(), '12:34');
      await save(page); await page.reload();
      await openCard(page, 'Duration QA');
      assert((await page.locator('#win-detail').innerText()).includes('12:34'));
      await page.getByRole('button', {name: 'Edit', exact: true}).click();
      assert.equal(await page.locator('.w-duration').inputValue(), '12:34');
      assert.equal(await page.locator('.w-type').inputValue(), 'Overture');
    } finally { await f.close(); }
  });
  await test('recording ranges, silver hubs and linked set add/edit/rename/detach roundtrip', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      await page.locator('#open-add').click();
      await page.locator('#title').fill('Set disc one');
      await page.locator('#more-details').evaluate(n => n.open = true);
      for (const value of ['1899', '1987–1985', '1985,', '1985–']) {
        await page.locator('#recordingYear').fill(value); await page.locator('#submit').click();
        assert((await page.locator('#recordingYear-err').textContent()).length, value);
      }
      await page.locator('#recordingYear').fill('1985–1987, 1990');
      await page.locator('#hub').selectOption('full');
      await page.locator('#set-title').fill('Box QA'); await save(page);
      const first = state.doc.cds.find(c => c.title === 'Set disc one');
      assert.equal(first.recordingYear, '1985–1987, 1990'); assert.equal(first.hub, 'full');
      await openCard(page, 'Set disc one');
      assert((await page.locator('#win-detail').innerText()).includes('Full silver hub'));
      await page.getByRole('button', {name: 'Add another disc to this set', exact: true}).click();
      assert.equal(await page.locator('#set-disc').inputValue(), '2');
      await page.locator('#title').fill('Set disc two');
      await page.locator('#set-disc').fill('1'); await page.locator('#submit').click();
      assert((await page.locator('#discSet-err').textContent()).includes('already contains disc 1'));
      await page.locator('#set-disc').fill('2'); await save(page);
      assert.equal(state.doc.cds.length, 2);
      assert.equal(state.doc.cds.find(c => c.title === 'Set disc two').set.id, first.set.id);
      await openCard(page, 'Set disc two');
      await page.locator('.set-siblings button').first().click();
      assert.equal(await page.locator('#detail-h').textContent(), 'Set disc one');
      await page.getByRole('button', {name: 'Edit', exact: true}).click();
      assert.equal(await page.locator('#recordingYear').inputValue(), '1985–1987, 1990');
      assert.equal(await page.locator('#hub').inputValue(), 'full');
      await page.locator('#set-total').fill('1'); await page.locator('#submit').click();
      assert((await page.locator('#discSet-err').textContent()).length);
      await page.locator('#set-title').fill('Renamed QA'); await page.locator('#set-total').fill('3');
      await page.locator('#hub').selectOption('partial'); await save(page);
      assert(state.doc.cds.every(c => c.set.title === 'Renamed QA' && c.set.total === 3 && c.set.id === first.set.id));
      await page.reload(); await openCard(page, 'Set disc one');
      assert((await page.locator('#win-detail').innerText()).includes('Partial silver hub'));
      await page.getByRole('button', {name: 'Edit', exact: true}).click();
      await page.locator('#set-title').fill(''); await page.locator('#hub').selectOption('other'); await save(page);
      assert.equal(state.doc.cds.find(c => c.title === 'Set disc one').set, undefined);
      assert.equal(state.doc.cds.find(c => c.title === 'Set disc one').hub, 'other');
      assert.equal(state.doc.cds.find(c => c.title === 'Set disc two').set.title, 'Renamed QA');
    } finally { await f.close(); }
  });
  await test('Discogs cross-disc works, disc selection, source punctuation and saved selected disc', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      await page.locator('#open-add').click(); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#lookup-disc-row').waitFor();
      assert.equal(await page.locator('#title').inputValue(), multiTitle);
      assert.equal(await page.locator('#lookup-disc option').count(), 2);
      assert.equal(await page.locator('.t-title').count(), 1);
      assert.equal(await page.locator('.t-title').inputValue(), 'I. First');
      await page.locator('#lookup-disc').selectOption('2');
      assert.deepEqual(await page.locator('.t-title').evaluateAll(ns => ns.map(n => n.value)), ['II. Second', 'Finale']);
      assert.deepEqual(await page.locator('.w-type').evaluateAll(ns => ns.map(n => n.value)), ['Symphony', 'PianoConcerto']);
      assert.equal(await page.locator('#set-disc').inputValue(), '2');
      await save(page);
      assert.equal(state.doc.cds[0].set.disc, 2); assert.equal(state.doc.cds[0].set.total, 2);
      assert.deepEqual(state.doc.cds[0].works.flatMap(w => w.tracks.map(t => t.title)), ['II. Second', 'Finale']);
      await openCard(page, multiTitle); await page.getByRole('button', {name: 'Edit', exact: true}).click();
      assert.equal(await page.locator('#set-disc').inputValue(), '2');
      assert.equal(await page.locator('.w-duration').first().inputValue(), '3:21');
    } finally { await f.close(); }
  });
  await test('late details cannot replace a newer release or resurrect its disc selector', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      state.holds[101] = deferred();
      await page.locator('#open-add').click(); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#lookup-use-1').click();
      await page.waitForFunction(() => document.getElementById('title').value === 'New Single');
      await releaseHeld(page, state, 101);
      assert.equal(await page.locator('#title').inputValue(), 'New Single');
      assert.equal(await page.locator('#lookup-disc-row').isHidden(), true);
      assert.equal(await page.locator('#set-title').inputValue(), '');
      assert.equal(await page.locator('.t-title').inputValue(), 'New Track');
    } finally { await f.close(); }
  });
  await test('late details cannot fill a reset form after saving a manually entered CD', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      state.holds[101] = deferred();
      await page.locator('#open-add').click(); await search(page); await page.locator('#lookup-use-0').click();
      await page.locator('#title').fill('Manual CD'); await save(page);
      await page.locator('#open-add').click(); await releaseHeld(page, state, 101);
      assert.equal(await page.locator('#title').inputValue(), '');
      assert.equal(await page.locator('#lookup-disc-row').isHidden(), true);
      assert.equal(state.doc.cds.length, 1); assert.equal(state.doc.cds[0].title, 'Manual CD');
    } finally { await f.close(); }
  });
  await test('late detail errors cannot replace the current lookup status', async () => {
    const f = await fixture(), {page, state} = f;
    try {
      state.holds[101] = deferred(); state.failures[101] = true;
      await page.locator('#open-add').click(); await search(page); await page.locator('#lookup-use-0').click();
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
      await page.locator('#open-add').click(); await search(page); await page.locator('#lookup-use-0').click();
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
