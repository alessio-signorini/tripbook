import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGithub, ConflictError, toBase64, fromBase64, GithubError } from '../src/editor/github.js';
import { syncTrip, publishTrip, pullRemote, newRecord, ValidationError } from '../src/editor/sync.js';
import { newTrip, newSection, newStop } from '../src/shared/schema.js';
import { DEFAULT_CONFIG } from '../src/shared/schema.js';

const realFetch = globalThis.fetch;
let calls;
let handler;

beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const call = { url, method: init.method || 'GET', headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const r = await handler(call);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: r.statusText || '',
      json: async () => r.json,
    };
  };
});
afterEach(() => (globalThis.fetch = realFetch));

const gh = () => createGithub({ owner: 'me', repo: 'trips', branch: 'main', token: 'tok' });
const ok = (json, status = 200) => ({ status, json });

test('base64 round trip with non-ASCII', () => {
  const text = '{"name":"Caffè ☕ 東京"}';
  assert.equal(fromBase64(toBase64(text)), text);
  assert.equal(fromBase64(toBase64(text).replace(/(.{10})/g, '$1\n')), text);
});

test('putFile sends UTF-8 content, headers, and returns the new sha', async () => {
  handler = () => ok({ content: { sha: 'new' } });
  const sha = await gh().putFile('drafts/a.json', { name: 'Caffè' }, 'old', 'Sync: A');
  assert.equal(sha, 'new');
  const c = calls[0];
  assert.equal(c.method, 'PUT');
  assert.equal(c.url, 'https://api.github.com/repos/me/trips/contents/drafts/a.json');
  assert.equal(c.headers.Authorization, 'Bearer tok');
  assert.equal(c.headers['X-GitHub-Api-Version'], '2022-11-28');
  assert.equal(c.body.sha, 'old');
  assert.equal(c.body.branch, 'main');
  assert.deepEqual(JSON.parse(fromBase64(c.body.content)), { name: 'Caffè' });
  assert.ok(!c.url.includes('/data/'));
});

test('putFile maps 409 and sha-mismatch 422 to ConflictError; other errors stay', async () => {
  handler = () => ({ status: 409, json: { message: 'conflict' } });
  await assert.rejects(gh().putFile('drafts/a.json', {}, 's', 'm'), ConflictError);
  handler = () => ({ status: 422, json: { message: 'drafts/a.json does not match abc' } });
  await assert.rejects(gh().putFile('drafts/a.json', {}, 's', 'm'), ConflictError);
  handler = () => ({ status: 422, json: { message: 'Invalid request' } });
  await assert.rejects(gh().putFile('drafts/a.json', {}, 's', 'm'), GithubError);
});

test('getFile decodes content; 404 gives null; listFolder 404 gives []', async () => {
  handler = (c) => (c.url.includes('/contents/drafts?') ? { status: 404, json: {} } : ok({ sha: 's1', content: toBase64('{"title":"Caffè"}') }));
  assert.deepEqual(await gh().getFile('drafts/a.json'), { data: { title: 'Caffè' }, sha: 's1' });
  assert.deepEqual(await gh().listFolder('drafts'), []);
  handler = () => ({ status: 404, json: {} });
  assert.equal(await gh().getFile('config.json'), null);
});

test('moveFile commits one tree with an add and a delete', async () => {
  handler = (c) => {
    if (c.method === 'GET' && c.url.endsWith('/git/ref/heads/main')) return ok({ object: { sha: 'head' } });
    if (c.url.endsWith('/git/commits/head')) return ok({ tree: { sha: 'tree0' } });
    if (c.method === 'GET' && c.url.includes('/contents/drafts/a.json')) return ok({ sha: 'blob-old', content: toBase64('{}') });
    if (c.url.endsWith('/git/trees')) return ok({ sha: 'tree1' }, 201);
    if (c.url.endsWith('/git/commits')) return ok({ sha: 'commit1' }, 201);
    if (c.method === 'PATCH') return ok({});
    if (c.url.includes('/contents/published/a.json')) return ok({ sha: 'blob-new', content: toBase64('{}') });
    throw new Error(`unexpected ${c.method} ${c.url}`);
  };
  const sha = await gh().moveFile('drafts/a.json', 'published/a.json', { t: 1 }, 'blob-old', 'Publish: A');
  assert.equal(sha, 'blob-new');
  const trees = calls.filter((c) => c.url.endsWith('/git/trees'));
  assert.equal(trees.length, 1);
  assert.equal(trees[0].body.base_tree, 'tree0');
  assert.equal(trees[0].body.tree.length, 2);
  assert.equal(trees[0].body.tree[0].path, 'published/a.json');
  assert.equal(JSON.parse(trees[0].body.tree[0].content).t, 1);
  assert.deepEqual(trees[0].body.tree[1], { path: 'drafts/a.json', mode: '100644', type: 'blob', sha: null });
  assert.equal(calls.filter((c) => c.url.endsWith('/git/commits') && c.method === 'POST').length, 1);
  assert.equal(calls.find((c) => c.method === 'PATCH').body.sha, 'commit1');
  for (const c of calls) assert.ok(!/\/data\//.test(c.url));
});

test('moveFile throws ConflictError when the source sha changed', async () => {
  handler = (c) => {
    if (c.url.endsWith('/git/ref/heads/main')) return ok({ object: { sha: 'head' } });
    if (c.url.endsWith('/git/commits/head')) return ok({ tree: { sha: 'tree0' } });
    return ok({ sha: 'someone-else', content: toBase64('{}') });
  };
  await assert.rejects(gh().moveFile('drafts/a.json', 'published/a.json', {}, 'blob-old', 'm'), ConflictError);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
});

/* ---------- sync logic ---------- */
function validTrip() {
  const trip = newTrip({ title: 'Pisa', slug: 'pisa', location: { country: 'Italy', country_code: 'IT', region: '', city: 'Pisa' } });
  const s = newSection();
  s.stops.push(newStop({ name: 'Tower', lat: 43.7, lng: 10.4 }));
  trip.sections.push(s);
  return trip;
}

test('syncTrip: new trips go to drafts/, validate first, stamp v', async () => {
  const puts = [];
  const fake = { putFile: async (...a) => (puts.push(a), 'sha1') };
  const rec = await syncTrip(fake, newRecord(validTrip()), DEFAULT_CONFIG);
  assert.equal(puts[0][0], `drafts/${rec.trip.id}.json`);
  assert.equal(puts[0][1].v, 1);
  assert.equal(puts[0][3], 'Sync: Pisa');
  assert.deepEqual([rec.folder, rec.sha, rec.dirty, rec.path_at_sync], ['drafts', 'sha1', false, '/italy/pisa/pisa/']);

  const bad = newRecord({ ...validTrip(), title: '' });
  await assert.rejects(syncTrip(fake, bad, DEFAULT_CONFIG), ValidationError);
  assert.equal(puts.length, 1);
});

test('syncTrip: published path change appends old path once', async () => {
  const fake = { putFile: async () => 'sha2' };
  const trip = validTrip();
  let rec = { trip, folder: 'published', sha: 's', dirty: true, path_at_sync: '/italy/pisa/pisa/', auto_sync: true };
  rec.trip.slug = 'pisa-2';
  rec = await syncTrip(fake, rec, DEFAULT_CONFIG);
  assert.deepEqual(rec.trip.old_paths, ['/italy/pisa/pisa/']);
  assert.equal(rec.path_at_sync, '/italy/pisa/pisa-2/');
  rec = await syncTrip(fake, { ...rec, dirty: true }, DEFAULT_CONFIG);
  assert.deepEqual(rec.trip.old_paths, ['/italy/pisa/pisa/']);
});

test('publishTrip syncs dirty drafts first, then moves', async () => {
  const log = [];
  const fake = {
    putFile: async () => (log.push('put'), 'sha1'),
    moveFile: async (from, to, json, sha, msg) => (log.push(`move ${from} -> ${to} ${sha} ${msg}`), 'sha9'),
  };
  const rec = await publishTrip(fake, newRecord(validTrip()), DEFAULT_CONFIG);
  assert.equal(log[0], 'put');
  assert.match(log[1], /^move drafts\/.+ -> published\/.+ sha1 Publish: Pisa$/);
  assert.deepEqual([rec.folder, rec.sha, rec.dirty], ['published', 'sha9', false]);
});

test('pullRemote keeps dirty locals, fetches new and changed, removes vanished', async () => {
  const t = (id) => ({ ...validTrip(), id });
  const files = { 'drafts/new.json': t('new'), 'published/changed.json': t('changed') };
  const fake = {
    listFolder: async (folder) => (folder === 'drafts' ? [{ name: 'new.json', sha: 'n1' }, { name: 'dirty.json', sha: 'd2' }] : [{ name: 'changed.json', sha: 'c2' }]),
    getFile: async (path) => (path === 'config.json' ? { data: { site_title: 'X' }, sha: 'cfg' } : { data: files[path], sha: path.includes('changed') ? 'c2' : 'n1' }),
  };
  const locals = new Map([
    ['dirty', { trip: t('dirty'), folder: 'drafts', sha: 'd1', dirty: true }],
    ['changed', { trip: t('changed'), folder: 'published', sha: 'c1', dirty: false }],
    ['gone', { trip: t('gone'), folder: 'drafts', sha: 'g1', dirty: false }],
    ['unsynced', { trip: t('unsynced'), folder: null, sha: null, dirty: true }],
  ]);
  const out = await pullRemote(fake, locals, DEFAULT_CONFIG);
  assert.deepEqual([...out.records.keys()].sort(), ['changed', 'new']);
  assert.deepEqual(out.removed, ['gone']);
  assert.equal(out.config.config.site_title, 'X');
});

/* ---------- demo (fake) client ---------- */
test('fake github: same contract as the real client (put, get, list, conflict, move, delete)', async () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: (k) => delete store[k] };
  const { createFakeGithub, seedDemo } = await import('../src/editor/demo.js');
  seedDemo({ config: { site_title: 'X' }, files: { 'drafts/a.json': { title: 'A' } } });
  const g = createFakeGithub();
  assert.deepEqual((await g.listFolder('drafts')).map((f) => f.name), ['a.json']);
  assert.deepEqual(await g.listFolder('published'), []);
  assert.equal((await g.getFile('config.json')).data.site_title, 'X');
  assert.equal(await g.getFile('drafts/missing.json'), null);

  const first = await g.getFile('drafts/a.json');
  const sha2 = await g.putFile('drafts/a.json', { title: 'A2' }, first.sha, 'm');
  assert.notEqual(sha2, first.sha);
  await assert.rejects(g.putFile('drafts/a.json', { title: 'A3' }, first.sha, 'm'), ConflictError);
  assert.equal(await g.putFile('drafts/new.json', { title: 'N' }, null, 'm') !== null, true);

  const moved = await g.moveFile('drafts/a.json', 'published/a.json', { title: 'A2' }, sha2, 'm');
  assert.equal((await g.getFile('published/a.json')).sha, moved);
  assert.equal(await g.getFile('drafts/a.json'), null);
  await assert.rejects(g.deleteFile('published/a.json', 'stale', 'm'), ConflictError);
  await g.deleteFile('published/a.json', moved, 'm');
  assert.equal(await g.getFile('published/a.json'), null);
  delete globalThis.localStorage;
});
