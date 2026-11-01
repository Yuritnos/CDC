/* Isolated browser/native-device fixtures. Never enumerates a real drive or touches a real account/library. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const source=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const html=source.replace('  /* ---------- start ---------- */','  window.driveQA={driveCandidates,CdDrive,closeWin,clearForm,openAdd};\n  /* ---------- start ---------- */');
const executablePath=[process.env.CDC_CHROMIUM_PATH,playwright.chromium.executablePath(),'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
const disc={driveId:'D:',fingerprint:'a'.repeat(40),discId:'test-disc',toc:'1 2 18150 150 9150',tracks:[{number:1,startSector:0,sectors:9000,duration:'2:00'},{number:2,startSector:9000,sectors:9000,duration:'2:00'}]};
const release={id:'release-fixture',title:'Sonata drive QA',date:'1983-01-01',country:'DE','artist-credit':[{name:'Artist fixture'}],media:[{position:1,format:'CD',discs:[{id:disc.discId}],tracks:[{position:1,title:'Sonata: I. Allegro',recording:{}},{position:2,title:'Sonata: II. Andante',recording:{}}]}]};
let browser,passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS:',name);}catch(e){failed++;console.error('FAIL:',name,e.stack);}}
async function fixture(options={}){
  const state={doc:{cds:[],meta:{albums:[],playlists:[],settings:{lang:'en'}}},drives:['D:'],metadata:{releases:[structuredClone(release)]},removed:[],calls:[],errors:[],complete:true,cancelled:false,offline:false,...options};
  const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1280,height:900}});
  await context.exposeBinding('__driveNative',async(_,command,args={})=>{
    state.calls.push({command,args});
    switch(command){
      case 'load_data':return structuredClone(state.doc);
      case 'save_data':if(state.saveFail)throw Error('Isolated save failure');state.doc=structuredClone(args.data);return null;
      case 'covers_root_dir':return 'C:\\isolated-drive-qa\\covers';
      case 'audio_root_dir':return 'C:\\isolated-drive-qa\\audio';
      case 'audio_present':return args.files.map(()=>true);
      case 'tidy_covers':return 0;
      case 'list_cd_drives':return state.drives;
      case 'read_cd_disc':if(state.readHold)await state.readHold;if(state.readError)throw state.readError;return structuredClone(disc);
      case 'lookup_cd_metadata':if(state.offline)throw 'drive_metadata';return structuredClone(state.metadata);
      case 'start_cd_import':state.cancelled=false;if(state.startHold)await state.startHold;return 'rip-fixture';
      case 'cd_import_status':return {state:state.cancelled?'cancelled':state.jobError?'error':state.complete?'done':'copying',code:state.cancelled?'drive_cancelled':state.jobError||'',track:1,tracks:2,progress:state.complete?100:25};
      case 'cancel_cd_import':state.cancelled=true;return null;
      case 'adopt_cd_import':if(state.adoptHold)await state.adoptHold;return [1,2].map(n=>({file:args.cdId+'/rip-fixture-track-0'+n+'.'+(state.calls.findLast(c=>c.command==='start_cd_import').args.format),name:'Track 0'+n,track:n,size:10000}));
      case 'remove_audio':state.removed.push(...args.files);return null;
      default:throw Error('Unexpected isolated native command: '+command);
    }
  });
  await context.addInitScript(native=>{window.CDC_DESKTOP=true;localStorage.setItem('cdc.lang','en');if(native)window.__TAURI__={core:{invoke:(c,a)=>window.__driveNative(c,a),convertFileSrc:p=>'http://drive.test/audio/'+encodeURIComponent(p)}};},options.native!==false);
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='drive.test'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});if(url.hostname==='drive.test'&&url.pathname==='/api/data'){if(route.request().method()==='PUT')state.doc=route.request().postDataJSON();return route.fulfill({json:state.doc});}return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>state.errors.push(e.message));await page.goto('http://drive.test/');await page.locator('#open-add').click();
  return {page,state,close:async()=>{await context.close();assert.deepEqual(state.errors,[]);}};
}
async function scan(page){await page.locator('#drive-open').click();await page.waitForFunction(()=>!document.getElementById('drive-read').disabled);await page.locator('#drive-read').click();await page.locator('#drive-preview').waitFor({state:'visible'});}
async function copy(page){await page.locator('#drive-copy').click();await page.waitForFunction(()=>document.getElementById('drive-status').textContent.includes('Audio copied'));}
async function main(){
  browser=await playwright.chromium.launch({headless:true,executablePath});
  await test('browser preview hides native-only controls and no-drive state gives refresh guidance',async()=>{
    let f=await fixture({native:false});try{assert.equal(await f.page.locator('#drive-section').isVisible(),false);}finally{await f.close();}
    f=await fixture({drives:[]});try{await f.page.locator('#drive-open').click();await f.page.waitForFunction(()=>document.getElementById('drive-status').textContent.includes('No CD drive'));assert(await f.page.locator('#drive-read').isDisabled());}finally{await f.close();}
  });
  await test('disc layout filters wrong media and shows physical durations before any copy',async()=>{
    const f=await fixture();try{await scan(f.page);assert.equal(await f.page.locator('#drive-tracks li').count(),2);assert.deepEqual(await f.page.locator('#drive-tracks .len').allTextContents(),['2:00','2:00']);assert(!f.state.calls.some(c=>c.command==='start_cd_import'));const candidates=await f.page.evaluate(({disc,release})=>window.driveQA.driveCandidates({releases:[release,{...release,media:[{...release.media[0],discs:[{id:'other'}]}]}]},disc),{disc,release});assert.equal(candidates.length,1);assert.equal(candidates[0].value.works[0].tracks.length,2);}finally{await f.close();}
  });
  await test('FLAC import maps two physical tracks into the draft then saves and reloads without cleanup',async()=>{
    const f=await fixture();try{await scan(f.page);await copy(f.page);assert.equal(f.state.calls.find(c=>c.command==='start_cd_import').args.format,'flac');assert.equal(await f.page.locator('#form-audio .paudio > li').count(),2);assert.equal(f.state.doc.cds.length,0);await f.page.locator('#submit').click();await f.page.locator('#win-cd').waitFor({state:'hidden'});assert.equal(f.state.doc.cds.length,1);const cd=f.state.doc.cds[0];assert.equal(cd.title,release.title);assert.deepEqual(cd.audio.map(a=>a.track),[1,2]);assert(cd.audio.every(a=>a.file.endsWith('.flac')));assert.equal(cd.works[0].tracks.length,2);assert.deepEqual(f.state.removed,[]);await f.page.reload();assert.equal(f.state.doc.cds[0].audio.length,2);}finally{await f.close();}
  });
  await test('offline WAV import keeps measured times and discard removes only new copies',async()=>{
    const f=await fixture({offline:true,doc:{cds:[{id:'saved',title:'Saved original',audio:[{file:'saved/original.flac',track:1}]}],meta:{albums:[],playlists:[],settings:{lang:'en'}}}});try{await scan(f.page);assert((await f.page.locator('#drive-status').textContent()).includes('unavailable'));await f.page.locator('#drive-format').selectOption('wav');await copy(f.page);assert.deepEqual(await f.page.locator('#work-list .w-duration').evaluateAll(ns=>ns.map(n=>n.value)),['2:00','2:00']);await f.page.locator('#close-cd').click();await f.page.locator('#cd-unsaved-discard').click();await f.page.locator('#win-cd').waitFor({state:'hidden'});assert.equal(f.state.removed.length,2);assert(f.state.removed.every(file=>file.endsWith('.wav')&&file!=='saved/original.flac'));assert.equal(f.state.doc.cds[0].audio[0].file,'saved/original.flac');}finally{await f.close();}
  });
  await test('ejected or changed disc reports failure without adopting audio, and retry can succeed',async()=>{
    const f=await fixture({jobError:'drive_changed'});try{await scan(f.page);await f.page.locator('#drive-copy').click();await f.page.waitForFunction(()=>document.getElementById('drive-status').textContent.includes('ejected'));assert(!f.state.calls.some(c=>c.command==='adopt_cd_import'));assert.equal(f.state.doc.cds.length,0);f.state.jobError='';await copy(f.page);assert.equal(await f.page.locator('#form-audio .paudio > li').count(),2);}finally{await f.close();}
  });
  await test('close during pending start cancels the eventual job and retains the changed-form choice',async()=>{
    let releaseStart;const f=await fixture({startHold:new Promise(r=>releaseStart=r),complete:false});try{await scan(f.page);await f.page.locator('#drive-copy').click();await f.page.waitForFunction(()=>window.driveQA.CdDrive.busy);await f.page.locator('#close-cd').click();assert(await f.page.locator('#win-cd').isVisible());releaseStart();await f.page.locator('#win-cd-unsaved').waitFor({state:'visible'});assert(f.state.calls.some(c=>c.command==='cancel_cd_import'));assert(!f.state.calls.some(c=>c.command==='adopt_cd_import'));assert.equal(f.state.doc.cds.length,0);}finally{releaseStart();await f.close();}
  });
  await test('cancel racing adoption cleans returned files instead of attaching them to the draft',async()=>{
    let releaseAdopt;const f=await fixture({adoptHold:new Promise(r=>releaseAdopt=r)});try{await scan(f.page);await f.page.locator('#drive-copy').click();await f.page.waitForFunction(()=>document.getElementById('drive-cancel').hidden===false);for(let i=0;i<100&&!f.state.calls.some(c=>c.command==='adopt_cd_import');i++)await new Promise(r=>setTimeout(r,10));assert(f.state.calls.some(c=>c.command==='adopt_cd_import'));await f.page.locator('#drive-cancel').click();releaseAdopt();await f.page.waitForFunction(()=>document.getElementById('drive-status').textContent.includes('cancelled'));assert.equal(f.state.removed.length,2);assert.equal(await f.page.locator('#form-audio .paudio > li').count(),0);}finally{releaseAdopt();await f.close();}
  });
  await test('late disc read cannot populate a different editor session',async()=>{
    let finish;const f=await fixture({readHold:new Promise(r=>finish=r)});try{await f.page.locator('#drive-open').click();await f.page.waitForFunction(()=>!document.getElementById('drive-read').disabled);await f.page.locator('#drive-read').click();await f.page.locator('#close-cd').click();await f.page.locator('#win-cd').waitFor({state:'hidden'});await f.page.locator('#open-add').click();finish();await new Promise(r=>setTimeout(r,100));assert(await f.page.locator('#drive-preview').isHidden());assert.equal(await f.page.locator('#title').inputValue(),'');}finally{finish();await f.close();}
  });
  await test('failed collection save retains copied draft audio for a successful retry',async()=>{
    const f=await fixture({saveFail:true});try{await scan(f.page);await copy(f.page);await f.page.locator('#submit').click();await f.page.waitForFunction(()=>!document.getElementById('submit').disabled);assert(await f.page.locator('#win-cd').isVisible());assert.equal(await f.page.locator('#form-audio .paudio > li').count(),2);assert.deepEqual(f.state.removed,[]);f.state.saveFail=false;await f.page.locator('#submit').click();await f.page.locator('#win-cd').waitFor({state:'hidden'});assert.equal(f.state.doc.cds[0].audio.length,2);}finally{await f.close();}
  });
  await test('preview controls fit all locales, themes and narrow widths with no automatic imports',async()=>{
    const f=await fixture();try{await scan(f.page);for(const lang of ['en','ja','zh']){await f.page.locator('#lang-set').evaluate((n,l)=>{n.value=l;n.dispatchEvent(new Event('change',{bubbles:true}));},lang);for(const width of [1280,420,360]){await f.page.setViewportSize({width,height:900});for(const theme of ['light','dark']){await f.page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);assert(await f.page.locator('#win-cd .panel').evaluate(n=>n.scrollWidth<=n.clientWidth+1),`${lang}/${theme}/${width}`);}}}assert(!f.state.calls.some(c=>c.command==='start_cd_import'));if(process.env.CDC_QA_ARTIFACTS){fs.mkdirSync(process.env.CDC_QA_ARTIFACTS,{recursive:true});await f.page.screenshot({path:path.join(process.env.CDC_QA_ARTIFACTS,'drive-preview-mobile-zh.png')});}}finally{await f.close();}
  });
}
main().catch(e=>{failed++;console.error(e);}).finally(async()=>{if(browser)await browser.close();console.log(`${passed}/${passed+failed} drive-import checks passed`);if(failed)process.exitCode=1;});
