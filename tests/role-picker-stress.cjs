/* Role picker renderer stress. Run: node tests/role-picker-stress.cjs
   Uses installed Chrome and Edge with isolated contexts, real locator checkbox events,
   and page crash detection. CDC_HEADED=1 optionally exercises visible browser windows.
   Native persistence/audio and networking are isolated; this is not a WebView2 test. */
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
    commands: [], files: new Set([original.file]), fail: false, errors: [], crashes: [], serial: 0};
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
  page.on('crash',()=>state.crashes.push('renderer crashed')); 
  await page.goto('http://cdc-audio.test/');
  await page.locator('#grid .card').first().waitFor();
  return {page,state,close:async()=>{await context.close();assert.deepEqual(state.errors,[]);assert.deepEqual(state.crashes,[]);}};
}
async function edit(page) {
  await page.locator('#grid .card[data-id="one"]').click();
  await page.locator('#detail-body').getByRole('button',{name:'Edit',exact:true}).click();
}
async function add(page) { await page.locator('#form-audio-set').evaluate(n=>n.open=true); await page.locator('#form-audio-add').click(); await page.locator('#form-audio-add:not([disabled])').waitFor(); }
async function save(page) { await page.locator('#submit').click(); await page.locator('#win-cd').waitFor({state:'hidden'}); }
async function test(name, fn) { await fn(); passed++; console.log('PASS:',name); }

async function openPicker(row) {
  const trigger=row.locator('.perf-role-trigger');
  if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
  await row.locator('.perf-role-options').waitFor({state:'visible'});
}
const roles=row=>row.locator('.perf-role-option input:checked').evaluateAll(ns=>ns.map(n=>n.value));
async function exercise(row, page) {
  await openPicker(row);
  const conductor=row.getByRole('checkbox',{name:'Conductor',exact:true});
  const pianist=row.getByRole('checkbox',{name:'Pianist',exact:true});
  await conductor.check();
  const orchestra=row.getByRole('checkbox',{name:'Orchestra',exact:true});
  if(await orchestra.isChecked())await orchestra.uncheck();
  for(let i=0;i<30;i++) {
    await pianist.check();await conductor.uncheck();await conductor.check();await pianist.uncheck();
  }
  assert.equal(await conductor.isDisabled(),true,'last role remains selected');
  await pianist.check();assert.equal(await conductor.isDisabled(),false);
  const other=row.getByRole('checkbox',{name:'Other',exact:true});
  for(let i=0;i<8;i++) {
    await other.check();await row.locator('.perf-custom-name').fill('Custom '+i);
    await row.locator('.perf-custom-add').click();
    const custom=row.getByRole('checkbox',{name:'Custom '+i,exact:true});
    await custom.uncheck();await custom.check();await custom.uncheck();
  }
  // Wheel scrolling changes the actual popup's scroll offset, not mocked geometry.
  await row.locator('.perf-role-options').hover();await page.mouse.wheel(0,450);
  await page.waitForFunction(id=>document.getElementById(id).scrollTop>0,await row.locator('.perf-role-options').getAttribute('id'));
  await pianist.focus();await page.keyboard.press('Escape');
  assert.equal(await row.locator('.perf-role-trigger').getAttribute('aria-expanded'),'false');
  assert.equal(await row.locator('.perf-role-trigger').evaluate(n=>document.activeElement===n),true);
  assert.deepEqual(await roles(row),['Conductor','Pianist']);
}
async function run(exe) {
  browser=await playwright.chromium.launch({headless:process.env.CDC_HEADED!=='1',executablePath:exe});
  console.log('Browser:',exe,await browser.version(),process.env.CDC_HEADED==='1'?'headed':'headless');
  const f=await fixture();const {page,state}=f;
  try {
    await test('plain button/fieldset picker has no native disclosure or positioning callbacks',async()=>{
      await edit(page);assert.equal(await page.locator('.perf-roles details, .perf-roles summary').count(),0);
      assert.equal(await page.locator('.perf-role-trigger').first().getAttribute('aria-expanded'),'false');
      assert(!html.includes('.prow:has(.perf-roles'));assert(!html.includes('positionPerformerRoles'));
      assert(!html.includes('.perf-roles[open]'));
    });
    const global=page.locator('#perf-rows .prow').first();
    await test('global repeated multiselect/custom roles, wheel scroll and keyboard dismissal',async()=>{
      await global.locator('.perf-name').fill('Global stress');await exercise(global,page);
      await openPicker(global);await global.locator('.perf-name').click();
      assert.equal(await global.locator('.perf-role-trigger').getAttribute('aria-expanded'),'false');
    });
    await page.locator('#works-set > summary').click();await page.locator('.w-details > summary').first().click();
    await page.locator('.w-add-perf').first().click();const work=page.locator('.w-perf-rows .prow').first();
    await test('work repeated multiselect/custom roles, wheel scroll and ancestor collapse',async()=>{
      await work.locator('.perf-name').fill('Work stress');await exercise(work,page);
      await openPicker(work);await page.locator('.w-details > summary').first().click();
      assert.equal(await work.locator('.perf-role-trigger').getAttribute('aria-expanded'),'false');
      await page.locator('.w-details > summary').first().click();await openPicker(work);
      await page.locator('#works-set > summary').click();await page.locator('#works-set > summary').click();
      assert.equal(await work.locator('.perf-role-trigger').getAttribute('aria-expanded'),'false');
      await openPicker(work);await work.getByRole('checkbox',{name:'Pianist',exact:true}).focus();
      await page.locator('#win-cd .panel').hover({position:{x:10,y:100}});await page.mouse.wheel(0,200);
      assert.deepEqual(state.crashes,[]);assert.equal(await page.locator('#win-cd').isVisible(),true);
    });
    await test('removing an open focused picker and changing rows does not leave stale native state',async()=>{
      await page.locator('.w-add-perf').first().click();const temporary=page.locator('.w-perf-rows .prow').last();
      assert.equal(await page.locator('.w-perf-rows .prow').count(),2,'Add performer click must survive popup dismissal');
      await temporary.locator('.perf-name').fill('Temporary');await openPicker(temporary);
      await temporary.getByRole('checkbox',{name:'Pianist',exact:true}).check();
      await temporary.getByRole('checkbox',{name:'Pianist',exact:true}).focus();
      await temporary.locator('.iconbtn').click();assert.equal(await page.locator('.w-perf-rows .prow').count(),1);
      await openPicker(work);assert.equal(await page.locator('.perf-roles.is-open').count(),1);
    });
    await test('Save while a role checkbox is focused, reload and reopen preserve both pairs',async()=>{
      await work.getByRole('checkbox',{name:'Pianist',exact:true}).focus();
      await page.locator('#cd-form').evaluate(n=>n.requestSubmit());
      await page.locator('#win-cd').waitFor({state:'hidden'});
      assert.deepEqual(state.doc.cds[0].performers.map(p=>p.role),['Conductor','Pianist']);
      assert.deepEqual(state.doc.cds[0].works[0].performers.map(p=>p.role),['Conductor','Pianist']);
      await page.reload();await edit(page);await openPicker(page.locator('#perf-rows .prow').first());
      assert.deepEqual(await roles(page.locator('#perf-rows .prow').first()),['Conductor','Pianist']);
      await page.keyboard.press('Escape');await page.locator('#close-cd').click();
      assert.equal(await page.locator('#win-cd').isVisible(),false);assert.deepEqual(state.crashes,[]);assert.deepEqual(state.errors,[]);
    });
  }finally {await f.close();await browser.close();browser=null;}
}
async function main() {
  const paths=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(p=>fs.existsSync(p));
  assert(paths.length,'An installed Chrome or Edge is required; no runtime is installed by this test.');
  for(const exe of paths)await run(exe);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();console.log(passed+' role picker stress checks passed');});
