/* Isolated physical-media regression tests. No real accounts, drives or collection. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8').replace('  /* ---------- start ---------- */',
  '  window.mediaQA = { startEdit, setLang, openDetail, discTracks, dgMedia, dgDiscLists, discogsSource, lookupDiscData, populateLookupDrafts, playId: function(id) { playAudio(cdById(id)); }, renderPlaylist, moveCard, resetWorks, readWorks, cdFormDirty, closeWin, queue: function() { return clone(player.queue); }, currentEntry };\n  /* ---------- start ---------- */');
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
const optical = ['dvd','bluray'].map((medium,i)=>({id:'optical-'+i,title:'Optical edition',medium,
  set:{id:'optical',title:'Optical edition',disc:i+1,total:2},
  works:[{title:'Concert',duration:'1:00',tracks:[]}]}));
let browser, passed = 0, failed = 0;
async function test(name, fn) { if(process.env.CDC_TEST_FILTER&&!new RegExp(process.env.CDC_TEST_FILTER,'i').test(name))return; try { await fn(); passed++; console.log('PASS:',name); } catch(e) { failed++; console.error('FAIL:',name,e.stack); } }
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
  await test('standalone membership precedes its single medium; sets offer multiple formats after the name',async()=>{
    const f=await fixture(),{page,state}=f;
    try {
      await page.locator('#open-add').click(); await page.locator('#title').fill('Palette set');
      assert.equal(await page.locator('#set-fields').evaluate(n=>!!(n.compareDocumentPosition(document.querySelector('#medium-fields'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
      assert.equal(await page.locator('#medium').getAttribute('multiple'),null);
      await page.locator('#set-choice').selectOption('+new');
      assert.equal(await page.locator('#set-media').evaluate(n=>n.previousElementSibling.contains(document.querySelector('#set-title'))),true);
      await page.locator('#set-media input[value=vinyl]').check(); await page.locator('#form-add-disc').click();
      assert.equal(await page.locator('#medium').inputValue(),'vinyl');
      assert.deepEqual(await page.locator('#form-disc-tabs button').allTextContents(),['CD 1','Vinyl 1']);
      await page.locator('#form-disc-tabs button').first().click(); await save(page);
      assert.deepEqual(state.doc.cds.filter(c=>c.set?.title==='Palette set').map(c=>c.medium),['cd','vinyl']);
      await page.reload(); await page.evaluate(c=>mediaQA.startEdit(c),state.doc.cds.find(c=>c.set?.title==='Palette set'));
      assert.deepEqual(await page.locator('#set-media input:checked').evaluateAll(ns=>ns.map(n=>n.value)),['cd','vinyl']);
    } finally {await f.close();}
  });
  await test('matrix and catalogue stay distinct; removed condition/capacity fields survive unseen edits',async()=>{
    const original={id:'fields',title:'Fields',medium:'vinyl',catalogNo:'CAT-1',matrixRunout:'RUN-2',mediaCondition:'VG+',sleeveCondition:'NM',capacity:'16 GB',spars:'AAA'};
    const f=await fixture({extra:[original]}),{page,state}=f;
    try {
      await page.evaluate(c=>mediaQA.startEdit(c),original); await page.locator('#more-details').evaluate(n=>n.open=true);
      assert.equal(await page.locator('#mediaCondition,#sleeveCondition,#capacity').count(),0);
      assert.equal(await page.locator('#matrixRunout').inputValue(),'RUN-2');
      assert.equal(await page.locator('#barcode').evaluate(n=>n.closest('.two').contains(document.querySelector('#matrixRunout'))),true);
      assert.equal(await page.locator('#catalogNo').evaluate(n=>n.closest('.field').parentElement.classList.contains('two')),false);
      await page.locator('#catalogNo').fill('CAT-NEW'); await page.locator('#matrixRunout').fill('RUN-NEW'); await save(page);
      const saved=state.doc.cds.find(c=>c.id==='fields');
      assert.equal(saved.catalogNo,'CAT-NEW'); assert.equal(saved.matrixRunout,'RUN-NEW');
      for(const key of ['mediaCondition','sleeveCondition','capacity','spars'])assert.equal(saved[key],original[key]);
      await page.evaluate(id=>mediaQA.openDetail(id),'fields');
      assert.match(await page.locator('#detail-body').innerText(),/RUN-NEW/);
      assert.doesNotMatch(await page.locator('#detail-body').innerText(),/VG\+|NM|16 GB/);
    } finally {await f.close();}
  });
  await test('all media expose audio technology and independent matrix, with editable vinyl/cassette suggestions',async()=>{
    const f=await fixture(),{page}=f;
    try {
      await page.locator('#open-add').click(); await page.locator('#more-details').evaluate(n=>n.open=true);
      for(const m of ['cd','vinyl','cassette','sacd','dvd','bluray','other']){
        await page.locator('#medium').selectOption(m);
        assert.equal(await page.locator('#spars').isVisible(),true); assert.equal(await page.locator('#matrixRunout').isVisible(),true);
      }
      await page.locator('#medium').selectOption('vinyl');
      for(const field of ['recordSize','recordSpeed','recordColour'])assert((await page.locator('#'+field+'-options option').count())>=2);
      assert((await page.locator('#recordColour-options option').evaluateAll(ns=>ns.map(n=>n.value))).includes('Black vinyl'));
      await page.locator('#recordSpeed').fill('16⅔'); assert.equal(await page.locator('#recordSpeed').inputValue(),'16⅔');
      await page.locator('#medium').selectOption('cassette');
      for(const field of ['tapeType','noiseReduction'])assert((await page.locator('#'+field+'-options option').count())>=3);
      await page.locator('#tapeType').fill('Custom tape'); assert.equal(await page.locator('#tapeType').inputValue(),'Custom tape');
      await page.locator('#medium').selectOption('sacd'); assert.equal(await page.locator('label[for=audioPrograms]').textContent(),'Audio channels');
    } finally {await f.close();}
  });
  await test('format headings and custom Other names localize safely; works hints omit printed numbering',async()=>{
    const f=await fixture(),{page}=f;
    try {
      await page.locator('#open-add').click();
      for(const [lang,info,details] of [['en','Vinyl information','Vinyl details'],['ja','レコードの情報','レコードの詳細'],['zh','黑胶信息','黑胶详情']]){
        await page.evaluate(l=>mediaQA.setLang(l,false),lang); await page.locator('#medium').selectOption('vinyl');
        assert.equal(await page.locator('#albumOverall summary > span').first().textContent(),info);
        assert.equal(await page.locator('#more-details summary').textContent(),details);
        assert.doesNotMatch(await page.locator('#works-set summary .section-hint').textContent(),/A1|B2/);
      }
      await page.locator('#medium').selectOption('other'); assert.equal(await page.locator('#more-details summary').textContent(),'媒介详情');
      await page.locator('#mediumName').fill('USB'); assert.equal(await page.locator('#albumOverall summary > span').first().textContent(),'USB信息'); assert.equal(await page.locator('#more-details summary').textContent(),'USB详情');
      await page.locator('#mediumName').fill('<b>Reel</b>'); assert.equal(await page.locator('#more-details summary b').count(),0);
    } finally {await f.close();}
  });
  await test('composer and localized work-type filter options follow initial-letter order',async()=>{
    const f=await fixture({extra:[{id:'az1',title:'A',composer:'Zara Alpha',type:'Symphony',performers:[]},{id:'az2',title:'B',composer:'Alice Zulu',type:'PianoConcerto',performers:[]},{id:'az3',title:'C',composer:'Bob Beta',type:'Custom form',performers:[]}]}),{page}=f;
    try {
      await page.locator('#filter-btn').click();
      assert.deepEqual(await page.locator('#f-composer-options label span').allTextContents(),['Alice Zulu','Bob Beta','Zara Alpha']);
      for(const lang of ['en','ja','zh']){
        await page.evaluate(l=>mediaQA.setLang(l,false),lang);
        const values=await page.locator('#f-type-options label span').allTextContents();
        const sorted=await page.evaluate(values=>values.slice().sort((a,b)=>a.localeCompare(b,document.documentElement.lang,{sensitivity:'base',numeric:true})),values);
        assert.deepEqual(values,sorted);
      }
    } finally {await f.close();}
  });
  await test('medium shelf keyboard and drag ordering move whole mixed sets in the global relative order',async()=>{
    const extra=[{id:'v1',title:'Record 1',medium:'vinyl'},{id:'v2',title:'Record 2',medium:'vinyl'}];
    const f=await fixture({extra}),{page,state}=f;
    try {
      await view(page,'vinyl'); assert.equal(await page.locator('#grid').evaluate(n=>n.classList.contains('arranging')),true);
      await page.locator('#card-v2').press('Alt+ArrowLeft');
      assert.deepEqual(await page.locator('#grid .card').evaluateAll(ns=>ns.map(n=>n.dataset.id)),['m3','v2','v1']);
      const savedOrder=page.waitForResponse(r=>r.url().endsWith('/api/data')&&r.request().method()==='PUT'&&r.request().postDataJSON().meta.order.all.indexOf('v1')<r.request().postDataJSON().meta.order.all.indexOf('m1'));
      await page.evaluate(()=>mediaQA.moveCard('m3','v1',false)); await savedOrder;
      assert.deepEqual(state.doc.meta.order.all.filter(id=>['m1','m2','m3','v1','v2'].includes(id)),['v2','v1','m1','m2','m3']);
      await page.locator('#chip-all').click();
      const ids=await page.locator('#grid .card').evaluateAll(ns=>ns.map(n=>n.dataset.id));
      assert(ids.indexOf('v2')<ids.indexOf('v1')); assert(ids.indexOf('v1')<ids.indexOf('m1'));
      const hidden=['old','tape','sacd','usb']; assert.deepEqual(state.doc.meta.order.all.filter(id=>hidden.includes(id)),hidden);
      await view(page,'vinyl'); await page.locator('#search').fill('Record'); assert.equal(await page.locator('#grid').evaluate(n=>n.classList.contains('arranging')),false);
    } finally {await f.close();}
  });
  await test('undivided works consume numeric slots in editor and standalone/set profiles',async()=>{
    const works=[{title:'First',tracks:[{title:'I'},{title:'II'},{title:'III'}]},...['A','B','C','D'].map(title=>({title,tracks:[]})),{title:'TEST',tracks:[{title:'Should be 8'}]}];
    const standalone={id:'slots',title:'Slots',works}; const member={...standalone,id:'setslots',set:{id:'slots-set',title:'Slots set',disc:1,total:1}};
    const f=await fixture({extra:[standalone,member]}),{page}=f;
    try {
      for(const cd of [standalone,member]){
        await page.evaluate(c=>mediaQA.startEdit(c),cd);
        assert.deepEqual(await page.locator('#work-list .trow .no').allTextContents(),['1','2','3','8']);
        await page.locator('#close-cd').click(); assert.equal(await page.locator('#win-cd-unsaved').isHidden(),true);
        await page.evaluate(id=>mediaQA.openDetail(id),cd.id);
        if(cd.set)await page.locator('.set-disc summary').click();
        assert.deepEqual(await page.locator('#detail-body .ptracks .no').allTextContents(),['1','2','3','8']);
        assert.equal(await page.locator('#detail-body .pwork-heading .no').count(),0);
        await page.locator('#close-detail').click();
      }
      assert.equal((await page.evaluate(c=>mediaQA.discTracks(c),standalone)).at(-1).no,8);
    } finally {await f.close();}
  });
  await test('vinyl side switching is clean, names/works save and reload, and side-local numbering includes virtual tracks',async()=>{
    const f=await fixture(),{page,state}=f;
    try {
      await view(page,'vinyl'); await page.locator('#open-add').click(); await page.locator('#title').fill('Sides'); await page.locator('#works-set').evaluate(n=>n.open=true);
      assert.deepEqual(await page.locator('#vinyl-sides button[data-side]').allTextContents(),['Side A','Side B']);
      assert.equal(await page.locator('.t-position').first().isHidden(),true);
      await page.locator('.work:visible .w-title').fill('A whole'); await page.locator('.work:visible .trow .iconbtn').click();
      await page.locator('.work:visible .w-duration').fill('1:00');
      await page.locator('#add-work').click(); await page.locator('.work:visible').last().locator('.w-title').fill('A divided'); await page.locator('.work:visible .t-title').fill('A movement');
      assert.equal(await page.locator('.work:visible .trow .no').textContent(),'2');
      await page.locator('#vinyl-side-name').fill('Front'); await page.locator('#vinyl-sides button[data-side=b]').click(); await page.locator('#add-work').click();
      await page.locator('.work:visible .w-title').fill('B work'); await page.locator('.work:visible .t-title').fill('B movement'); assert.equal(await page.locator('.work:visible .trow .no').textContent(),'1');
      await page.locator('#vinyl-side-name').fill('Back'); await save(page);
      const saved=state.doc.cds.find(c=>c.title==='Sides'); assert.deepEqual(saved.sides.map(s=>s.name),['Front','Back']); assert.deepEqual(saved.works.map(w=>w.side),['a','a','b']);
      await page.reload(); await page.evaluate(c=>mediaQA.startEdit(c),saved); await page.locator('#vinyl-sides button[data-side=b]').click();
      assert.equal(await page.locator('.work:visible .w-title').inputValue(),'B work'); assert.equal(await page.evaluate(()=>mediaQA.cdFormDirty()),false);
      await page.locator('#close-cd').click(); assert.equal(await page.locator('#win-cd-unsaved').isHidden(),true);
      await page.evaluate(id=>mediaQA.openDetail(id),saved.id); assert.deepEqual(await page.locator('.program-side').allTextContents(),['Front','Back']); assert.deepEqual(await page.locator('.ptracks .no').allTextContents(),['2','1']);
    } finally {await f.close();}
  });
  await test('vinyl side removal is staged, preserves original audio files and remaps surviving assignments',async()=>{
    const cd={id:'sides-audio',title:'Audio sides',medium:'vinyl',sides:[{id:'a',letter:'A',name:''},{id:'b',letter:'B',name:''}],works:[{title:'A',side:'a',tracks:[]},{title:'B',side:'b',tracks:[{title:'B1'}]}],audio:[{track:1,name:'A.wav',file:'sides-audio/A.wav'},{track:2,name:'B.wav',file:'sides-audio/B.wav'}]};
    const f=await fixture({native:true,extra:[cd]}),{page,state}=f;
    try {
      await page.evaluate(c=>mediaQA.startEdit(c),cd); await page.locator('#vinyl-remove-side').click(); await page.locator('#vinyl-side-ask button').first().click();
      assert.equal(await page.locator('#vinyl-sides button[data-side]').count(),1); assert.equal(await page.locator('#vinyl-add-side').isVisible(),true);
      await save(page); const saved=state.doc.cds.find(c=>c.id===cd.id); assert.deepEqual(saved.works.map(w=>w.title),['B']); assert.deepEqual(saved.audio.map(a=>a.track),[0,1]);
      assert.equal(state.commands.some(c=>c.command==='remove_audio'),false);
      await page.evaluate(c=>mediaQA.startEdit(c),saved); await page.locator('#vinyl-add-side').click(); assert.equal(await page.locator('#vinyl-sides button[data-side]').count(),2);
      await page.locator('#close-cd').click(); await page.locator('#cd-unsaved-discard').click(); assert.equal(state.doc.cds.find(c=>c.id===cd.id).sides.length,1);
    } finally {await f.close();}
  });
  await test('legacy C/D vinyl sides display as local A/B without rewriting data or changing audio slots',async()=>{
    const cd={id:'lp2',title:'LP 2',medium:'vinyl',works:[{title:'Across C and D',composer:'Own composer',performers:[{name:'Own soloist',role:'Pianist'}],tracks:[{title:'C piece',position:'C1'},{title:'D piece',position:'D1'}]}],audio:[{track:1,name:'C.wav',file:'lp2/C.wav'},{track:2,name:'D.wav',file:'lp2/D.wav'}]};
    const f=await fixture({native:true,extra:[cd]}),{page,state}=f;
    try {
      await page.evaluate(c=>mediaQA.startEdit(c),cd); await page.locator('#vinyl-sides button[data-side=b]').click();
      assert.equal(await page.locator('.work:visible .t-title').inputValue(),'D piece');
      assert.deepEqual(await page.locator('#vinyl-sides button[data-side]').allTextContents(),['Side A','Side B']);
      assert.equal(await page.evaluate(()=>mediaQA.cdFormDirty()),false);
      await page.locator('#close-cd').click(); assert.deepEqual(state.doc.cds.find(c=>c.id===cd.id),cd);
      await page.evaluate(c=>mediaQA.startEdit(c),cd); await save(page);
      const saved=state.doc.cds.find(c=>c.id===cd.id); assert.deepEqual(saved.audio,cd.audio); assert.deepEqual(saved.works.map(w=>w.side),['a','b']);
      assert.deepEqual(saved.works.map(w=>w.composer),['Own composer','Own composer']); assert.deepEqual(saved.works.map(w=>w.performers),[cd.works[0].performers,cd.works[0].performers]);
    } finally {await f.close();}
  });
  await test('invalid hidden-side duration reveals that side and preserves its draft',async()=>{
    const cd={id:'invalid-side',title:'Invalid side',medium:'vinyl',sides:[{id:'a',letter:'A'},{id:'b',letter:'B'}],works:[{title:'A',side:'a',tracks:[]},{title:'B',side:'b',tracks:[]}]};
    const f=await fixture({extra:[cd]}),{page}=f;
    try {
      await page.evaluate(c=>mediaQA.startEdit(c),cd); await page.locator('#vinyl-sides button[data-side=b]').click(); await page.locator('.work:visible .w-duration').fill('bad'); await page.locator('#vinyl-sides button[data-side=a]').click(); await page.locator('#submit').click();
      assert.equal(await page.locator('#vinyl-sides button[data-side=b]').getAttribute('aria-pressed'),'true'); assert.equal(await page.locator('.work:visible .w-duration').inputValue(),'bad'); assert.equal(await page.locator('.work:visible .w-duration').evaluate(n=>n===document.activeElement),true);
    } finally {await f.close();}
  });
  await test('reported LP + CD pattern maps plain/CD-prefixed tracks to CD; matrix lookup never overwrites catalogue',async()=>{
    const f=await fixture(),{page,state}=f;
    try {
      // Representative regression for reported barcode 9787884182411; not a captured public response.
      await page.route('https://api.discogs.com/releases/3101',route=>route.fulfill({json:{id:3101,title:'Mixed 9787884182411',formats:[{name:'Vinyl',qty:'1'},{name:'CD',qty:'1'}],labels:[{name:'Fixture',catno:'CAT-31'}],identifiers:[{type:'Matrix / Runout',value:'RUN-31'}],tracklist:[{type_:'track',position:'A1',title:'LP front'},{type_:'track',position:'B1',title:'LP back'},{type_:'track',position:'1',title:'CD first'},{type_:'track',position:'2',title:'CD second'}]}}));
      const result=await page.evaluate(()=>mediaQA.discogsSource.details({id:3101},'RUN-31'));
      assert.equal(result.catalogNo,'CAT-31'); assert.equal(result.matrixRunout,'RUN-31');
      assert.deepEqual(result.lookupDiscs.map(d=>[d.medium,d.works.flatMap(w=>w.tracks.map(t=>t.title).length?w.tracks.map(t=>t.title):[w.title])]),[['vinyl',['LP front','LP back']],['cd',['CD first','CD second']]]);
      const groups=await page.evaluate(()=>mediaQA.dgDiscLists([{position:'A1'},{position:'B1'},{position:'CD1'},{position:'CD2'}],[{medium:'vinyl'},{medium:'cd'}])); assert.equal(groups['1'].length,2); assert.equal(groups['2'].length,2);
      await page.locator('#open-add').click(); await page.evaluate(p=>mediaQA.populateLookupDrafts(p),result); await save(page);
      const imported=state.doc.cds.filter(c=>c.set?.title===result.title); assert.deepEqual(imported.map(c=>c.medium),['vinyl','cd']); assert.equal(imported[1].works.length,2);
    } finally {await f.close();}
  });
  await test('vinyl side and medium controls fit desktop/mobile in every locale and theme',async()=>{
    const f=await fixture(),{page}=f;
    try {
      await page.evaluate(c=>mediaQA.startEdit(c),seed[3]);
      for(const lang of ['en','ja','zh'])for(const theme of ['light','dark'])for(const width of [1280,375]){
        await page.setViewportSize({width,height:900}); await page.evaluate(({lang,theme})=>{mediaQA.setLang(lang,false);document.documentElement.dataset.theme=theme;},{lang,theme});
        for(const id of ['works-set','more-details'])await page.locator('#'+id).evaluate(n=>n.open=true);
        assert.equal(await page.locator('#win-cd .panel').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,`${lang}/${theme}/${width}`);
        assert.equal(await page.locator('.work:visible .t-position').isHidden(),true);
        assert.equal(await page.locator('#matrixRunout').isVisible(),true);
        if(process.env.CDC_QA_ARTIFACTS&&lang==='zh'&&theme==='dark'){
          fs.mkdirSync(process.env.CDC_QA_ARTIFACTS,{recursive:true}); await page.locator('#vinyl-sides').scrollIntoViewIfNeeded(); await page.screenshot({path:path.join(process.env.CDC_QA_ARTIFACTS,`vinyl-editor-${width}.png`)});
          await page.locator('#barcode').scrollIntoViewIfNeeded(); await page.screenshot({path:path.join(process.env.CDC_QA_ARTIFACTS,`vinyl-details-${width}.png`)});
        }
      }
    } finally {await f.close();}
  });
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();console.log(`${passed}/${passed+failed} media-editor checks passed`);if(failed)process.exitCode=1;});
