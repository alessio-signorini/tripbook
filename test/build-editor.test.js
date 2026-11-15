import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildEditor } from '../src/build/build-editor.mjs';

let tmp;
let out;
let build;

before(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'tripbook-editor-'));
  out = join(tmp, 'out');
  build = await buildEditor({ out, log: () => {} });
});
after(() => rm(tmp, { recursive: true, force: true }));

test('index.html references the hashed bundle and stylesheet', async () => {
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="\/app\.[0-9a-f]{8}\.js">/);
  assert.match(html, /<link rel="stylesheet" href="\/editor\.[0-9a-f]{8}\.css">/);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.doesNotMatch(html, /gtag|googletagmanager/);
});

test('build.json has version, commit and preview assets that exist', async () => {
  const b = JSON.parse(await readFile(join(out, 'build.json'), 'utf8'));
  assert.match(b.version, /^\d+\.\d+\.\d+$/);
  assert.ok(b.commit);
  assert.match(b.preview.trip_js, /^preview\/trip\.[0-9a-f]{8}\.js$/);
  assert.match(b.preview.site_css, /^preview\/site\.[0-9a-f]{8}\.css$/);
  assert.ok(existsSync(join(out, b.preview.trip_js)));
  assert.ok(existsSync(join(out, b.preview.site_css)));
  assert.equal(b.version, build.version);
});

test('sw.js lists the shell files and has a cache version', async () => {
  const sw = await readFile(join(out, 'sw.js'), 'utf8');
  assert.match(sw, /CACHE_VERSION = 'tripbook-[0-9a-f]{8}'/);
  const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
  for (const f of ['/', '/index.html', '/build.json', '/manifest.webmanifest']) assert.ok(shell.includes(f), f);
  assert.ok(shell.some((f) => /^\/app\.[0-9a-f]{8}\.js$/.test(f)));
  assert.ok(shell.some((f) => f.startsWith('/preview/trip.')));
  assert.ok(!shell.includes('/sw.js'));
});

test('manifest has start_url "/" and the 404 redirects to /', async () => {
  const m = JSON.parse(await readFile(join(out, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.start_url, '/');
  assert.equal(m.display, 'standalone');
  assert.match(await readFile(join(out, '404.html'), 'utf8'), /url=\//);
});
