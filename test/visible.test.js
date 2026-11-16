import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleStops } from '../src/shared/visible.js';
import { pisa, sb, layover } from './fixtures.js';

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
  const [a, b] = visibleStops(sb());
  assert.deepEqual(a.stops.map((x) => x.label), ['A1', 'A2']);
  assert.deepEqual(b.stops.map((x) => x.label), ['B1', 'B2']);
  assert.equal(b.minutes, 45);
  const [, b2] = visibleStops(sb(), { showLow: false });
  assert.deepEqual(b2.stops.map((x) => x.label), ['B1', '']);
  assert.equal(b2.count, 1);
});

test('unrated stops are never hidden', () => {
  const [s] = visibleStops(pisa(), { showLow: false });
  assert.equal(s.count, 8);
});

test('off_route: no number, kept out of routeStops, ignored in list sections', () => {
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
  assert.deepEqual(l.stops.map((x) => x.label), ['1', '2', '3', '4', '5', '6', '7', '8']);
  assert.equal(l.routeStops.length, 8);
});
