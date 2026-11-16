import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, isoWithOffset, sectionForCapture, addCapturedStop, newCaptureTrip } from '../src/editor/core/capture.js';
import { mapPlace, mapGeocode, fromComponents, distanceM, parseCoordinates } from '../src/editor/core/places.js';
import { newTrip, validateTrip, DEFAULT_CONFIG } from '../src/shared/schema.js';

const fields = (name) => ({ name, lat: 34.41, lng: -119.68, place_id: 'abc', coords_source: 'place', city: 'Santa Barbara', country: 'United States', country_code: 'US', region: 'California', type: 'Beach', distance: 12 });

test('log: creates Day 1 for today, reuses it, creates Day 2 the next day', () => {
  const trip = newTrip({ kind: 'log' });
  const morning = new Date(2026, 2, 14, 9, 30);
  addCapturedStop(trip, fields('A'), { now: morning });
  addCapturedStop(trip, fields('B'), { now: new Date(2026, 2, 14, 18, 0) });
  assert.equal(trip.sections.length, 1);
  assert.deepEqual([trip.sections[0].title, trip.sections[0].style, trip.sections[0].auto_date], ['Day 1', 'list', '2026-03-14']);
  assert.equal(trip.sections[0].stops.length, 2);
  addCapturedStop(trip, fields('C'), { now: new Date(2026, 2, 15, 10, 0) });
  assert.deepEqual(trip.sections.map((s) => s.title), ['Day 1', 'Day 2']);
});

test('log: date boundary is local midnight', () => {
  const trip = newTrip({ kind: 'log' });
  addCapturedStop(trip, fields('late'), { now: new Date(2026, 2, 14, 23, 59, 59) });
  addCapturedStop(trip, fields('early'), { now: new Date(2026, 2, 15, 0, 0, 0) });
  assert.deepEqual(trip.sections.map((s) => s.auto_date), ['2026-03-14', '2026-03-15']);
  assert.equal(localDate(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('log: N counts sections that have an auto_date, ignoring manual ones', () => {
  const trip = newTrip({ kind: 'log', sections: [{ id: 's-x', title: 'Manual', note: '', style: 'list', auto_date: null, stops: [] }] });
  const s = sectionForCapture(trip, new Date(2026, 2, 14, 12));
  assert.equal(s.title, 'Day 1');
});

test('guide: appends to the last section, creating a route section when empty', () => {
  const trip = newTrip({ kind: 'guide' });
  addCapturedStop(trip, fields('A'));
  assert.deepEqual([trip.sections.length, trip.sections[0].style, trip.sections[0].title], [1, 'route', '']);
  trip.sections.push({ id: 's-2', title: 'Two', note: '', style: 'list', auto_date: null, stops: [] });
  addCapturedStop(trip, fields('B'));
  assert.equal(trip.sections[1].stops.length, 1);
  assert.equal(trip.sections[0].stops.length, 1);
});

test('explicit section wins; display-only fields are dropped; stop validates; location filled', () => {
  const trip = newTrip({ kind: 'log', title: 'T', slug: 't', sections: [{ id: 's-1', title: 'Pinned', note: '', style: 'list', auto_date: null, stops: [] }] });
  const stop = addCapturedStop(trip, fields('A'), { sectionId: 's-1', now: new Date(2026, 2, 14, 12) });
  assert.equal(trip.sections.length, 1);
  assert.ok(!('type' in stop) && !('distance' in stop));
  assert.match(stop.captured_at, /^2026-03-14T12:00:00[+-]\d\d:\d\d$/);
  assert.equal(trip.location.country, 'United States');
  assert.deepEqual(validateTrip(trip, `${trip.id}.json`), []);
});

test('isoWithOffset parses back to the same instant', () => {
  const d = new Date(2026, 2, 14, 17, 12, 5);
  assert.equal(Date.parse(isoWithOffset(d)), d.getTime());
});

test('new capture trip is a log titled with the first result city', () => {
  const t = newCaptureTrip(fields('A'), DEFAULT_CONFIG);
  assert.deepEqual([t.kind, t.title, t.slug], ['log', 'Santa Barbara trip', 'santa-barbara-trip']);
  assert.equal(newCaptureTrip({}, DEFAULT_CONFIG).title, 'New trip');
});

test('places: component mapping and place/geocode conversion', () => {
  const comps = [
    { long: 'Pisa', short: 'Pisa', types: ['locality'] },
    { long: 'Toscana', short: 'TOS', types: ['administrative_area_level_1'] },
    { long: 'Italy', short: 'IT', types: ['country'] },
  ];
  assert.deepEqual(fromComponents(comps), { city: 'Pisa', region: 'Toscana', country: 'Italy', country_code: 'IT' });
  assert.equal(fromComponents([{ long: 'Cambridge', short: 'C', types: ['postal_town'] }]).city, 'Cambridge');
  const place = mapPlace({
    id: 'p1', displayName: 'Torre', formattedAddress: 'Piazza, Pisa', location: { lat: () => 43.72299999, lng: () => 10.39581 },
    addressComponents: comps.map((c) => ({ longText: c.long, shortText: c.short, types: c.types })), primaryTypeDisplayName: 'Tower',
  });
  assert.deepEqual([place.place_id, place.name, place.lat, place.lng, place.coords_source, place.country_code], ['p1', 'Torre', 43.723, 10.39581, 'place', 'IT']);
  const pin = mapGeocode({ formatted_address: '1 Main St, Pisa, Italy', address_components: comps.map((c) => ({ long_name: c.long, short_name: c.short, types: c.types })) }, { lat: 1, lng: 2 });
  assert.deepEqual([pin.place_id, pin.name, pin.coords_source, pin.city], [null, '1 Main St', 'device', 'Pisa']);
  assert.equal(mapGeocode(undefined, { lat: 1, lng: 2 }).name, 'Dropped pin');
  assert.ok(Math.abs(distanceM({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 }) - 111) <= 1);
});

test('parseCoordinates accepts pasted lat/lng and rejects place names', () => {
  assert.deepEqual(parseCoordinates('43.71107480209192, 10.399405060170876'), { lat: 43.71107480209192, lng: 10.399405060170876 });
  assert.deepEqual(parseCoordinates('(43.7, -10.4)'), { lat: 43.7, lng: -10.4 });
  assert.deepEqual(parseCoordinates('43.7 10.4'), { lat: 43.7, lng: 10.4 });
  assert.equal(parseCoordinates('91, 10'), null);
  assert.equal(parseCoordinates('Via Santa Maria 12'), null);
  assert.equal(parseCoordinates('12'), null);
  assert.equal(mapGeocode(undefined, { lat: 1, lng: 2 }, 'pin').coords_source, 'pin');
});
