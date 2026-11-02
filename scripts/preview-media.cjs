/* Local trial using only a disposable sample collection under installers/media-trial.
   Run: node scripts/preview-media.cjs (or npm run preview:media). */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const trialDir = path.join(root, 'installers', 'media-trial');
const trialFile = path.join(trialDir, 'collection.json');
function cover(title, subtitle, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><rect width="480" height="480" fill="${color}"/><circle cx="355" cy="122" r="158" fill="none" stroke="#ffffff" stroke-opacity=".16" stroke-width="54"/><path d="M-40 335Q160 120 520 285" fill="none" stroke="#ffffff" stroke-opacity=".25" stroke-width="2"/><text x="36" y="45" fill="#ffffff" font-family="sans-serif" font-size="12" letter-spacing="4">PMCO · SAMPLE COLLECTION</text><text x="36" y="343" fill="#ffffff" font-family="Georgia,serif" font-size="39">${title}</text><text x="38" y="386" fill="#ffffff" font-family="sans-serif" font-size="16" letter-spacing="2">${subtitle}</text><path d="M38 418H442" stroke="#ffffff" stroke-opacity=".6"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function makeTrialDoc() {
  const setCover={photo:cover('Studio Anthology','2 CD + 1 VINYL','#263f50')};
  const members=['cd','cd','vinyl'].map((medium,i)=>({id:'trial-mixed-'+(i+1),title:'Studio Anthology',medium,addedAt:10-i,
    set:{id:'trial-anthology',title:'Studio Anthology',disc:i+1,total:3,cover:setCover,shared:{label:'PMCO Sample Editions'}},
    label:'PMCO Sample Editions',releaseYear:'2026',performers:[{role:'Orchestra',name:'PMCO Ensemble'}],
    ...(medium==='vinyl'?{recordSize:'12 inch',recordSpeed:'33⅓',recordColour:'Black'}:{}),
    works:[{title:i===0?'Morning Studies':i===1?'Evening Studies':'Sessions on Two Sides',tracks:[
      {title:'I. Opening',duration:'4:32',...(medium==='vinyl'?{position:'A1'}:{})},
      {title:'II. Returning',duration:'6:18',...(medium==='vinyl'?{position:'B1'}:{})}
    ]}]}));
  return {cds:[...members,
    {id:'trial-cd',title:'Piano Sketches',photo:cover('Piano Sketches','COMPACT DISC','#5a687f'),addedAt:6,performers:[{role:'Pianist',name:'Sample Pianist'}],works:[{title:'Three sketches',duration:'12:40',tracks:[]}]},
    {id:'trial-vinyl',title:'Blue Hour',medium:'vinyl',photo:cover('Blue Hour','VINYL · 45 RPM','#466d70'),recordSize:'12 inch',recordSpeed:'45',addedAt:5,works:[{title:'Blue Hour',tracks:[{title:'First Light',position:'A1',duration:'5:20'},{title:'Nightfall',position:'B1',duration:'7:12'}]}]},
    {id:'trial-tape',title:'Summer Tape',medium:'cassette',photo:cover('Summer Tape','CASSETTE · SIDE A / B','#95684f'),tapeType:'Type II',noiseReduction:'Dolby B',addedAt:4,works:[{title:'Summer Tape',tracks:[{title:'Side A',position:'A1',duration:'18:00'},{title:'Side B',position:'B1',duration:'19:00'}]}]},
    {id:'trial-sacd',title:'Surround Sessions',medium:'sacd',photo:cover('Surround Sessions','HYBRID SACD','#645b78'),sacdHybrid:'Hybrid: CD + SACD',audioPrograms:'Stereo / 5.1 surround',addedAt:3,works:[{title:'Surround Sessions',duration:'32:15',tracks:[]}]},
    {id:'trial-usb',title:'Archive Edition',medium:'usb',photo:cover('Archive Edition','USB · 16 GB','#526654'),capacity:'16 GB',addedAt:2,notes:'Sample USB release. Audio files can be attached in the desktop app.'}
  ],meta:{albums:[{id:'trial-favorite',name:'Sample favorites',cdIds:['trial-mixed-1','trial-mixed-2','trial-mixed-3','trial-vinyl']}],playlists:[],order:{all:[],music:[]},settings:{lang:'en'}},sync:{metaAt:0,deleted:{}}};
}
function writeDoc(doc) {
  fs.mkdirSync(trialDir,{recursive:true});
  const temp=trialFile+'.tmp'; fs.writeFileSync(temp,JSON.stringify(doc,null,2)); fs.renameSync(temp,trialFile);
}
function trialHtml() {
  return fs.readFileSync(path.join(root,'src/index.html'),'utf8')
    .replace('<title>PMCO</title>','<title>PMCO · Physical media trial</title><script>window.CDC_DESKTOP=true;window.PMCO_TRIAL=true;</script>')
    .replace('<body>',`<body><div id="trial-banner" style="padding:10px 18px;background:var(--surface);color:var(--ink);border-bottom:1px solid var(--line);display:flex;gap:12px;align-items:center;justify-content:space-between;font:13px var(--font-body)"><span>Trial preview · Sample collection · Separate from your installed app</span><button type="button" class="linkbtn" id="trial-reset">Reset samples</button></div><script>document.getElementById('trial-reset').onclick=async function(){if(confirm('Reset this trial collection to the samples?')){var r=await fetch('/api/trial/reset',{method:'POST'});if(r.ok)location.reload();}};</script>`);
}
async function body(req) {
  let text=''; for await(const chunk of req) { text+=chunk; if(Buffer.byteLength(text)>20*1024*1024)throw new Error('Trial collection is too large'); }
  const doc=JSON.parse(text); if(!Array.isArray(doc.cds)||!doc.meta||typeof doc.meta!=='object')throw new Error('Invalid collection'); return doc;
}
function start(port=Number(process.env.PMCO_TRIAL_PORT)||4173) {
  if(!fs.existsSync(trialFile))writeDoc(makeTrialDoc());
  const server=http.createServer(async(req,res)=>{
    const origin=`http://127.0.0.1:${server.address().port}`;
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    function send(code,type,value) {res.writeHead(code,{'Content-Type':type});res.end(value);}
    if(req.headers.host!==new URL(origin).host || (req.headers.origin&&req.headers.origin!==origin))return send(403,'text/plain','Local preview only');
    try {
      const url=new URL(req.url,origin);
      if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'))return send(200,'text/html; charset=utf-8',trialHtml());
      if(req.method==='GET'&&url.pathname==='/build.js')return send(200,'text/javascript','/* local trial; installer metadata unchanged */');
      if(url.pathname==='/api/data') {
        if(req.method==='GET')return send(200,'application/json',fs.readFileSync(trialFile));
        if(req.method==='PUT'){writeDoc(await body(req));return send(200,'application/json','{"ok":true}');}
      }
      if(url.pathname==='/api/trial/reset'&&req.method==='POST'){writeDoc(makeTrialDoc());return send(200,'application/json','{"ok":true}');}
      return send(404,'text/plain','Not found');
    } catch(e) {return send(400,'application/json',JSON.stringify({error:e.message}));}
  });
  server.listen(port,'127.0.0.1',()=>console.log(`PMCO physical-media trial: http://127.0.0.1:${server.address().port}\nSample collection: ${trialFile}`));
  return server;
}
module.exports={makeTrialDoc,start,trialHtml};
if(require.main===module)start();
