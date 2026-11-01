/* Real PostgreSQL trigger/RLS checks in an in-memory PGlite database. No hosted data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let PGlite;
try { ({PGlite} = require(process.env.PMCO_PGLITE_MODULE || process.env.CDSHELF_PGLITE_MODULE || '@electric-sql/pglite')); }
catch { throw Error('Install dev dependencies or set PMCO_PGLITE_MODULE to a PGlite package path.'); }
const previousSql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261101_profile_handle_rules.sql'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261101_profile_handle_relaxed.sql'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
const db = new PGlite();
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS:', name); }
async function reject(query, code) { await assert.rejects(db.query(query), e => e.code === code); }
const row = async id => (await db.query('select * from profiles where user_id=$1', [id])).rows[0];
async function main() {
  await db.exec(`create role authenticated; create role anon;
    create schema auth;
    create function auth.uid() returns text language sql stable as $$ select current_setting('test.uid',true) $$;
    create table public.profiles(user_id text primary key, handle text check(handle ~ '^[A-Za-z0-9_]{3,20}$'), nickname text, avatar text, updated_ms bigint);
    create unique index profiles_handle_unique on profiles(lower(handle));
    alter table profiles enable row level security;
    create policy "own profile" on profiles for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
    grant usage on schema public,auth to authenticated,anon;
    grant all on profiles to authenticated;
    insert into profiles values ('legacy','old','Original',null,1);`);
  await db.exec(previousSql);
  await test('migration is additive and rerunnable; legacy IDs and profile data survive', async () => {
    const before = await row('legacy'); await db.exec(sql); await db.exec(sql);
    assert.deepEqual(await row('legacy'), {...before, handle_changed_at:null});
    await db.query("update profiles set nickname='Changed' where user_id='legacy'");
    assert.equal((await row('legacy')).handle, 'old');
    assert.equal((await row('legacy')).handle_changed_at, null);
  });
  await test('new IDs enforce 4–20 ASCII letters, digits or underscores in database and client', async () => {
    const HANDLE = new RegExp(html.match(/var HANDLE = \/(.+)\/;/)[1]);
    for (const handle of ['abc','a'.repeat(21),'bad-name','with space','用户12345','']) {
      assert.equal(HANDLE.test(handle), false);
      await assert.rejects(db.query('insert into profiles(user_id,handle) values($1,$2)', ['invalid',handle]), e => e.code==='23514');
    }
    for (const [i,handle] of ['ID_4','abc_123','A'.repeat(20)].entries()) {
      assert.equal(HANDLE.test(handle), true);
      await db.query('insert into profiles(user_id,handle) values($1,$2)', ['valid'+i,handle]);
    }
    await db.query("insert into profiles(user_id,handle) values('blank',null)");
    assert.equal((await row('blank')).handle_changed_at, null);
    await reject("update profiles set handle='abc' where user_id='legacy'", '23514');
  });
  await test('immediate repeated changes, clearing, reassignment and upserts are allowed', async () => {
    await db.query("insert into profiles(user_id,handle,handle_changed_at) values('fresh','fresh_01','2000-01-01')");
    const first = await row('fresh'); assert(Math.abs(Date.now() - new Date(first.handle_changed_at).getTime()) < 10000);
    await db.query("update profiles set handle='new4',handle_changed_at='2000-01-01' where user_id='fresh'");
    assert.equal((await row('fresh')).handle,'new4');
    await db.query("update profiles set handle=null where user_id='fresh'");
    await db.query("update profiles set handle='next' where user_id='fresh'");
    await db.query("insert into profiles(user_id,handle) values('fresh','fresh_02') on conflict(user_id) do update set handle=excluded.handle");
    assert.equal((await row('fresh')).handle,'fresh_02');
    assert(Math.abs(Date.now() - new Date((await row('fresh')).handle_changed_at).getTime()) < 10000);
  });
  await test('nickname/photo saves preserve timestamps, forged dates are ignored and migration retains recent changes', async () => {
    const first=await row('fresh');
    await db.query("update profiles set nickname='New nickname',avatar='photo',handle_changed_at='2000-01-01' where user_id='fresh'");
    assert.deepEqual((await row('fresh')).handle_changed_at, first.handle_changed_at);
    await db.exec(sql); assert.deepEqual((await row('fresh')).handle_changed_at, first.handle_changed_at);
    await db.query("update profiles set handle='NEW4' where user_id='legacy'");
    assert((await row('legacy')).handle_changed_at);
  });
  await test('RLS prevents delete/recreate bypass and cross-user reads; uniqueness ignores case', async () => {
    await db.exec("set role authenticated; set test.uid='fresh';");
    assert.equal((await db.query("delete from profiles where user_id='fresh' returning user_id")).rows.length, 0);
    assert.equal((await db.query("select * from profiles where user_id='legacy'")).rows.length, 0);
    await assert.rejects(db.query("insert into profiles(user_id,handle) values('other','other_1')"), e=>e.code==='42501');
    await db.exec('reset role');
    await reject("insert into profiles(user_id,handle) values('duplicate','FRESH_02')", '23505');
    assert.equal((await row('fresh')).handle,'fresh_02');
  });
  await test('fresh-project schema uses the same relaxed rules as upgraded projects', async () => {
    const fresh=new PGlite();
    try {
      await fresh.exec("create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;create table auth.users(id uuid primary key);");
      await fresh.exec(fs.readFileSync(path.join(__dirname,'../supabase/schema.sql'),'utf8'));
      await fresh.exec("insert into auth.users values('00000000-0000-0000-0000-000000000001');insert into profiles(user_id,handle,updated_ms) values('00000000-0000-0000-0000-000000000001','four',1);update profiles set handle='next';update profiles set handle='last';");
      assert.equal((await fresh.query('select handle from profiles')).rows[0].handle,'last');
      await assert.rejects(fresh.query("update profiles set handle='abc'"),e=>e.code==='23514');
    }finally{await fresh.close();}
  });
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await db.close();console.log(passed+' profile rule checks passed');});
