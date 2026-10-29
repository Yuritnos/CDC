/* Browser rendering regressions. Run: node tests/rendering.cjs
   Uses the existing Playwright runtime. Native calls, saves and networking are isolated.
   Set CDC_QA_ARTIFACTS to retain profile screenshots. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
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
const customRole = 'Organ & <voice>';
const performerCd = {id: 'multi', title: 'Multiple roles', addedAt: 1, performers: [
  {role: 'Conductor', name: 'Alex Example'}, {role: 'Pianist', name: 'Alex Example'},
  {role: 'Conductor', name: 'Alex Example'}, {role: customRole, name: 'Sam Example'},
  {role: customRole, name: ' Sam Example '}, {name: 'Pat Example'},
  {role: 'Singer', name: '   '}
]};
async function fixture({cds = [performerCd], albums = [], playlists = [], settings = {}} = {}) {
  const state = {doc: structuredClone({cds, meta: {albums, playlists,
    settings: {lang: 'en', cardFields: ['performers'], ...settings}}}), errors: [], saves: 0};
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  await context.exposeBinding('__cdcNativeInvoke', async (_, command, args = {}) => {
    switch (command) {
      case 'load_data': return structuredClone(state.doc);
      case 'save_data': state.doc = structuredClone(args.data); state.saves++; return null;
      case 'covers_root_dir': return 'C:\\isolated-rendering-qa\\covers';
      case 'audio_root_dir': return 'C:\\isolated-rendering-qa\\audio';
      case 'audio_present': return args.files.map(() => false);
      case 'tidy_covers': return null;
      default: throw new Error('Unexpected native command: ' + command);
    }
  });
  await context.addInitScript(() => {
    window.CDC_DESKTOP = true;
    if (!localStorage.getItem('cdc.lang')) localStorage.setItem('cdc.lang', 'en');
    window.__TAURI__ = {core: {
      invoke: (command, args) => window.__cdcNativeInvoke(command, args),
      convertFileSrc: file => location.origin + '/isolated/' + encodeURIComponent(file)
    }};
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'cdc-rendering.test' && url.pathname === '/') {
      return route.fulfill({contentType: 'text/html', body: html});
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  page.on('pageerror', e => state.errors.push(e.message));
  await page.goto('http://cdc-rendering.test/');
  await page.locator('#grid .card').first().waitFor();
  return {page, state, close: async () => {
    await context.close(); assert.deepEqual(state.errors, [], 'uncaught browser errors');
  }};
}
const card = (page, id = 'multi') => page.locator('#grid .card[data-id="' + id + '"]');
async function language(page, value) {
  await page.locator('#lang-set').evaluate((node, value) => {
    node.value = value; node.dispatchEvent(new Event('change', {bubbles: true}));
  }, value);
}
async function closeDetail(page) {
  await page.locator('#close-detail').click();
}
async function waitUntil(fn) {
  for (let i = 0; i < 80; i++) {
    if (fn()) return;
    await new Promise(r => setTimeout(r, 25));
  }
  assert(fn(), 'timed out waiting for isolated save');
}
async function main() {
  browser = await playwright.chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  await test('cards and profiles show each name once with localized, distinct roles and literal custom labels', async () => {
    const f = await fixture(), {page, state} = f;
    const labels = {
      en: ['Conductor / Pianist', customRole, 'Other'],
      ja: ['指揮者 / ピアニスト', customRole, 'その他'],
      zh: ['指挥 / 钢琴家', customRole, '其他']
    };
    try {
      for (const lang of ['en', 'ja', 'zh']) {
        await language(page, lang);
        assert.deepEqual(await card(page).locator('.perfs .name').allTextContents(), ['Alex Example', 'Sam Example', 'Pat Example']);
        assert.deepEqual(await card(page).locator('.perfs .role').allTextContents(), labels[lang]);
        assert.equal(await card(page).locator('.perfs .role voice').count(), 0, 'custom label was interpreted as HTML');
        await card(page).click();
        assert.deepEqual(await page.locator('#detail-body .facts').first().locator('dt').allTextContents(), labels[lang]);
        assert.deepEqual(await page.locator('#detail-body .facts').first().locator('dd').allTextContents(), ['Alex Example', 'Sam Example', 'Pat Example']);
        assert.equal(await page.locator('#detail-body .facts .namelink').count(), 3);
        await closeDetail(page);
      }
      assert.deepEqual(state.doc.cds[0].performers, performerCd.performers, 'rendering changed persisted role pairs');
      await page.locator('#view-list').click();
      assert.equal(await page.locator('#grid .lperf').textContent(), 'Alex Example, Sam Example', 'list summary repeats one person');
    } finally { await f.close(); }
  });
  await test('profile name click includes every role held by that person; role chooser still narrows specifically', async () => {
    const extra = (id, role, name = 'Alex Example') => ({id, title: id, addedAt: 1, performers: [{role, name}]});
    const f = await fixture({cds: [performerCd, extra('conductor', 'Conductor'), extra('piano', 'Pianist'),
      extra('organ', customRole), extra('unrelated', 'Conductor', 'Someone Else')]}), {page} = f;
    try {
      await card(page).click();
      await page.locator('#detail-body .facts').getByRole('button', {name: 'Alex Example', exact: true}).click();
      assert.equal(await page.locator('#win-detail').isVisible(), false);
      assert.deepEqual((await page.locator('#grid .card').evaluateAll(ns => ns.map(n => n.dataset.id))).sort(), ['conductor', 'multi', 'organ', 'piano']);
      for (const role of ['Conductor', 'Pianist', customRole]) {
        await page.locator('#f-role').selectOption(role);
        assert.equal(await page.locator('#f-performer-options input:checked').count(), 1, role + ' was excluded by name link');
      }
      await page.locator('#f-clear').click();
      await page.locator('#f-role').selectOption('Pianist');
      await page.locator('#f-performer-options').getByRole('checkbox', {name: 'Alex Example', exact: true}).check();
      assert.deepEqual((await page.locator('#grid .card').evaluateAll(ns => ns.map(n => n.dataset.id))).sort(), ['multi', 'piano']);
      await page.locator('#f-clear').click();
      await card(page).click();
      await page.locator('#detail-body .facts').getByRole('button', {name: 'Sam Example', exact: true}).click();
      assert.equal(await page.locator('#grid .card').count(), 1);
      assert.equal(await page.locator('#f-performer-options input:checked').count(), 2, 'both legacy whitespace forms remain filterable');
    } finally { await f.close(); }
  });
  await test('selected playlist pencil matches favorite and renames only that playlist, preserving items after reload', async () => {
    const items = [{cdId: 'multi', file: 'multi/track.wav'}];
    const albums = [{id: 'same', name: 'Favorite untouched', cdIds: ['multi']}];
    const f = await fixture({albums, playlists: [{id: 'same', name: 'Evening', items}, {id: 'other', name: 'Other list', items: []}]}), {page, state} = f;
    try {
      assert.equal(await page.locator('#pl-group .shelf-fav-edit').count(), 0);
      await page.locator('#fav-head').click();
      await page.locator('[id="chip-same"]').click();
      const favoriteStyle = await page.locator('#fav-group .shelf-fav-edit').evaluate(n => ({
        w: getComputedStyle(n).width, h: getComputedStyle(n).minHeight, size: getComputedStyle(n).fontSize, text: n.textContent
      }));
      await page.locator('#pl-head').click();
      await page.locator('[id="chip-pl:same"]').click();
      const pencil = page.locator('#pl-group .shelf-fav-edit');
      assert.equal(await pencil.count(), 1);
      assert.equal(await pencil.getAttribute('aria-label'), 'Edit playlist: Evening');
      assert.deepEqual(await pencil.evaluate(n => ({w: getComputedStyle(n).width, h: getComputedStyle(n).minHeight,
        size: getComputedStyle(n).fontSize, text: n.textContent})), favoriteStyle);
      await pencil.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#album-h').textContent(), 'Edit playlist');
      assert.equal(await page.locator('#album-name').inputValue(), 'Evening');
      assert.equal(await page.locator('#album-delete').textContent(), 'Delete playlist');
      await page.locator('#album-name').fill('Renamed evening');
      await page.locator('#album-save').click();
      await page.locator('#win-album').waitFor({state: 'hidden'});
      await waitUntil(() => state.doc.meta.playlists[0].name === 'Renamed evening');
      assert.deepEqual(state.doc.meta.albums, albums, 'playlist edit modified the favorite with the same ID');
      assert.deepEqual(state.doc.meta.playlists, [{id: 'same', name: 'Renamed evening', items}, {id: 'other', name: 'Other list', items: []}]);
      await page.reload();
      await page.locator('[id="chip-pl:same"]').click();
      assert.equal(await page.locator('#pl-group .shelf-fav-edit').getAttribute('aria-label'), 'Edit playlist: Renamed evening');
      await page.locator('[id="chip-pl:other"]').click();
      assert.equal(await page.locator('#pl-group .shelf-fav-edit').count(), 1);
      assert.equal(await page.locator('#pl-group .shelf-fav-edit').getAttribute('aria-label'), 'Edit playlist: Other list');
      await page.locator('#chip-all').click();
      assert.equal(await page.locator('#pl-group .shelf-fav-edit').count(), 0);
    } finally { await f.close(); }
  });
  await test('work-only durations sit independently at the right in smaller muted monospace, including long titles at narrow widths', async () => {
    const longTitle = 'A very long work title with an unbroken catalogue reference ' + 'LongWorkName'.repeat(12);
    const works = [{title: longTitle, duration: '1:23:45', tracks: []}, {title: 'Short work', duration: '3:12'},
      {title: 'Tracked work', duration: '99:00', tracks: [{title: 'Movement', duration: '2:34'}]},
      {title: 'No timing', tracks: []}, {title: '', duration: '7:08', tracks: []}];
    const f = await fixture({cds: [{...performerCd, works}]}), {page} = f;
    try {
      await card(page).click();
      for (const width of [1280, 420, 360, 320]) {
        await page.setViewportSize({width, height: 900});
        for (const lang of ['en', 'ja', 'zh']) {
          await language(page, lang);
          for (const theme of ['light', 'dark']) {
            await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
            const work = page.locator('#detail-body .pwork');
            assert.deepEqual(await work.locator('.pwork-duration').allTextContents(), ['1:23:45', '3:12', '7:08']);
            assert.equal(await work.first().locator('.pwork-title').textContent(), longTitle);
            assert.equal(await work.nth(2).locator('.pwork-duration').count(), 0, 'tracked work displays an independent duration');
            assert.equal(await work.nth(2).locator('.ptracks .len').textContent(), '2:34');
            assert.equal(await work.last().locator('.pwork-title').textContent(), '—');
            const geometry = await work.locator('.pwork-duration').evaluateAll(nodes => nodes.map(n => {
              const title = n.parentElement.querySelector('.pwork-title'), h = n.parentElement.getBoundingClientRect();
              const d = n.getBoundingClientRect(), t = title.getBoundingClientRect(), s = getComputedStyle(n), ts = getComputedStyle(title);
              const probe = document.createElement('span'); probe.style.color = 'var(--muted)'; n.appendChild(probe);
              const muted = getComputedStyle(probe).color; probe.remove();
              return {right: Math.abs(d.right - h.right) < 1, noOverlap: t.right + 9 <= d.left,
                fits: d.right <= innerWidth && h.left >= 0 && h.right <= innerWidth,
                size: s.fontSize, smaller: parseFloat(s.fontSize) < parseFloat(ts.fontSize),
                mono: s.fontFamily.includes('Mono'), muted: s.color === muted,
                singleLine: d.height <= parseFloat(s.lineHeight) + 1,
                titleWrapped: t.height > parseFloat(ts.lineHeight) * 2};
            }));
            for (const g of geometry) {
              assert.equal(g.right && g.noOverlap && g.fits && g.smaller && g.mono && g.muted && g.singleLine, true,
                `${width}px ${lang} ${theme}: ${JSON.stringify(g)}`);
              assert.equal(g.size, '12px');
            }
            assert(geometry[0].titleWrapped, 'long title did not wrap');
          }
        }
        if (process.env.CDC_QA_ARTIFACTS && [1280, 360].includes(width)) {
          fs.mkdirSync(process.env.CDC_QA_ARTIFACTS, {recursive: true});
          await page.locator('#detail-body .pwork').first().scrollIntoViewIfNeeded();
          await page.screenshot({path: path.join(process.env.CDC_QA_ARTIFACTS, `rendering-profile-${width}.png`)});
        }
      }
    } finally { await f.close(); }
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  console.log(`${results.filter(Boolean).length}/${results.length} rendering checks passed`);
  if (results.includes(false)) process.exitCode = 1;
});
