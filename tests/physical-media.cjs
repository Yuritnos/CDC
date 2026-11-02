/* Isolated physical-media regression tests. No real accounts, drives or collection. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8').replace('  /* ---------- start ---------- */',
  '  window.mediaQA = { startEdit, setLang, openDetail, discTracks, dgMedia, dgDiscLists, discogsSource, lookupDiscData, populateLookupDrafts, playId: function(id) { playAudio(cdById(id)); }, queue: function() { return clone(player.queue); }, currentEntry };\n  /* ---------- start ---------- */');
const set = {id:'mixed', title:'Mixed anthology', total:3};
const seed = [
  {id:'old', title:'Legacy CD', extra:{keep:true}, works:[{title:'Old work', tracks:[]}]},
  {id:'m1', title:'Mixed anthology', set:{...set,disc:1}, medium:'cd', notes:'CD notes'},
  {id:'m2', title:'Mixed anthology', set:{...set,disc:2}, medium:'cd'},
  {id:'m3', title:'Mixed anthology', set:{...set,disc:3}, medium:'vinyl', recordSpeed:'33⅓', works:[{title:'Across both sides', tracks:[{title:'First',position:'A1',duration:'1:00'},{title:'Second',position:'B1',duration:'2:00'}]}]},
  {id:'tape', title:'Tape', medium:'cassette', tapeType:'Type II'},
  {id:'sacd', title:'SACD edition', medium:'sacd', sacdHybrid:'Hybrid', audioPrograms:'Stereo / 5.1'},
  {id:'usb', title:'USB edition', medium:'usb', capacity:'16 GB'}
];
let browser, passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS:',name); } catch(e) { failed++; console.error('FAIL:',name,e.stack); } }
async function fixture({native=false, extra=[]}={}) {
  const state = {doc:{cds:structuredClone(seed.concat(extra)),meta:{albums:[{id:'fav',name:'Favorites',cdIds:['m1','m2','m3']}],playlists:[],settings:{lang:'en'}}}, errors:[], commands:[], copied:new Set()};
  const context = await browser.newContext({viewport:{width:1280,height:900}, reducedMotion:'reduce'});
  if(native) await context.exposeBinding('__mediaInvoke',async(_,command,args={})=>{
    state.commands.push({command,args});
    switch(command){
      case 'load_data':return structuredClone(state.doc);
      case 'save_data':if(state.failSave)throw Error('isolated failure');state.doc=structuredClone(args.data);return null;
      case 'audio_root_dir':return 'C:\\isolated-media\\audio';
      case 'covers_root_dir':return 'C:\\isolated-media\\covers';
      case 'audio_present':return args.files.map(()=>true);
      case 'tidy_covers':return null;
      case 'add_audio_folder': {
        if(state.folderHold)await state.folderHold;
        return ['10 Finale.wav','2 Middle.wav','1 Opening.wav'].map((name,i)=>{const file=args.cdId+'/folder-'+i+'.wav';state.copied.add(file);return {file,name:'Side A/'+name,size:100};});
      }
      case 'remove_audio':args.files.forEach(file=>state.copied.delete(file));return null;
      default:throw Error('Unexpected mocked command: '+command);
    }
  });
  await context.addInitScript(native=>{
    window.CDC_DESKTOP=true;window.PMCO_TRIAL=true;localStorage.setItem('cdc.lang','en');
    if(native)window.__TAURI__={core:{invoke:(command,args)=>window.__mediaInvoke(command,args),convertFileSrc:file=>location.origin+'/fixture-audio/'+encodeURIComponent(file)}};
  },native);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'media.test') {
      if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:html});
      if(url.pathname.startsWith('/fixture-audio/')){const pcm=8000*2*30,wav=Buffer.alloc(44+pcm);wav.write('RIFF');wav.writeUInt32LE(36+pcm,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm,40);return route.fulfill({contentType:'audio/wav',body:wav});}
      if (url.pathname === '/api/data') { if(route.request().method()==='PUT') state.doc=route.request().postDataJSON(); return route.fulfill({json:state.doc}); }
    }
    return route.abort();
  });
  const page=await context.newPage(); page.setDefaultTimeout(6000); page.on('pageerror',e=>state.errors.push(e.message));
  await page.goto('http://media.test/'); await page.locator('#card-old').waitFor();
  return {page,state,close:async()=>{await context.close();assert.deepEqual(state.errors,[]);}};
}
const view = async(page,m) => { if(await page.locator('#chip-all').getAttribute('aria-expanded')==='false')await page.locator('#chip-all').press('ArrowRight');await page.locator('[id="chip-media:'+m+'"]').click(); };
async function save(page) { await page.locator('#submit').click(); await page.locator('#win-cd').waitFor({state:'hidden'}); }
async function main() {
  const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe',playwright.chromium.executablePath()].find(fs.existsSync);
  browser=await playwright.chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  await test('All media folds accessibly and the seven child views use contextual add labels',async()=>{
    const f=await fixture(),{page}=f;
    try {
      assert.equal(await page.locator('#chip-all').getAttribute('aria-expanded'),'true');
      assert.equal(await page.locator('#media-group .achip').count(),7);
      await page.locator('#chip-all .chev').click(); assert.equal(await page.locator('#media-group').isHidden(),true);
      await page.locator('#chip-all').press('ArrowRight'); assert.equal(await page.locator('#media-group').isVisible(),true);
      for(const [medium,label] of [['cd','Add a CD'],['vinyl','Add a vinyl record'],['cassette','Add a cassette'],['sacd','Add an SACD'],['dvd','Add a DVD'],['bluray','Add a Blu-ray'],['other','Add release']]){
        await view(page,medium); assert.equal(await page.locator('#fab-text').textContent(),label);
      }
      assert.equal(await page.locator('[id="chip-media:other"]').getAttribute('aria-expanded'),null);
      await page.locator('#open-add').click();
      assert.deepEqual(await page.locator('#medium option').evaluateAll(ns=>ns.map(n=>n.value)),['cd','vinyl','cassette','sacd','dvd','bluray','other']);
      await page.locator('#title').fill('Custom carrier'); await page.locator('#mediumName').fill('Reel-to-reel'); await save(page);
      assert.equal(f.state.doc.cds.find(c=>c.title==='Custom carrier').mediumName,'Reel-to-reel');
      await page.locator('#chip-all').click(); assert.equal(await page.locator('#fab-text').textContent(),'Add release');
      await page.locator('#chip-all').press('ArrowLeft'); await page.reload(); await page.locator('#chip-all').waitFor();
      assert.equal(await page.locator('#media-group').isHidden(),true);
    } finally {await f.close();}
  });
  await test('medium views count releases once and open complete mixed sets',async()=>{
    const f=await fixture(),{page}=f;
    try {
      assert.equal(await page.locator('#grid .card').count(),5);
      assert.equal(await page.locator('#chip-all .n').textContent(),'5');
      await view(page,'cd'); assert.equal(await page.locator('#grid .card').count(),2);
      assert.equal(await page.locator('#count').textContent(),'2 albums / 3 CD');
      await view(page,'vinyl'); assert.equal(await page.locator('#grid .card').count(),1);
      assert.equal(await page.locator('#count').textContent(),'1 album / 1 Vinyl');
      assert.equal(await page.locator('.medium-badge').textContent(),'2 CD · 1 Vinyl');
      assert.equal(await page.locator('#grid').evaluate(n=>n.classList.contains('arranging')),false);
      await page.locator('#grid .card').click(); assert.equal(await page.locator('.set-disc').count(),3);
      assert((await page.locator('#detail-body').innerText()).includes('2 CD · 1 Vinyl'));
    } finally { await f.close(); }
  });
  await test('direct medium views default new items and Other has no nested filter',async()=>{
    const f=await fixture(),{page,state}=f;
    try {
      await view(page,'other'); assert.equal(await page.locator('#grid .card').count(),1);
      assert.equal(await page.locator('#other-medium-filter').count(),0);
      await view(page,'sacd'); assert.equal(await page.locator('#grid .card').count(),1);
      await page.locator('#open-add').click(); assert.equal(await page.locator('#medium').inputValue(),'sacd');
      await page.locator('#title').fill('New SACD'); await save(page);
      assert.equal(state.doc.cds.find(c=>c.title==='New SACD').medium,'sacd');
      await view(page,'vinyl'); await page.locator('#open-add').click(); assert.equal(await page.locator('#medium').inputValue(),'vinyl');
    } finally { await f.close(); }
  });
  await test('mixed-set creation, independent details, printed positions and audio sequence survive reload',async()=>{
    const f=await fixture(),{page,state}=f;
    try {
      await view(page,'cd'); await page.locator('#open-add').click(); await page.locator('#title').fill('New mixed set');
      await page.locator('#set-choice').selectOption('+new'); await page.locator('#form-add-disc').click();
      assert.equal(await page.locator('#medium').inputValue(),'cd');
      await page.locator('#medium').selectOption('vinyl');
      assert.deepEqual(await page.locator('#form-disc-tabs button').allTextContents(),['CD 1','Vinyl 1']);
      await page.locator('#more-details').evaluate(n=>n.open=true); await page.locator('#recordSpeed').fill('45');
      assert.equal(await page.locator('#hub').isVisible(),false); assert.equal(await page.locator('#tapeType').isVisible(),false);
      await page.locator('#works-set').evaluate(n=>n.open=true); await page.locator('.w-title').fill('A work spanning sides');
      await page.locator('.t-title').fill('First part'); await page.locator('.t-position').fill('A1');
      await page.locator('.work > [data-i18n=addTrack]').click();
      await page.locator('.t-title').nth(1).fill('Second part'); await page.locator('.t-position').nth(1).fill('B1');
      await page.locator('#form-disc-tabs button').first().click(); assert.equal(await page.locator('#medium').inputValue(),'cd');
      await save(page);
      const items=state.doc.cds.filter(c=>c.set?.title==='New mixed set'); assert.equal(items.length,2);
      const vinyl=items.find(c=>c.medium==='vinyl'); assert.equal(vinyl.recordSpeed,'45');
      assert.deepEqual(vinyl.works[0].tracks.map(t=>t.position),['A1','B1']);
      assert.deepEqual(await page.evaluate(c=>window.mediaQA.discTracks(c).map(t=>[t.no,t.position]),vinyl),[[1,'A1'],[2,'B1']]);
      await page.reload(); await view(page,'vinyl');
      await page.evaluate(id=>window.mediaQA.openDetail(id),vinyl.id);
      const fold=page.locator('.set-disc').last(); await fold.locator('summary').click();
      assert.deepEqual(await fold.locator('.ptracks .no').allTextContents(),['A1','B1']);
    } finally { await f.close(); }
  });
  await test('editing legacy CDs preserves unknown data and editing a mixed set updates one shared release',async()=>{
    const f=await fixture(),{page,state}=f;
    try {
      await page.evaluate(c=>window.mediaQA.startEdit(c),seed[0]);
      assert.equal(await page.locator('#medium').inputValue(),'cd'); await page.locator('#title').fill('Legacy edited'); await save(page);
      assert.deepEqual(state.doc.cds.find(c=>c.id==='old').extra,{keep:true});
      await page.evaluate(c=>window.mediaQA.startEdit(c),seed[3]); await page.locator('#set-title').fill('Renamed anthology');
      await page.locator('#more-details').evaluate(n=>n.open=true); await page.locator('#recordSpeed').fill('45'); await save(page);
      assert(state.doc.cds.filter(c=>c.set?.id==='mixed').every(c=>c.set.title==='Renamed anthology'));
      assert.equal(state.doc.cds.find(c=>c.id==='m3').recordSpeed,'45'); assert.equal(state.doc.cds.find(c=>c.id==='m1').notes,'CD notes');
      assert.deepEqual(state.doc.meta.albums[0].cdIds,['m1','m2','m3']);
      await view(page,'cd'); assert((await page.locator('#grid').innerText()).includes('Renamed anthology'));
      await view(page,'vinyl'); assert((await page.locator('#grid').innerText()).includes('Renamed anthology'));
    } finally { await f.close(); }
  });
  await test('medium-only and printed-position edits trigger unsaved-form protection',async()=>{
    const f=await fixture(),{page}=f;
    try {
      await page.evaluate(c=>window.mediaQA.startEdit(c),seed[0]); await page.locator('#medium').selectOption('cassette'); await page.locator('#close-cd').click();
      await page.locator('#win-cd-unsaved').waitFor();
      assert.equal(await page.locator('#win-cd').isVisible(),true);
      await page.locator('#cd-unsaved-discard').click();
      await page.evaluate(c=>window.mediaQA.startEdit(c),seed[3]);
      await page.locator('.t-position').first().fill('A2'); await page.locator('#close-cd').click();
      await page.locator('#win-cd-unsaved').waitFor();
    } finally { await f.close(); }
  });
  await test('Discogs maps mixed formats, vinyl sides and scoped programs into physical components',async()=>{
    const f=await fixture(),{page}=f;
    try {
      const result=await page.evaluate(()=>{
        const media=mediaQA.dgMedia([{name:'Box Set',qty:'1'},{name:'CD',qty:'2'},{name:'Vinyl',qty:'2'},{name:'Blu-ray',qty:'1'}]);
        return {media,groups:mediaQA.dgDiscLists([{position:'1-1'},{position:'A1'},{position:'B2'},{position:'C1'},{position:'BD1-1'}],media)};
      });
      assert.deepEqual(result.media.map(m=>m.medium),['cd','cd','vinyl','vinyl','bluray']);
      assert.deepEqual(result.groups['3'].map(t=>t.position),['A1','B2']); assert.equal(result.groups['4'][0].position,'C1'); assert.equal(result.groups['5'][0].position,'BD1-1');
      assert.equal(await page.evaluate(()=>mediaQA.dgMedia([{name:'Memory Stick',text:'16 GB SD card'}])[0].medium),'sd');
      await page.route('https://api.discogs.com/releases/900',route=>route.fulfill({json:{id:900,title:'Imported mixed release',formats:[{name:'CD',qty:'2'},{name:'Vinyl',qty:'1'},{name:'Blu-ray',qty:'1'}],tracklist:[
        {type_:'track',position:'1-1',title:'Disc one',duration:'1:00'},
        {type_:'track',position:'2-1',title:'Disc two',duration:'2:00'},
        {type_:'track',position:'A1',title:'Record side A',duration:'3:00'},
        {type_:'track',position:'B1',title:'Record side B',duration:'4:00'},
        {type_:'track',position:'BD1-1',title:'Concert',duration:'5:00'}
      ]}}));
      await page.locator('#open-add').click();
      await page.evaluate(async()=>{const release=await mediaQA.discogsSource.details({id:900},'');mediaQA.populateLookupDrafts(release);});
      assert.deepEqual(await page.locator('#form-disc-tabs button').allTextContents(),['CD 1','CD 2','Vinyl 1','Blu-ray 1']);
      await save(page);
      const imported=f.state.doc.cds.filter(c=>c.set?.title==='Imported mixed release').sort((a,b)=>a.set.disc-b.set.disc);
      assert.deepEqual(imported.map(c=>c.medium),['cd','cd','vinyl','bluray']);
      assert.deepEqual(imported[2].works.flatMap(w=>w.tracks.map(t=>t.position)),['A1','B1']);
    } finally { await f.close(); }
  });
  await test('lookup searches use the chosen medium and Other searches remain unrestricted',async()=>{
    const f=await fixture(),{page}=f;
    try {
      const searches=[];
      await page.route('https://api.discogs.com/database/search?*',route=>{ searches.push(new URL(route.request().url()).searchParams.get('format'));return route.fulfill({json:{results:[]}}); });
      await page.locator('#open-add').click();
      for (const medium of ['vinyl','cassette','sacd','other']) {
        await page.locator('#medium').selectOption(medium);
        await page.evaluate(()=>mediaQA.discogsSource.search('1234567890123'));
      }
      assert.deepEqual(searches,['Vinyl','Cassette','SACD',null]);
    } finally { await f.close(); }
  });
  await test('cassette, SACD, USB and unknown format details survive explicit edits',async()=>{
    const unknown={...seed[0],id:'future',title:'Future format',medium:'reel-to-reel'};
    const f=await fixture({extra:[unknown]}),{page,state}=f;
    try {
      for (const [id,field,value] of [['tape','tapeType','Type IV'],['sacd','audioPrograms','Stereo'],['usb','capacity','32 GB']]) {
        await page.evaluate(c=>mediaQA.startEdit(c),state.doc.cds.find(c=>c.id===id));
        await page.locator('#more-details').evaluate(n=>n.open=true); await page.locator('#'+field).fill(value); await save(page);
        assert.equal(state.doc.cds.find(c=>c.id===id)[field],value);
      }
      await page.evaluate(c=>mediaQA.startEdit(c),unknown);
      assert.equal(await page.locator('#medium').inputValue(),'other'); assert.equal(await page.locator('#mediumName').inputValue(),'reel-to-reel'); await save(page);
      assert.equal(state.doc.cds.find(c=>c.id==='future').medium,'reel-to-reel');
      assert.deepEqual(state.doc.cds.find(c=>c.id==='future').extra,{keep:true});
      assert.equal(state.doc.cds.find(c=>c.id==='usb').medium,'usb');
      await view(page,'other');
      assert.deepEqual((await page.locator('#grid .card h3').allTextContents()).sort(),['Future format','USB edition']);
    } finally { await f.close(); }
  });
  await test('responsive localized forms show only relevant fields and retain values on language changes',async()=>{
    const f=await fixture(),{page}=f;
    try {
      await page.evaluate(c=>window.mediaQA.startEdit(c),seed[3]); await page.locator('#more-details').evaluate(n=>n.open=true);
      for (const lang of ['en','ja','zh']) for (const width of [1280,375]) {
        await page.setViewportSize({width,height:900}); await page.evaluate(lang=>window.mediaQA.setLang(lang,false),lang);
        assert.equal(await page.locator('#medium').inputValue(),'vinyl'); assert.equal(await page.locator('#recordSpeed').inputValue(),'33⅓');
        assert.equal(await page.locator('#recordSpeed').isVisible(),true); assert.equal(await page.locator('#hub').isVisible(),false);
        assert.equal(await page.locator('.panel').first().evaluate(n=>n.scrollWidth>n.clientWidth+1),false);
      }
      if(process.env.CDC_QA_ARTIFACTS){fs.mkdirSync(process.env.CDC_QA_ARTIFACTS,{recursive:true});await page.screenshot({path:path.join(process.env.CDC_QA_ARTIFACTS,'media-editor-mobile.png')});}
    } finally { await f.close(); }
  });
  await test('All music filters individual media without touching queue, playback, playlists or collection',async()=>{
    const f=await fixture({native:true}),{page,state}=f;
    try {
      // Seed local audio using the isolated native storage mock, then reload the app.
      state.doc.cds.forEach(c=>c.audio=[{file:c.id+'/original.wav',name:'original.wav',track:1}]);
      await page.reload(); await page.locator('#chip-music').click(); await page.locator('#grid .card').first().waitFor();
      await page.evaluate(()=>mediaQA.playId('old'));
      const queue=await page.evaluate(()=>mediaQA.queue()), current=await page.evaluate(()=>mediaQA.currentEntry());
      const doc=structuredClone(state.doc);
      assert.equal(await page.locator('#music-medium-control').isVisible(),true);
      assert.equal(await page.locator('#albums #music-medium-filter').count(),0);
      if(process.env.CDC_QA_ARTIFACTS){fs.mkdirSync(process.env.CDC_QA_ARTIFACTS,{recursive:true});await page.screenshot({path:path.join(process.env.CDC_QA_ARTIFACTS,'music-medium-desktop.png')});}
      for(const [medium,count] of [['vinyl',1],['cd',2],['sacd',1],['other',1],['dvd',0],['',5]]){
        await page.locator('#music-medium-filter').selectOption(medium);
        assert.equal(await page.locator('#grid .card').count(),count);
        assert.deepEqual(await page.evaluate(()=>mediaQA.queue()),queue);
        assert.deepEqual(await page.evaluate(()=>mediaQA.currentEntry()),current);
      }
      assert.deepEqual(state.doc,doc);
      for(const lang of ['en','ja','zh']){
        await page.evaluate(lang=>mediaQA.setLang(lang,false),lang); await page.setViewportSize({width:375,height:900});
        assert.equal(await page.locator('#music-medium-filter').evaluate(n=>n.getBoundingClientRect().right<=innerWidth),true);
      }
      if(process.env.CDC_QA_ARTIFACTS)await page.screenshot({path:path.join(process.env.CDC_QA_ARTIFACTS,'music-medium-mobile.png')});
      await view(page,'cd'); assert.equal(await page.locator('#music-medium-control').isHidden(),true);
    } finally {await f.close();}
  });
  await test('folder imports sort naturally into a non-CD draft and discard removes only the new copies',async()=>{
    const f=await fixture({native:true}),{page,state}=f;
    try {
      await page.evaluate(c=>mediaQA.startEdit(c),seed[3]); await page.locator('#form-audio-set').evaluate(n=>n.open=true);
      await page.locator('#form-audio-folder').click(); await page.locator('#form-audio-folder:not(:disabled)').waitFor();
      assert(state.commands.some(c=>c.command==='add_audio_folder'&&c.args.cdId==='m3'));
      assert.equal(state.copied.size,3);
      assert.deepEqual(await page.locator('#form-audio .pa-file').allTextContents(),['Side A/1 Opening.wav','Side A/2 Middle.wav','Side A/10 Finale.wav']);
      assert.deepEqual(await page.locator('#form-audio select').evaluateAll(ns=>ns.map(n=>n.value)),['1','2','0']);
      await page.locator('#close-cd').click(); await page.locator('#cd-unsaved-discard').click();
      await page.waitForFunction(()=>document.getElementById('win-cd').hidden);
      assert.equal(state.copied.size,0); assert.equal(state.doc.cds.find(c=>c.id==='m3').audio,undefined);
      await page.evaluate(c=>mediaQA.startEdit(c),seed[3]); await page.locator('#form-audio-set').evaluate(n=>n.open=true);
      await page.locator('#form-audio-folder').click(); await page.locator('#form-audio-folder:not(:disabled)').waitFor();
      state.failSave=true; await page.locator('#submit').click(); await page.locator('#submit:not(:disabled)').waitFor();
      assert.equal(state.copied.size,3); assert.equal(state.doc.cds.find(c=>c.id==='m3').audio,undefined);
      state.failSave=false; await save(page); assert.equal(state.doc.cds.find(c=>c.id==='m3').audio.length,3); assert.equal(state.copied.size,3);
    } finally {await f.close();}
  });
  await browser.close(); console.log(`${passed}/${passed+failed} physical-media checks passed`); if(failed)process.exitCode=1;
}
main().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
