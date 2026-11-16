import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, cp, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../src/build/build-site.mjs';

let tmp;
let out;
const quiet = () => {};

before(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'tripbook-site-'));
  out = join(tmp, 'out');
  await buildSite({ data: 'examples/data', out, log: quiet });
});
after(() => rm(tmp, { recursive: true, force: true }));

async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) files.push(join(e.parentPath, e.name));
  }
  return files;
}

test('expected files exist', async () => {
  for (const f of [
    'italy/pisa/pisa-in-one-walk/index.html',
    'usa/california/santa-barbara/perfect-day/index.html',
    'drafts/italy/pisa/4-hours-layover/index.html',
    'index.html',
    'italy/index.html',
    'usa/california/index.html',
    'sitemap.xml',
    'robots.txt',
    '404.html',
    'llms.txt',
    'llms-full.txt',
  ]) {
    assert.ok(existsSync(join(out, f)), f);
  }
  const assets = await readdir(join(out, 'assets'));
  assert.ok(assets.some((a) => /^trip\.[0-9a-f]{8}\.js$/.test(a)));
  assert.ok(assets.some((a) => /^space-grotesk-700-latin-[A-Z0-9]+\.woff2$/.test(a)));
  assert.ok(!assets.some((a) => a.endsWith('.css')), 'CSS is inlined, not written');
});

test('pages inline the CSS, preload the self-hosted heading font, and load no third-party fonts', async () => {
  for (const f of ['italy/pisa/pisa-in-one-walk/index.html', 'index.html', '404.html']) {
    const html = await readFile(join(out, f), 'utf8');
    assert.match(html, /<style>[^<]*\.stop-name\{/, f);
    assert.doesNotMatch(html, /rel="stylesheet"|fonts\.googleapis|fonts\.gstatic/, f);
    const font = html.match(/<link rel="preload" href="(\/assets\/space-grotesk-700-latin-[A-Z0-9]+\.woff2)" as="font" type="font\/woff2" crossorigin>/);
    assert.ok(font && existsSync(join(out, font[1])), f);
    assert.ok(html.includes(`url("${font[1]}")`), `${f}: @font-face points at the preloaded file`);
  }
  assert.match(await readFile(join(out, '404.html'), 'utf8'), /<meta name="robots" content="noindex">[\s\S]*Page not found/);
});

test('draft is not listed; sitemap has no lastmod; no edit folder', async () => {
  const index = await readFile(join(out, 'index.html'), 'utf8');
  const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');
  assert.ok(!index.includes('layover') && !index.includes('Pisa with 4 hours'));
  assert.ok(!sitemap.includes('drafts') && !sitemap.includes('layover'));
  assert.ok(!sitemap.includes('lastmod'));
  assert.ok(sitemap.includes('http://localhost:8080/italy/pisa/pisa-in-one-walk/'));
  assert.ok(!existsSync(join(out, 'edit')));
});

test('output contains no .json file', async () => {
  const json = (await walk(out)).filter((f) => f.endsWith('.json'));
  assert.deepEqual(json, []);
});

test('Markdown per published trip only', () => {
  assert.ok(existsSync(join(out, 'italy/pisa/pisa-in-one-walk/index.md')));
  assert.ok(existsSync(join(out, 'usa/california/santa-barbara/perfect-day/index.md')));
  assert.ok(!existsSync(join(out, 'drafts/italy/pisa/4-hours-layover/index.md')));
});

test('robots.txt and generator meta', async () => {
  const robots = await readFile(join(out, 'robots.txt'), 'utf8');
  assert.match(robots, /User-agent: \*\nDisallow: \/drafts\//);
  assert.match(robots, /Sitemap: http:\/\/localhost:8080\/sitemap\.xml/);
  assert.ok(!robots.includes('GPTBot'));
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.match(html, /<meta name="generator" content="tripbook \d+\.\d+\.\d+">/);
});

test('ai_crawlers disallow: agents listed, llms files skipped', async () => {
  const data = join(tmp, 'data');
  await cp('examples/data', data, { recursive: true });
  const cfg = JSON.parse(await readFile(join(data, 'config.json'), 'utf8'));
  cfg.ai_crawlers = 'disallow';
  await writeFile(join(data, 'config.json'), JSON.stringify(cfg));
  const o = join(tmp, 'out2');
  await buildSite({ data, out: o, log: quiet });
  const robots = await readFile(join(o, 'robots.txt'), 'utf8');
  for (const a of ['GPTBot', 'ClaudeBot', 'CCBot', 'Bytespider', 'meta-externalagent']) {
    assert.match(robots, new RegExp(`User-agent: ${a}\\nDisallow: /`));
  }
  assert.ok(!existsSync(join(o, 'llms.txt')));
  assert.ok(!existsSync(join(o, 'llms-full.txt')));
});

test('redirects for old paths; live path wins', async () => {
  const data = join(tmp, 'data-redirect');
  await cp('examples/data', data, { recursive: true });
  const file = join(data, 'published/pisa-in-one-walk.json');
  const trip = JSON.parse(await readFile(file, 'utf8'));
  trip.old_paths = ['/italy/old-pisa/', '/usa/california/santa-barbara/perfect-day/'];
  await writeFile(file, JSON.stringify(trip));
  const o = join(tmp, 'out3');
  const summary = await buildSite({ data, out: o, log: quiet });
  assert.equal(summary.redirects, 1);
  const html = await readFile(join(o, 'italy/old-pisa/index.html'), 'utf8');
  assert.match(html, /url=\/italy\/pisa\/pisa-in-one-walk\//);
  const live = await readFile(join(o, 'usa/california/santa-barbara/perfect-day/index.html'), 'utf8');
  assert.match(live, /A perfect day in Santa Barbara/);
});

test('fails with a clear message: invalid trip, newer schema, collisions', async () => {
  const data = join(tmp, 'data-bad');
  await cp('examples/data', data, { recursive: true });
  const file = join(data, 'published/pisa-in-one-walk.json');
  const trip = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...trip, v: 2 }));
  await assert.rejects(buildSite({ data, out: join(tmp, 'o4'), log: quiet }), /published\/pisa-in-one-walk\.json: uses schema v2.*scripts\/release\.sh/);

  await writeFile(file, JSON.stringify({ ...trip, kind: 'nope' }));
  await assert.rejects(buildSite({ data, out: join(tmp, 'o5'), log: quiet }), /pisa-in-one-walk\.json: "kind"/);

  await writeFile(file, JSON.stringify(trip));
  await writeFile(join(data, 'published/pisa-copy.json'), JSON.stringify({ ...trip, id: 'pisa-copy' }));
  await assert.rejects(buildSite({ data, out: join(tmp, 'o6'), log: quiet }), /published\/pisa-in-one-walk\.json and published\/pisa-copy\.json both resolve to/);
});

test('empty data repo builds', async () => {
  const data = join(tmp, 'data-empty');
  await mkdir(join(data, 'published'), { recursive: true });
  const o = join(tmp, 'o7');
  const summary = await buildSite({ data, out: o, log: quiet });
  assert.equal(summary.published, 0);
  assert.ok(existsSync(join(o, 'index.html')));
});
