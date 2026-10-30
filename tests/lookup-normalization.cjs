/* Source-only lookup regressions: no network, collection writes, build or install. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'src/index.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert(a >= 0 && b > a, start); return html.slice(a, b);
}
let release;
const context = vm.createContext({URLSearchParams, fetch: async () => ({ok: true, status: 200, json: async () => structuredClone(release)})});
vm.runInContext(section('  var DURATION = ', '  function toSeconds(') +
  section('  function inferWorkType(', '  function validRecordingYears(') +
  section('  function dgClean(', '  var LOOKUP_SOURCES = ') +
  '\nvar lookup = discogsSource.details;', context);
const metadata = vm.runInNewContext(section('  function workMetadata(', '  function workDisclosure(') + '\n({workMetadata, workOverrides});');
const track = (title, position, extraartists = []) => ({type_: 'track', title, position, duration: '3:21', extraartists});
const credit = (name, role, tracks) => ({name, role, ...(tracks ? {tracks} : {})});
const pianist = name => ({name, role: 'Pianist'});
const composer = name => credit(name, 'Composed By');
async function lookup(data, query = '431780-2') {
  release = {id: 1, title: 'Lookup QA', formats: [{name: 'CD', qty: '1'}], ...data};
  const before = structuredClone(release);
  const out = plain(await context.lookup({id: 1}, query));
  assert.deepEqual(release, before, 'source release was mutated'); return out;
}
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('PASS:', name); }
  catch (e) { process.exitCode = 1; console.error('FAIL:', name, e.stack); }
}
async function main() {
  await test('all inline scripts parse', () => {
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  });
  await test('431780-2 independent Liszt pieces remain four separate works', async () => {
    const titles = ['Nuages gris', 'La notte', 'La lugubre gondola II', 'Funérailles'];
    const out = await lookup({extraartists: [composer('Franz Liszt'), credit('Claudio Arrau', 'Piano')],
      tracklist: titles.map((title, i) => track(title, String(i + 1)))});
    assert.equal(out.catalogNo, '431780-2');
    assert.deepEqual(out.works.map(w => w.title), titles);
    assert.deepEqual(out.works.map(w => w.tracks.length), [1, 1, 1, 1]);
    assert(out.works.every(w => w.tracks[0].duration === '3:21'));
    assert.equal(out.composer, 'Franz Liszt');
    assert.deepEqual(out.performers, [pianist('Claudio Arrau')]);
    assert(out.works.every(w => !w.composer && !w.performers && !w.performersMode));
  });
  await test('uniform known types and composers occur only at album level', async () => {
    const out = await lookup({extraartists: [composer('A')], tracklist: [track('Sonata No. 1', '1'), track('Sonata No. 2', '2')]});
    assert.equal(out.type, 'Sonata'); assert.equal(out.composer, 'A');
    assert(out.works.every(w => !Object.hasOwn(w, 'type') && !Object.hasOwn(w, 'composer')));
  });
  await test('zero-work releases retain trustworthy album metadata', async () => {
    const album = {works: [], composer: 'Known composer', type: 'Sonata', performers: [pianist('Known pianist')]};
    assert.deepEqual(plain(context.dgNormalizeWorks(structuredClone(album))), album);
    const out = await lookup({title: 'Sonata', tracklist: [],
      extraartists: [composer('Known composer'), credit('Known pianist', 'Piano')]});
    assert.deepEqual(out.works, []);
    assert.equal(out.composer, 'Known composer'); assert.equal(out.type, 'Sonata');
    assert.deepEqual(out.performers, [pianist('Known pianist')]);
    const scoped = await lookup({tracklist: [], extraartists: [credit('Scoped composer', 'Composed By', '1')]});
    assert.equal(scoped.composer, undefined);
  });
  await test('unknown work blocks type promotion; explicit composer exception blocks composer promotion', async () => {
    const out = await lookup({extraartists: [composer('A')], tracklist: [track('Sonata', '1'), track('Independent piece', '2', [composer('B')])]});
    assert.equal(out.type, undefined); assert.equal(out.composer, undefined);
    assert.deepEqual(out.works.map(w => w.type || ''), ['Sonata', '']);
    assert.deepEqual(out.works.map(w => w.composer), ['A', 'B']);
    const missing = await lookup({tracklist: [track('Sonata', '1', [composer('A')]), track('Other piece', '2')]});
    assert.equal(missing.composer, undefined); assert.equal(missing.works[1].composer, '');
  });
  await test('performer intersection uses name AND role; only extras remain on works', async () => {
    const out = await lookup({extraartists: [credit('Common', 'Orchestra')], tracklist: [
      track('First piece', '1', [credit('Shared', 'Piano, Conductor'), credit('First', 'Violin')]),
      track('Second piece', '2', [credit('Shared', 'Piano'), credit('Second', 'Cello')])
    ]});
    assert.deepEqual(out.performers, [{name: 'Common', role: 'Orchestra'}, pianist('Shared')]);
    assert.deepEqual(out.works[0].performers, [{name: 'Shared', role: 'Conductor'}, {name: 'First', role: 'Violinist'}]);
    assert.deepEqual(out.works[1].performers, [{name: 'Second', role: 'Cellist'}]);
    assert(out.works.every(w => w.performersMode === 'additional'));
    assert.equal(metadata.workMetadata(out, out.works[0]).performers.length, 4);
    assert.deepEqual(plain(metadata.workOverrides(out, out.works[0]).performers), out.works[0].performers);
  });
  await test('missing work credits cannot promote a subset; legacy manual overrides replace', async () => {
    const out = await lookup({tracklist: [track('First', '1', [credit('Soloist', 'Piano')]), track('Second', '2')]});
    assert.deepEqual(out.performers, []); assert.equal(out.works[0].performersMode, 'additional');
    assert.equal(out.works[1].performers, undefined);
    const album = {performers: [pianist('Album')]}, work = {performers: [pianist('Manual')]};
    assert.deepEqual(plain(metadata.workMetadata(album, work).performers), work.performers);
    assert.deepEqual(plain(metadata.workMetadata(album, {...work, performersMode: 'additional'}).performers), album.performers.concat(work.performers));
  });
  await test('release tracks scopes honor ranges, lists, and composer exceptions without credit leakage', async () => {
    const out = await lookup({extraartists: [composer('A'), credit('B', 'Composed By', '2'),
      credit('Scoped', 'Piano', '1 to 2'), credit('Only first', 'Violin', '1'), credit('Invalid scope', 'Cello', 'unmapped')],
      tracklist: [track('First', '1'), track('Second', '2'), track('Third', '3')]});
    assert.equal(out.composer, undefined);
    assert.deepEqual(out.works.map(w => w.composer), ['A', 'B', 'A']);
    assert.deepEqual(out.performers, []);
    assert.deepEqual(out.works[0].performers, [pianist('Scoped'), {name: 'Only first', role: 'Violinist'}]);
    assert.deepEqual(out.works[1].performers, [pianist('Scoped')]);
    assert.equal(out.works[2].performers, undefined);
    assert(context.dgCreditApplies('1, 3', '3', ['1', '2', '3']));
    assert(context.dgCreditApplies('1-3', '2', ['1', '2', '3']));
    assert(!context.dgCreditApplies('1-3', '1-2', ['1-1', '1-2', '1-3']));
  });
  await test('index, heading, numbered movements and Work: Movement grouping stay intact', async () => {
    const out = await lookup({extraartists: [composer('A')], tracklist: [
      {type_: 'index', title: 'Sonata', extraartists: [credit('Index artist', 'Piano')], sub_tracks: [track('I. Allegro', '1'), track('II. Andante', '2')]},
      track('Nuages gris', '3'), track('I. Allegro', '4'), track('II. Adagio', '5'),
      track('La notte', '6'), track('Suite: Prelude', '7'), track('Suite: Dance', '8'),
      {type_: 'heading', title: 'Symphony'}, track('First movement', '9'), track('Final movement', '10')
    ]});
    assert.deepEqual(out.works.map(w => w.tracks.length), [2, 1, 2, 1, 2, 2]);
    assert.deepEqual(out.works[0].performers, [pianist('Index artist')]);
    assert.equal(out.works[0].performersMode, 'additional');
    assert.equal(out.works[4].title, 'Suite');
  });
  await test('global normalization includes all discs; first disc never dictates later discs', async () => {
    const out = await lookup({formats: [{name: 'CD', qty: '2'}], extraartists: [composer('A'), credit('Common', 'Orchestra')], tracklist: [
      track('Sonata', '1-1', [credit('One', 'Piano')]), track('Symphony', '2-1', [composer('B'), credit('Two', 'Piano')])
    ]});
    assert.equal(out.type, undefined); assert.equal(out.composer, undefined); assert.equal(out.lookupDiscs.length, 2);
    assert.equal(out.lookupDisc, 1); assert.equal(out.set, undefined);
    assert.deepEqual(out.lookupDiscs.map(d => d.works[0].type), ['Sonata', 'Symphony']);
    assert.deepEqual(out.lookupDiscs.map(d => d.works[0].composer), ['A', 'B']);
    assert.deepEqual(out.performers, [{name: 'Common', role: 'Orchestra'}]);
    assert.deepEqual(out.lookupDiscs.map(d => d.works[0].performers), [[pianist('One')], [pianist('Two')]]);
    assert.deepEqual(out.works, out.lookupDiscs[0].works);
    const uniform = await lookup({formats: [{name: 'CD', qty: '2'}], extraartists: [composer('A')],
      tracklist: [track('Sonata No. 1', '1-1'), track('Sonata No. 2', '2-1')]});
    assert.equal(uniform.type, 'Sonata'); assert.equal(uniform.composer, 'A');
    assert(uniform.lookupDiscs.every(d => d.works.every(w => !w.type && !w.composer)));
  });
  await test('name casing, release artist role inference, and mixed-source performers remain scoped', async () => {
    const out = await lookup({artists: [{name: 'Example Orchestra'}, {name: 'Conductor Person'}],
      extraartists: [credit('Soloist NAME', 'Piano')], tracklist: [
        {...track('First', '1'), extraartists: [{name: 'Soloist NAME', anv: 'Soloist Name', role: 'Piano'}, credit('Local', 'Violin')]}, track('Second', '2')
      ]});
    assert(out.performers.some(p => p.name === 'Soloist Name' && p.role === 'Pianist'));
    assert(out.performers.some(p => p.name === 'Example Orchestra' && p.role === 'Orchestra'));
    assert(out.performers.some(p => p.name === 'Conductor Person' && p.role === 'Conductor'));
    assert(!out.performers.some(p => p.name === 'Local'));
  });
}
main().catch(e => {console.error(e); process.exitCode = 1;}).finally(() => console.log(passed + ' lookup normalization checks passed'));
