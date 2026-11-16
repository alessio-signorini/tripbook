import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { renderTripPage, tripClientData, CLIENT_STOP_FIELDS } from '../src/shared/render/trip.js';
import { visibleStops } from '../src/shared/visible.js';
import { openInMaps, routeLinks } from '../src/shared/maps-links.js';
import { tripPath } from '../src/shared/paths.js';
import { mergeConfig } from '../src/shared/schema.js';
import { load, pisa, sb, sbRoutes, layover } from './fixtures.js';

const config = mergeConfig({ ...load('config.json'), google_maps_api_key: '' });
const assets = { css: '/assets/site.test.css', js: '/assets/trip.test.js' };

const page = (trip, { draft = false, cfg = config } = {}) =>
  renderTripPage(trip, { config: cfg, assets, path: tripPath(trip, cfg), draft, version: '0.0.0' });

test('Pisa page: stops, numbers, legs, notes, stars', () => {
  const html = page(pisa());
  for (const name of ['Pisa Centrale', 'Tuttomondo mural', 'Piazza dei Miracoli']) assert.ok(html.includes(name), name);
  assert.match(html, /<span class="badge-num">7<\/span>/);
  assert.equal((html.match(/class="leg"/g) || []).length, 6);
  assert.match(html, /3 min walk/);
  assert.match(html, /Arriving by train\?/);
  assert.match(html, /Flat and easy; about 2 km on foot\./);
  assert.match(html, /aria-label="Rated 5 out of 5"/);
  assert.match(html, /<strong>Leaning Tower<\/strong>/);
  assert.match(html, /Map unavailable: add google_maps_api_key to config\.json/);
  assert.match(html, /rel="alternate" type="text\/markdown"/);
  assert.match(html, /application\/ld\+json/);
});

test('Pisa page has no low-rated toggle', () => {
  assert.doesNotMatch(page(pisa()), /id="low-toggle"/);
});

test('Santa Barbara log: no dates leak, low stop visible, toggle checked, empty note renders nothing', () => {
  const html = page(sbRoutes());
  assert.doesNotMatch(html, /2026/);
  assert.doesNotMatch(html, /T\d\d:\d\d/);
  assert.doesNotMatch(html, /captured_at|auto_date/);
  const row = html.match(/<li class="stop"[^>]*data-stop="p-4"[^>]*>/)[0];
  assert.doesNotMatch(row, /hidden/);
  assert.match(row, /data-low/);
  assert.match(html, /<input type="checkbox" role="switch" id="low-toggle" checked>/);
  assert.match(html, /Show low-rated places \(1\)/);
  assert.match(html, /<span class="badge-num">B2<\/span>/);
  const waterfront = html.match(/<section class="sec" data-section="s-2"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(waterfront, /sec-note/);
});

test('Draft guide: noindex, no analytics, hidden low row, toggle off, numbering, links', () => {
  const cfg = mergeConfig({ ...config, google_analytics_id: 'G-TEST123' });
  const html = page(layover(), { draft: true, cfg });
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(html, /gtag|googletagmanager/);
  assert.doesNotMatch(html, /application\/ld\+json|text\/markdown/);
  assert.match(html, /<li class="stop"[^>]*data-stop="p-8"[^>]*data-low hidden>/);
  assert.match(html, /<input type="checkbox" role="switch" id="low-toggle">/);
  assert.deepEqual([...html.matchAll(/<span class="badge-num">(\d*)<\/span>/g)].map((m) => m[1]).filter(Boolean), ['1', '2', '3']);
  const open = html.match(/data-open-maps href="([^"]+)"/)[1];
  assert.ok(!open.includes('43.7225'));
  assert.match(html, /http:\/\/localhost:8080\/drafts\/italy\/pisa\/4-hours-layover\//);
});

test('Analytics only when ID is set, and never on drafts', () => {
  const withId = mergeConfig({ ...config, google_analytics_id: 'G-TEST123' });
  assert.doesNotMatch(page(pisa()), /gtag/);
  assert.match(page(pisa(), { cfg: withId }), /gtag\('config',"G-TEST123"\)/);
  assert.doesNotMatch(page(layover(), { draft: true, cfg: withId }), /gtag/);
});

test('Escapes user text', () => {
  const t = pisa();
  t.title = '<img src=x onerror=alert(1)>';
  t.sections[0].stops[0].name = '"><script>x</script>';
  const html = page(t);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>x<\/script>/);
});

const photo = {
  url: 'https://upload.wikimedia.org/x/1200px-Pisa.jpg',
  thumb: 'https://upload.wikimedia.org/x/240px-Pisa.jpg',
  title: 'Pisa',
  author: 'Jane <b>Doe</b>',
  license: 'CC BY-SA 4.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/4.0',
  source_url: 'https://commons.wikimedia.org/wiki/File:Pisa.jpg',
};

test('trip photo: share image only, no credit on the page, no image without photo', () => {
  const html = page({ ...pisa(), photo });
  assert.match(html, /<meta property="og:image" content="https:\/\/upload\.wikimedia\.org\/x\/1200px-Pisa\.jpg">/);
  assert.match(html, /summary_large_image/);
  assert.doesNotMatch(html, /photo-credit/);
  assert.doesNotMatch(page({ ...pisa(), photo: null }), /og:image/);
});

test('listing shows photo thumbnail on the card', async () => {
  const { renderListing } = await import('../src/shared/render/listing.js');
  const trip = { ...pisa(), photo };
  const html = renderListing([{ trip, path: '/italy/pisa/pisa-in-one-walk/' }], { config, assets, version: '0' });
  assert.match(html, /class="card-photo"[^>]*><img src="https:\/\/upload\.wikimedia\.org\/x\/240px-Pisa\.jpg"/);
  assert.match(html, /Photo credits/);
});

test('off-route stop: bullet badge, no number, no leg around it, excluded from route link', () => {
  const t = pisa();
  t.sections[0].stops[2].off_route = true; // Corso Italia, 43.7135,10.4005
  const html = page(t);
  assert.match(html, /<li class="stop off-route" data-stop="p-3"/);
  assert.match(html, /<span class="badge-num off">A<\/span>/);
  assert.match(html, /<span class="badge-num off">B<\/span>/);
  assert.deepEqual([...html.matchAll(/<span class="badge-num">(\d+)<\/span>/g)].map((m) => m[1]), ['1', '2', '3', '4', '5', '6']);
  assert.match(html, /<li class="leg" data-after="p-2" hidden/);
  assert.match(html, /<li class="leg" data-after="p-3" hidden/);
  assert.doesNotMatch(html.match(/data-open-maps href="([^"]+)"/)[1], /43\.7135/);
  assert.match(html, /data-stop="p-3"[\s\S]*?Directions to Corso Italia/);
});

test('Pisa guide has an off-path toggle, on by default', () => {
  assert.match(page(pisa()), /id="off-toggle" checked/);
});

test('#trip-data carries every stop field the browser needs: same labels, routes and totals as the full trip', () => {
  for (const make of [pisa, sb, layover]) {
    const trip = make();
    trip.sections[0].stops[1].off_route = true;
    const client = tripClientData(trip);
    for (const s of client.sections) for (const stop of s.stops) assert.ok(Object.keys(stop).every((k) => CLIENT_STOP_FIELDS.includes(k)), JSON.stringify(stop));
    for (const opts of [{ showLow: true }, { showLow: false }, { showLow: true, showOffRoute: false }]) {
      const summary = (t) =>
        visibleStops(t, opts).map((s) => ({
          labels: s.stops.map((e) => [e.stop.id, e.label, e.visible]),
          minutes: s.minutes,
          routes: routeLinks(s.routeStops),
          open: openInMaps(s.routeStops).url,
        }));
      assert.deepEqual(summary(client), summary(trip), `${trip.id} ${JSON.stringify(opts)}`);
    }
  }
});

test('the trip page script reads only CLIENT_STOP_FIELDS from stops', () => {
  const dir = new URL('../src/site/trip/', import.meta.url);
  const used = new Set();
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/\b(?:stop|first)\.([a-z_]+)/g)) used.add(m[1]);
  }
  assert.ok(used.size > 0);
  for (const field of used) assert.ok(CLIENT_STOP_FIELDS.includes(field), `src/site/trip/ reads stop.${field}`);
});

test('list sections are lettered off-route; solo buttons only with several sections', () => {
  const html = page(pisa());
  assert.match(html, /data-solo="s-2"/);
  assert.doesNotMatch(html, /<h2 class="sec-title">[A-Z] · /);
  assert.match(html, /<li class="stop off-route"[^>]*data-stop="p-9"[^>]*data-label="B"/);
  const single = pisa();
  single.sections.pop();
  assert.doesNotMatch(page(single), /data-solo/);
});
