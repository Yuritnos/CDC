/* Audio editor regression tests. Run: node tests/audio-draft.cjs
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
async function add(page) { await page.locator('#form-audio-add').click(); await page.locator('#form-audio-add:not([disabled])').waitFor(); }
async function save(page) { await page.locator('#submit').click(); await page.locator('#win-cd').waitFor({state:'hidden'}); }
async function test(name, fn) { await fn(); passed++; console.log('PASS:',name); }
async function main() {
  browser = await playwright.chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  await test('cancel imports, removals and track swaps without changing collection or original files', async()=>{
    const f=await fixture(); const {page,state}=f;
    try {
      await edit(page); await add(page);
      assert.deepEqual(state.doc.cds[0].audio,disc.audio);
      await page.locator('#form-audio-track-0').selectOption('2');
      await page.locator('#form-audio').getByRole('button',{name:'Remove original.flac',exact:true}).click();
      await page.locator('#cancel-edit').click();
      await until(()=>state.files.size===1);
      assert.deepEqual(state.doc.cds[0].audio,disc.audio);
      assert(state.files.has(original.file));
      await edit(page);
      assert.equal(await page.locator('#form-audio-track-0').inputValue(),'1');
      await add(page);
      await page.keyboard.press('Escape');
      await page.locator('#win-cd').waitFor({state:'hidden'});
      await until(()=>state.files.size===1);
      assert.deepEqual(state.doc.cds[0].audio,disc.audio);
    } finally {await f.close();}
  });
  await test('save draft assignments and removals; preserve missing audio; keep copies after save', async()=>{
    const f=await fixture();const {page,state}=f;
    try {
      await edit(page); await add(page);
      await page.locator('#form-audio-track-2').selectOption('1');
      await page.locator('#form-audio').getByRole('button',{name:'Remove original.flac',exact:true}).click();
      assert(state.files.has(original.file),'original deleted before Save');
      await save(page);
      assert(!state.files.has(original.file));
      assert.deepEqual(state.doc.cds[0].audio.find(a=>a.file===missing.file),missing);
      const copy=state.doc.cds[0].audio.find(a=>a.name==='new.flac');
      assert.equal(copy.track,1);assert(state.files.has(copy.file));
      await edit(page);await page.locator('#cancel-edit').click();assert(state.files.has(copy.file));
    } finally {await f.close();}
  });
  await test('new CD uses importer prospective id and cancels without creating a CD', async()=>{
    const f=await fixture();const {page,state}=f;
    try {
      await page.locator('#open-add').click();await page.locator('#title').fill('New CD');await add(page);
      assert.equal(state.doc.cds.length,1);
      const first=state.commands.find(x=>x.cmd==='add_audio').args.cdId;
      await page.locator('#close-cd').click();await until(()=>!state.files.has(first+'/new-1.flac'));
      assert.equal(state.doc.cds.length,1);
      await page.locator('#open-add').click();await add(page);await save(page);
      const cd=state.doc.cds.find(c=>c.title==='New CD');assert(cd);
      assert(cd.audio[0].file.startsWith(cd.id+'/'));assert(state.files.has(cd.audio[0].file));
    } finally {await f.close();}
  });
  await test('invalid duration renders safely and blocks import before copying files', async()=>{
    const f=await fixture();const {page,state}=f;
    try {
      await edit(page);await page.locator('#work-list .t-len').first().fill('bad');
      await page.locator('#form-audio-add').click();
      assert.equal(state.commands.filter(x=>x.cmd==='add_audio').length,0);
      await page.locator('#submit').click();assert.equal(await page.locator('#win-cd').isVisible(),true);
      await page.locator('#work-list .t-len').first().fill('1:01');await add(page);
      await page.locator('#cancel-edit').click();await until(()=>state.files.size===1);
    } finally {await f.close();}
  });
  await test('failed save keeps draft and originals; cancel cleans copies and restores original audio', async()=>{
    const f=await fixture();const {page,state}=f;
    try {
      await edit(page);await add(page);
      await page.locator('#form-audio').getByRole('button',{name:'Remove original.flac',exact:true}).click();
      state.fail=true;await page.locator('#submit').click();
      await page.locator('#submit:not([disabled])').waitFor();
      assert.equal(await page.locator('#win-cd').isVisible(),true);
      assert(state.files.has(original.file));assert.equal(state.files.size,2);
      assert.deepEqual(state.doc.cds[0].audio,disc.audio);
      await page.locator('#cancel-edit').click();await until(()=>state.files.size===1);
      await edit(page);assert.equal(await page.locator('#form-audio li').count(),2);
      state.fail=false;await page.locator('#title').fill('After failure');await save(page);
      assert.deepEqual(state.doc.cds[0].audio,disc.audio);
    } finally {await f.close();}
  });
  await test('late import completion after discard cleans copies and cannot enter the next draft', async()=>{
    const f=await fixture();const {page,state}=f;let release;
    try {
      state.hold=new Promise(r=>release=r);await edit(page);await page.locator('#form-audio-add').click();
      await until(()=>state.files.size===2);await page.locator('#cancel-edit').click();await edit(page);
      release();await until(()=>state.files.size===1);
      assert.equal(await page.locator('#form-audio li').count(),2);assert.deepEqual(state.doc.cds[0].audio,disc.audio);
    } finally {if(release)release();await f.close();}
  });
  await test('empty profiles omit Audio; edit controls follow Disc details; type-only work remains saveable', async()=>{
    const f=await fixture([{id:'one',title:'No audio',addedAt:1,works:[{type:'Symphony'}]}]);const {page,state}=f;
    try {
      await page.locator('#grid .card').click();
      assert.equal(await page.locator('#detail-body h3').filter({hasText:/^Audio$/}).count(),0);
      assert.equal(await page.locator('#audio-add').count(),0);
      await page.locator('#detail-body').getByRole('button',{name:'Edit',exact:true}).click();
      assert.equal(await page.locator('#form-audio-set').evaluate(n=>n.previousElementSibling.id),'more-details');
      await save(page);assert.equal(state.doc.cds[0].works[0].type,'Symphony');
    } finally {await f.close();}
  });
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();console.log(passed+'/7 audio draft checks passed');});
