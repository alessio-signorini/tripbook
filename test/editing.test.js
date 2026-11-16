import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTitle, moveStop, moveSection, deleteStop, addSection, autofillLocation, makeGuide, reuseUnchanged } from '../src/editor/core/editing.js';
import { validateTrip, newTrip } from '../src/shared/schema.js';
import { visibleStops } from '../src/shared/visible.js';

const sb = () => JSON.parse(readFileSync(new URL('../examples/data/published/santa-barbara-perfect-day.json', import.meta.url), 'utf8'));
const sbRoutes = () => {
  const t = sb();
  t.sections.forEach((s) => (s.style = 'route'));
  return t;
};
const ids = (section) => section.stops.map((s) => s.id);

test('slug follows the title until it is edited', () => {
  const t = newTrip({ title: '', slug: '' });
  setTitle(t, 'Città Vecchia');
  assert.equal(t.slug, 'citta-vecchia');
  setTitle(t, 'Città Vecchia 2');
  assert.equal(t.slug, 'citta-vecchia-2');
  t.slug = 'custom';
  setTitle(t, 'Something else');
  assert.equal(t.slug, 'custom');
});

test('moveStop across sections by index, Top and Bottom', () => {
  const t = sb();
  moveStop(t, 'p-3', 's-1', 1);
  assert.deepEqual(ids(t.sections[0]), ['p-1', 'p-3', 'p-2']);
  assert.deepEqual(ids(t.sections[1]), ['p-4']);
  moveStop(t, 'p-2', 's-2', 0);
  assert.deepEqual(ids(t.sections[1]), ['p-2', 'p-4']);
  moveStop(t, 'p-1', 's-2', Infinity);
  assert.deepEqual(ids(t.sections[1]), ['p-2', 'p-4', 'p-1']);
  assert.deepEqual(validateTrip(t, 'santa-barbara-perfect-day.json'), []);
});

test('pin numbers follow the new order', () => {
  const t = sbRoutes();
  moveStop(t, 'p-4', 's-1', 0);
  const [a] = visibleStops(t);
  assert.equal(a.stops[0].stop.id, 'p-4');
  assert.equal(a.stops[0].label, 'A1');
});

test('moveSection, deleteStop, addSection', () => {
  const t = sb();
  moveSection(t, 's-2', 0);
  assert.deepEqual(t.sections.map((s) => s.id), ['s-2', 's-1']);
  deleteStop(t, 'p-1');
  assert.equal(t.sections[1].stops.length, 1);
  const s = addSection(t);
  assert.equal(s.style, 'list');
  assert.equal(t.sections.length, 3);
});

test('reuseUnchanged keeps identity for unchanged sections and stops, also after a move', () => {
  const prev = sb();
  const edited = structuredClone(prev);
  edited.sections[0].stops[0].note = 'changed';
  const a = reuseUnchanged(prev, edited);
  assert.notEqual(a, prev);
  assert.notEqual(a.sections[0], prev.sections[0]);
  assert.notEqual(a.sections[0].stops[0], prev.sections[0].stops[0]);
  assert.equal(a.sections[0].stops[1], prev.sections[0].stops[1]);
  assert.equal(a.sections[1], prev.sections[1]);
  assert.deepEqual(a, edited);

  const moved = structuredClone(prev);
  moveSection(moved, 's-2', 0);
  const b = reuseUnchanged(prev, moved);
  assert.equal(b.sections[0], prev.sections[1]);
  assert.equal(b.sections[1], prev.sections[0]);

  assert.equal(reuseUnchanged(prev, structuredClone(prev)), prev);
  const flagged = structuredClone(prev);
  flagged.sections[0].stops[0].off_route = undefined;
  assert.notEqual(reuseUnchanged(prev, flagged).sections[0].stops[0], prev.sections[0].stops[0]);
});

test('autofillLocation uses the first stop only when the trip has no country', () => {
  const t = sb();
  t.location = { country: '', country_code: '', region: '', city: '' };
  autofillLocation(t);
  assert.deepEqual(t.location, { country: 'United States', country_code: 'US', region: 'California', city: 'Santa Barbara' });
  t.location.city = 'Elsewhere';
  autofillLocation(t);
  assert.equal(t.location.city, 'Elsewhere');
});

test('makeGuide copies a log into a new draft guide', () => {
  const log = sb();
  const guide = makeGuide(log);
  assert.notEqual(guide.id, log.id);
  assert.equal(guide.kind, 'guide');
  assert.equal(guide.title, 'Guide: A perfect day in Santa Barbara');
  assert.equal(guide.slug, 'guide-a-perfect-day-in-santa-barbara');
  assert.ok(guide.sections.every((s) => s.auto_date === null && s.stops.every((p) => p.captured_at === null)));
  assert.equal(guide.sections.flatMap((s) => s.stops).length, 4);
  assert.deepEqual(guide.sections.map((s) => s.style), ['list', 'list']);
  assert.deepEqual(validateTrip(guide, `${guide.id}.json`), []);
  assert.equal(log.sections[0].auto_date, '2026-03-14');
  const [, b] = visibleStops(guide);
  assert.equal(b.count, 1, 'low-rated Butterfly Beach hidden by default in a guide');
});
