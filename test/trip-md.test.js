import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderTripMarkdown } from '../src/shared/render/trip-md.js';
import { renderLlmsTxt, renderLlmsFull } from '../src/shared/render/llms.js';
import { tripJsonLd } from '../src/shared/render/jsonld.js';
import { renderTripPage } from '../src/shared/render/trip.js';
import { tripPath } from '../src/shared/paths.js';
import { mergeConfig } from '../src/shared/schema.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../examples/data/${p}`, import.meta.url), 'utf8'));
const pisa = () => load('published/pisa-in-one-walk.json');
const sb = () => load('published/santa-barbara-perfect-day.json');
const layover = () => load('drafts/pisa-4-hours-layover.json');
const config = mergeConfig(load('config.json'));
const md = (t) => renderTripMarkdown(t, { config, url: `http://localhost:8080${tripPath(t, config)}` });

test('Pisa Markdown', () => {
  const out = md(pisa());
  assert.match(out, /^# Pisa in one walk/);
  assert.match(out, /Arriving by train\?/);
  assert.match(out, /1\. \*\*Pisa Centrale\*\* — Piazza della Stazione, Pisa/);
  assert.match(out, /Google Maps: https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=43\.7085,10\.3984/);
  assert.match(out, /Rating: 5\/5/);
  assert.match(out, /Next: 3 min walk/);
  assert.doesNotMatch(out, /^## Not recommended/m);
});

test('Layover guide lists low stop only under Not recommended', () => {
  const out = md(layover());
  const [main, rest] = out.split('## Not recommended');
  assert.ok(!main.includes('Tourist-trap'));
  assert.match(rest, /Tourist-trap café.*1\/5/);
  assert.doesNotMatch(main, /Next: 5 min walk/);
});

test('Log lists low stop inline; no dates or internal ids', () => {
  const out = md(sb());
  assert.match(out, /\*\*Butterfly Beach\*\*/);
  assert.match(out, /## A · Downtown/);
  assert.doesNotMatch(out, /\d{4}-\d{2}-\d{2}|captured_at|place_id|2026/);
  assert.doesNotMatch(out, /Time:\s*(·|$)/m);
  assert.doesNotMatch(out, /Rating:\s*(·|$)/m);
  assert.doesNotMatch(out, /^## B · Waterfront\n\n\n/m);
});

const items = () => [
  { trip: pisa(), path: tripPath(pisa(), config) },
  { trip: sb(), path: tripPath(sb(), config) },
];

test('llms.txt and llms-full.txt', () => {
  const txt = renderLlmsTxt(items(), { config });
  assert.match(txt, /^# Trips\n\n> Trip logs and city guides by Alessio\./);
  assert.match(txt, /\(http:\/\/localhost:8080\/italy\/pisa\/pisa-in-one-walk\/index\.md\)/);
  assert.match(txt, /\(http:\/\/localhost:8080\/usa\/california\/santa-barbara\/perfect-day\/index\.md\)/);
  assert.doesNotMatch(txt, /layover/i);
  const full = renderLlmsFull(items(), { config });
  assert.ok(full.includes('# Pisa in one walk') && full.includes('# A perfect day in Santa Barbara'));
  assert.ok(full.includes('\n\n---\n\n'));
});

test('JSON-LD: visible stops only, no ratings, no dates', () => {
  const ld = tripJsonLd(layover(), { config, url: 'http://x/' });
  const data = JSON.parse(ld);
  assert.equal(data['@type'], 'TouristTrip');
  assert.equal(data.itinerary.itemListElement.length, 3);
  assert.ok(!ld.includes('Tourist-trap'));
  assert.doesNotMatch(ld, /rating|captured|created_at|updated_at|\d{4}-\d\d-\d\d/i);
  const t = pisa();
  t.title = '</script><b>';
  const page = renderTripPage(t, { config, assets: { css: 'a', js: 'b' }, path: '/x/', version: '0' });
  assert.ok(!page.includes('</script><b>'));
});
