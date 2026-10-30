/* Unsaved CD and performer regressions. Run: node tests/unsaved-form.cjs
   Native file operations and saves are mocked in isolated browser contexts. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'src/index.html'), 'utf8');
let playwright;
try { playwright = require(process.env.CDC_PLAYWRIGHT_MODULE || 'playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const executablePath = [process.env.CDC_CHROMIUM_PATH, playwright.chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
const original = {file: 'one/original.flac', name: 'original.flac', size: 1, track: 1};
const missing = {file: 'one/missing.flac', name: 'missing.flac', size: 2, track: 2};
const disc = {id: 'one', title: 'Existing', addedAt: 1, audio: [original, missing],
  works: [{title: 'Work', tracks: [{title: 'First', duration: '1:00'}, {title: 'Second', duration: '2:00'}]}]};
let browser, passed = 0;
const tick = () => new Promise(r => setTimeout(r, 25));
async function until(fn) { for (let i=0; i<100 && !fn(); i++) await tick(); assert(fn(), 'timed out'); }
async function fixture(cds = [disc]) {
  const state = {doc: structuredClone({cds, meta: {albums: [], playlists: [], settings: {lang: 'en'}}}),
    commands: [], files: new Set([original.file]), fail: false, errors: [], serial: 0};
  const context = await browser.newContext({viewport: {width:1280,height:900}, reducedMotion:'reduce'});
  await context.exposeBinding('__native', async (_, cmd, args = {}) => {
    state.commands.push({cmd, args});
    switch(cmd) {
      case 'load_data': return structuredClone(state.doc);
      case 'save_data': if (state.fail) throw Error('Simulated disk failure'); state.doc = structuredClone(args.data); return null;
      case 'covers_root_dir': return 'C:\\qa\\covers';
      case 'audio_root_dir': return 'C:\\qa\\audio';
      case 'tidy_covers': return null;
      case 'cover_data': if(state.coverHold) await state.coverHold; return state.cover;
      case 'save_cover': return 'qa-cover.png';
      case 'audio_present': return args.files.map(f => state.files.has(f));
      case 'add_audio': {
        const file = args.cdId + '/new-' + (++state.serial) + '.flac';
        state.files.add(file);
        if (state.hold) await state.hold;
        return [{file, name:'new.flac', size:3}];
      }
      case 'remove_audio': args.files.forEach(f => state.files.delete(f)); return null;
      default: throw Error('Unexpected command: ' + cmd);
    }
  });
  await context.addInitScript(() => {
    window.CDC_DESKTOP = true; localStorage.setItem('cdc.lang','en');
    window.__TAURI__ = {core:{invoke:(c,a)=>window.__native(c,a),convertFileSrc:f=>location.origin+'/audio/'+encodeURIComponent(f)}};
  });
  await context.route('**/*', route => new URL(route.request().url()).pathname === '/' ?
    route.fulfill({contentType:'text/html',body:html}) : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(4000);
  page.on('pageerror',e=>state.errors.push(e.message));
  await page.goto('http://cdc-audio.test/');
  await page.locator('#grid .card').first().waitFor();
  return {page,state,close:async()=>{await context.close();assert.deepEqual(state.errors,[]);}};
}
async function edit(page) {
  await page.locator('#grid .card[data-id="one"]').click();
  await page.locator('#detail-body').getByRole('button',{name:'Edit',exact:true}).click();
}
async function add(page) { await page.locator('#form-audio-set').evaluate(n=>n.open=true); await page.locator('#form-audio-add').click(); await page.locator('#form-audio-add:not([disabled])').waitFor(); }
async function save(page) { await page.locator('#submit').click(); await page.locator('#win-cd').waitFor({state:'hidden'}); }
async function test(name, fn) { await fn(); passed++; console.log('PASS:',name); }

async function prompt(page, method='x') {
  if(method==='escape') await page.keyboard.press('Escape');
  else if(method==='backdrop') await page.locator('#win-cd').click({position:{x:5,y:5}});
  else await page.locator('#close-cd').click();
  await page.locator('#win-cd-unsaved').waitFor({state:'visible'});
}
async function discard(page) {await page.locator('#cd-unsaved-discard').click();await page.locator('#win-cd').waitFor({state:'hidden'});}
async function openWorks(page) {await page.locator('#works-set').evaluate(n=>n.open=true);}
async function cover(page) {
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=60;c.getContext('2d').fillRect(0,0,80,60);return c.toDataURL('image/png');});
  await page.locator('#photo').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:Buffer.from(png.split(',')[1],'base64')});
  await page.locator('#cover-canvas').waitFor({state:'visible'});
  return png;
}
async function main() {
  browser=await playwright.chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  await test('unchanged new/edit forms and reverted edits close immediately; opening folds is not dirty',async()=>{
    const f=await fixture();const {page}=f;
    try {
      await page.locator('#open-add').click();await page.locator('#close-cd').click();
      assert.equal(await page.locator('#win-cd').isVisible(),false);
      await edit(page);await openWorks(page);
      await page.locator('#title').fill('Changed');await page.locator('#title').fill('Existing');
      await page.keyboard.press('Escape');assert.equal(await page.locator('#win-cd').isVisible(),false);
      assert.equal(await page.locator('#win-cd-unsaved').isVisible(),false);
    }finally{await f.close();}
  });
  await test('X, Escape and backdrop offer Keep editing; prompt dismissal preserves the draft',async()=>{
    const f=await fixture();const {page,state}=f;
    try {
      await edit(page);await page.locator('#title').fill('Draft');
      for(const method of ['x','escape','backdrop']) {
        await prompt(page,method);await page.locator('#cd-unsaved-keep').click();
        assert.equal(await page.locator('#title').inputValue(),'Draft');
      }
      await prompt(page);await page.keyboard.press('Escape');assert.equal(await page.locator('#win-cd').isVisible(),true);
      await prompt(page);await page.locator('#win-cd-unsaved').click({position:{x:5,y:5}});
      assert.equal(await page.locator('#title').inputValue(),'Draft');
      assert.equal(state.doc.cds[0].title,'Existing');await prompt(page);await discard(page);
    }finally{await f.close();}
  });
  await test('new CD Discard clears title, works, cover and copied audio before reopening',async()=>{
    const f=await fixture();const {page,state}=f;
    try {
      await page.locator('#open-add').click();await page.locator('#title').fill('Unsaved new');
      await openWorks(page);await page.locator('.w-title').fill('Unsaved work');await cover(page);await add(page);
      assert.equal(state.files.size,2);await prompt(page);await discard(page);await until(()=>state.files.size===1);
      await page.locator('#open-add').click();assert.equal(await page.locator('#title').inputValue(),'');
      assert.equal(await page.locator('.w-title').inputValue(),'');assert.equal(await page.locator('#cover-canvas').isVisible(),false);
      assert.equal(await page.locator('#form-audio li').count(),0);assert.equal(state.doc.cds.length,1);
      await page.locator('#close-cd').click();assert.equal(await page.locator('#win-cd').isVisible(),false);
    }finally{await f.close();}
  });
  await test('prompt Save uses normal validation, reveals folded invalid fields and keeps failed saves editable',async()=>{
    const f=await fixture();const {page,state}=f;
    try {
      await edit(page);await openWorks(page);await page.locator('.t-len').first().fill('bad');
      await page.locator('#works-set').evaluate(n=>n.open=false);
      await prompt(page);await page.locator('#cd-unsaved-save').click();
      assert.equal(await page.locator('#works-set').getAttribute('open'),'');
      assert.equal(await page.locator('.t-len').first().evaluate(n=>n===document.activeElement),true);
      await page.locator('.t-len').first().fill('1:01');await page.locator('#title').fill('Saved draft');state.fail=true;
      await prompt(page);await page.locator('#cd-unsaved-save').click();await page.locator('#submit:not([disabled])').waitFor();
      assert.equal(await page.locator('#win-cd').isVisible(),true);assert.equal(state.doc.cds[0].title,'Existing');
      state.fail=false;await prompt(page);await page.locator('#cd-unsaved-save').click();await page.locator('#win-cd').waitFor({state:'hidden'});
      assert.equal(state.doc.cds[0].title,'Saved draft');assert.equal(await page.locator('#win-cd-unsaved').isVisible(),false);
      await edit(page);await page.locator('#close-cd').click();assert.equal(await page.locator('#win-cd').isVisible(),false);
    }finally{await f.close();}
  });
  await test('two global/work roles plus custom role survive repeated selection, invalid audio validation and save',async()=>{
    const f=await fixture();const {page,state}=f;
    try {
      await edit(page);const global=page.locator('#perf-rows .prow').first();await global.locator('.perf-name').fill('Global Person');
      await global.locator('summary').click();await global.getByRole('checkbox',{name:'Pianist',exact:true}).check();
      for(let i=0;i<2;i++){await global.getByRole('checkbox',{name:'Pianist',exact:true}).uncheck();await global.getByRole('checkbox',{name:'Pianist',exact:true}).check();}
      await page.keyboard.press('Escape');await openWorks(page);await page.locator('.w-details summary').first().click();
      await page.locator('.w-add-perf').first().click();const row=page.locator('.w-perf-rows .prow').first();await row.locator('.perf-name').fill('Work Person');
      await row.locator('summary').click();await row.getByRole('checkbox',{name:'Conductor',exact:true}).check();await row.getByRole('checkbox',{name:'Pianist',exact:true}).check();
      await row.getByRole('checkbox',{name:'Orchestra',exact:true}).uncheck();
      await row.getByRole('checkbox',{name:'Other',exact:true}).check();await row.locator('.perf-custom-name').fill('Organist');
      await row.locator('.perf-custom-add').click();await page.keyboard.press('Escape');
      await page.locator('.t-len').first().fill('bad');await page.locator('#form-audio-set').evaluate(n=>n.open=true);await page.locator('#form-audio-add').click();
      assert.equal(state.commands.filter(x=>x.cmd==='add_audio').length,0);assert.deepEqual(state.errors,[]);
      await page.locator('.t-len').first().fill('1:00');await save(page);
      assert.deepEqual(state.doc.cds[0].performers.map(p=>p.role),['Conductor','Pianist']);
      assert.deepEqual(state.doc.cds[0].works[0].performers.map(p=>p.role),['Conductor','Pianist','Organist']);
      await page.reload();await edit(page);await page.locator('#close-cd').click();assert.equal(await page.locator('#win-cd').isVisible(),false);
    }finally{await f.close();}
  });
  await test('queued role-menu toggle after row removal does not measure a detached panel',async()=>{
    const f=await fixture();const {page}=f;
    try {await edit(page);await page.evaluate(()=>{const row=document.querySelector('#perf-rows .prow');row.querySelector('details').open=true;row.remove();});
      await page.waitForTimeout(100);assert.deepEqual(f.state.errors,[]);await save(page);
    }finally{await f.close();}
  });
  await test('photo-only, crop-only, performer-only and audio-only edits trigger the guard',async()=>{
    const f=await fixture();const {page}=f;
    try {
      await edit(page);const png=await cover(page);await save(page);
      f.state.cover=png;f.state.doc.cds[0].photo=png;delete f.state.doc.cds[0].photoFile;await page.reload();
      await edit(page);await page.locator('#cover-canvas').waitFor({state:'visible'});
      await page.locator('#cover-zoom').fill('2');await prompt(page);await discard(page);
      await edit(page);await page.locator('#photo-remove').click();await prompt(page);await discard(page);
      await edit(page);await page.locator('#perf-rows .perf-name').fill('Only a performer');await prompt(page);await discard(page);
      await edit(page);await add(page);await prompt(page);await discard(page);await until(()=>f.state.files.size===1);
      await edit(page);await page.locator('#close-cd').click();assert.equal(await page.locator('#win-cd').isVisible(),false);
    }finally{await f.close();}
  });
  await test('asynchronously loaded file cover stays clean; all prompt actions translate in en/ja/zh',async()=>{
    const f=await fixture();const {page,state}=f;
    try {
      const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2;c.height=2;return c.toDataURL('image/png');});
      state.cover=png;state.doc.cds[0].photoFile='cover.png';await page.reload();await edit(page);
      await page.locator('#cover-canvas').waitFor({state:'visible'});await page.locator('#close-cd').click();assert.equal(await page.locator('#win-cd').isVisible(),false);
      const expected={en:['Save','Discard','Keep editing'],ja:['保存','変更を破棄','編集を続ける'],zh:['保存','放弃更改','继续编辑']};
      for(const lang of ['en','ja','zh']) {
        state.doc.meta.settings.lang=lang;await page.reload();
        await page.locator('#open-add').click();await page.locator('#title').fill('Draft');await prompt(page);
        assert.deepEqual(await page.locator('#win-cd-unsaved button').allTextContents(),expected[lang]);await discard(page);
      }
    }finally{await f.close();}
  });
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();console.log(passed+'/8 unsaved form checks passed');});
