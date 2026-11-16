import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleStops } from '../src/shared/visible.js';
import { pisa, sb, sbRoutes, layover } from './fixtures.js';

test('guide hides low stops and numbers without gaps', () => {
  const [s] = visibleStops(layover());
  assert.deepEqual(s.stops.map((x) => x.visible), [true, true, false, true]);
  assert.deepEqual(s.stops.map((x) => x.label), ['1', '2', '', '3']);
  assert.equal(s.count, 3);
  assert.equal(s.minutes, 110);
});

test('showLow includes and renumbers', () => {
  const [s] = visibleStops(layover(), { showLow: true });
  assert.deepEqual(s.stops.map((x) => x.label), ['1', '2', '3', '4']);
  assert.equal(s.count, 4);
  assert.equal(s.minutes, 130);
});

test('logs show low stops by default; multi-section labels', () => {
  const [a, b] = visibleStops(sbRoutes());
  assert.deepEqual(a.stops.map((x) => x.label), ['A1', 'A2']);
  assert.deepEqual(b.stops.map((x) => x.label), ['B1', 'B2']);
  assert.equal(b.minutes, 45);
  const [, b2] = visibleStops(sbRoutes(), { showLow: false });
  assert.deepEqual(b2.stops.map((x) => x.label), ['B1', '']);
  assert.equal(b2.count, 1);
});

test('unrated stops are never hidden', () => {
  const [s] = visibleStops(pisa(), { showLow: false });
  assert.equal(s.count, 8);
});

test('off_route: no number, kept out of routeStops, list sections are all off-route', () => {
  const t = pisa();
  t.sections[0].stops.forEach((p) => delete p.off_route);
  t.sections[0].stops[2].off_route = true; // Corso Italia
  const [s] = visibleStops(t);
  assert.deepEqual(s.stops.map((x) => x.label), ['1', '2', 'A', '3', '4', '5', '6', '7']);
  assert.equal(s.stops[2].offRoute, true);
  assert.equal(s.count, 8);
  assert.equal(s.routeStops.length, 7);
  assert.ok(!s.routeStops.some((p) => p.name === 'Corso Italia'));
  t.sections[0].stops[5].off_route = true; // Pasticceria Salza
  assert.deepEqual(visibleStops(t)[0].stops.filter((x) => x.offRoute).map((x) => x.label), ['A', 'B']);
  const [h] = visibleStops(t, { showOffRoute: false });
  assert.equal(h.count, 6);
  assert.deepEqual(h.stops.filter((x) => x.offRoute).map((x) => x.visible), [false, false]);
  t.sections[0].style = 'list';
  const [l] = visibleStops(t);
  assert.deepEqual(l.stops.map((x) => x.label), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  assert.equal(l.routeStops.length, 0);
});

test('section letters only when several route sections; list sections are lettered off-route', () => {
  const t = pisa();
  const food = structuredClone(sbRoutes().sections[0]);
  food.style = 'list';
  food.id = 'food';
  t.sections.push(food);
  const [r, f] = visibleStops(t);
  assert.equal(r.letter, '');
  assert.equal(r.stops[0].label, '1');
  assert.equal(f.letter, '');
  assert.ok(f.stops.every((x) => x.offRoute && /^[A-Z]+$/.test(x.label)));
  const two = sbRoutes();
  assert.deepEqual(visibleStops(two).map((x) => x.letter), ['A', 'B']);
});

test('only keeps labels but hides other sections', () => {
  const [a, b] = visibleStops(sbRoutes(), { only: 's-2' });
  assert.equal(a.count, 0);
  assert.deepEqual(b.stops.map((x) => x.label), ['B1', 'B2']);
});
