/* Mocked account services and collection; no real account, email or library access. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require(process.env.CDC_PLAYWRIGHT_MODULE || 'playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const html = fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8').replace('  /* ---------- start ---------- */',
  '  window.accountQA = { Cloud, openProfile, closeWin, setLang }; Cloud.start = function () {};\n  /* ---------- start ---------- */');
const exe = [process.env.CDC_CHROMIUM_PATH, playwright.chromium.executablePath(), 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
let browser, passed=0;
async function test(name,fn) { await fn(); passed++; console.log('PASS:',name); }
async function main() {
  browser = await playwright.chromium.launch({headless:true,executablePath:exe});
  const ctx = await browser.newContext({reducedMotion:'reduce'});
  let policy=false, saves=[], profile={handle:'old',nickname:'Original',avatar:null}, forcedCooldown=false;
  const errors=[];
  await ctx.addInitScript(()=>{
    window.CDC_DESKTOP=true;
    localStorage.setItem('cdc.lang','en');
    localStorage.setItem('cdc.session',JSON.stringify({access_token:'mock-session-only',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'test-user',email:'fixture@example.test'}}));
  });
  await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==='pmco-profile.test') {
      if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
      if(url.pathname==='/api/data')return route.fulfill({json:{cds:[],meta:{albums:[],playlists:[],settings:{lang:'en'}}}});
    }
    if(url.hostname==='ogpzmnaqybxybybooebi.supabase.co'&&url.pathname==='/rest/v1/profiles') {
      if(!policy&&url.searchParams.get('select').includes('handle_changed_at'))return route.fulfill({status:400,json:{code:'PGRST204'}});
      if(req.method()==='POST') {
        const p=req.postDataJSON()[0]; saves.push(p);
        if(forcedCooldown)return route.fulfill({status:400,json:{code:'P0001',message:'CDC_HANDLE_COOLDOWN',details:new Date(Date.now()+29*86400000).toISOString()}});
        const changed=p.handle!==profile.handle; profile={...profile,...p};
        if(changed)profile.handle_changed_at=new Date().toISOString();
      }
      return route.fulfill({json:[profile]});
    }
    return route.abort();
  });
  const page=await ctx.newPage(); page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://pmco-profile.test/');
  const open=async()=>{await page.evaluate(()=>window.accountQA.openProfile());await page.locator('#win-profile').waitFor({state:'visible'});};
  await test('legacy hosted schema explains the reminder; refreshed migrated schema enables ID editing',async()=>{
    await open(); await page.waitForFunction(()=>document.getElementById('pf-handle-policy').textContent.includes('server update'));
    assert.equal(await page.locator('#pf-handle').getAttribute('readonly'),'');
    policy=true; profile.handle_changed_at=null;
    await page.evaluate(()=>window.accountQA.closeWin('profile'));await open();
    await page.waitForFunction(()=>!document.getElementById('pf-handle').readOnly);
    assert.equal(await page.locator('#pf-handle').getAttribute('readonly'),null);
    await page.locator('#pf-nick').fill('New nickname');await page.locator('#pf-save').click();
    await page.locator('#win-profile').waitFor({state:'hidden'});
    assert.equal(saves.at(-1).handle,'old');assert.equal(saves.at(-1).nickname,'New nickname');
  });
  await test('client accepts 4–20 character IDs and allows repeated immediate changes',async()=>{
    await open(); const before=saves.length;
    await page.locator('#pf-handle').fill('abc');await page.locator('#pf-save').click();
    assert((await page.locator('#pf-handle-err').textContent()).includes('4 to 20'));
    assert.equal(saves.length,before);
    await page.locator('#pf-handle').fill('new_id7');await page.locator('#pf-save').click();
    await page.locator('#win-profile').waitFor({state:'hidden'});assert.equal(saves.at(-1).handle,'new_id7');
    await open();await page.waitForFunction(()=>!document.getElementById('pf-handle').readOnly);
    assert(await page.locator('#pf-handle-policy').isHidden());
    assert.equal(await page.locator('[data-i18n="pfNickHint"]').count(),0);
    await page.locator('#pf-handle').fill('ID_4');await page.locator('#pf-save').click();
    await page.locator('#win-profile').waitFor({state:'hidden'});assert.equal(profile.handle,'ID_4');
    await open();assert.equal(await page.locator('#pf-handle').getAttribute('readonly'),null);
    const timestamp=profile.handle_changed_at;
    await page.locator('#pf-nick').fill('Nickname updated');await page.locator('#pf-save').click();
    await page.locator('#win-profile').waitFor({state:'hidden'});assert.equal(profile.handle_changed_at,timestamp);
  });
  await test('legacy server cooldown errors use generic monthly copy without dates; brand and hints translate',async()=>{
    profile.handle_changed_at=null;await open();await page.waitForFunction(()=>!document.getElementById('pf-handle').readOnly);
    await page.locator('#pf-handle').fill('race_id7');
    forcedCooldown=true;profile.handle_changed_at=new Date().toISOString();
    await page.locator('#pf-save').click();await page.waitForFunction(()=>document.getElementById('pf-handle-err').textContent.includes('once a month'));
    assert.equal(await page.locator('#pf-handle').inputValue(),'ID_4');
    assert((await page.locator('#pf-handle-err').textContent()).includes('once a month'));
    for(const lang of ['en','ja','zh']) {
      await page.evaluate(lang=>window.accountQA.setLang(lang),lang);
      assert.match(await page.locator('[data-i18n="pfHandleHint"]').textContent(),/4/);
      assert.equal(await page.title(),'PMCO');assert.equal(await page.locator('h1').textContent(),'PMCO');
    }
    assert.equal(await page.locator('#pf-handle').getAttribute('readonly'),null);
    assert(!/GMT|again on|nickname|\d{4}/i.test(await page.locator('#pf-handle-err').textContent()));
    if(process.env.CDC_QA_ARTIFACTS){fs.mkdirSync(process.env.CDC_QA_ARTIFACTS,{recursive:true});forcedCooldown=false;await page.evaluate(()=>window.accountQA.closeWin('profile'));await open();await page.screenshot({path:path.join(process.env.CDC_QA_ARTIFACTS,'profile-no-notes.png')});}
    assert.deepEqual(errors,[]);
  });
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();console.log(passed+' account profile checks passed');});
