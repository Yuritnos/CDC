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
    if(url.hostname==='cdshelf-profile.test') {
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
  await page.goto('http://cdshelf-profile.test/');
  const open=async()=>{await page.evaluate(()=>window.accountQA.openProfile());await page.locator('#win-profile').waitFor({state:'visible'});};
  await test('legacy hosted schema explains the reminder; refreshed migrated schema enables ID editing',async()=>{
    await open(); await page.waitForFunction(()=>document.getElementById('pf-handle-policy').textContent.includes('server update'));
    assert.equal(await page.locator('#pf-handle').getAttribute('readonly'),'');
    policy=true; profile.handle_changed_at=null;
    await page.evaluate(()=>window.accountQA.closeWin('profile'));await open();
    await page.waitForFunction(()=>document.getElementById('pf-handle-policy').textContent.includes('30 days'));
    assert.equal(await page.locator('#pf-handle').getAttribute('readonly'),null);
    await page.locator('#pf-nick').fill('New nickname');await page.locator('#pf-save').click();
    await page.locator('#win-profile').waitFor({state:'hidden'});
    assert.equal(saves.at(-1).handle,'old');assert.equal(saves.at(-1).nickname,'New nickname');
  });
  await test('client rejects short/invalid new IDs and saves a valid ID before displaying cooldown',async()=>{
    await open(); const before=saves.length;
    await page.locator('#pf-handle').fill('short');await page.locator('#pf-save').click();
    assert((await page.locator('#pf-handle-err').textContent()).includes('7 to 20'));
    assert.equal(saves.length,before);
    await page.locator('#pf-handle').fill('new_id7');await page.locator('#pf-save').click();
    await page.locator('#win-profile').waitFor({state:'hidden'});assert.equal(saves.at(-1).handle,'new_id7');
    await open();await page.waitForFunction(()=>document.getElementById('pf-handle-policy').textContent.includes('again on'));
    assert.equal(await page.locator('#pf-handle').getAttribute('readonly'),'');
    const timestamp=profile.handle_changed_at;
    await page.locator('#pf-nick').fill('Nickname in cooldown');await page.locator('#pf-save').click();
    await page.locator('#win-profile').waitFor({state:'hidden'});assert.equal(profile.handle_changed_at,timestamp);
  });
  await test('server cooldown errors refresh the lock; localized hints and brand are complete',async()=>{
    profile.handle_changed_at=null;await open();await page.waitForFunction(()=>!document.getElementById('pf-handle').readOnly);
    await page.locator('#pf-handle').fill('race_id7');
    forcedCooldown=true;profile.handle_changed_at=new Date().toISOString();
    await page.locator('#pf-save').click();await page.waitForFunction(()=>document.getElementById('pf-handle').readOnly);
    assert.equal(await page.locator('#pf-handle').inputValue(),'new_id7');
    assert((await page.locator('#pf-handle-err').textContent()).includes('again on'));
    for(const lang of ['en','ja','zh']) {
      await page.evaluate(lang=>window.accountQA.setLang(lang),lang);
      assert.match(await page.locator('[data-i18n="pfHandleHint"]').textContent(),/7/);
      assert.equal(await page.title(),'CDshelf');assert.equal(await page.locator('h1').textContent(),'CDshelf');
    }
    assert.deepEqual(errors,[]);
  });
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();console.log(passed+' account profile checks passed');});
