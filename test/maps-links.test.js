import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionsUrl, routeLinks, stopDirectionsUrl, openInMaps } from '../src/shared/maps-links.js';

const stop = (lat, lng, place_id = null) => ({ lat, lng, place_id });

test('directions: always an array; split into parts of 11 stops sharing a boundary stop', () => {
  assert.deepEqual(directionsUrl([stop(1, 1)]), []);
  const [two, ...rest] = directionsUrl([stop(1, 2), stop(3, 4)]);
  assert.equal(rest.length, 0);
  assert.match(two, /origin=1,2&destination=3,4&travelmode=walking/);
  assert.doesNotMatch(two, /waypoints/);

  const eleven = directionsUrl(Array.from({ length: 11 }, (_, i) => stop(i, i)));
  assert.equal(eleven.length, 1);
  assert.equal(decodeURIComponent(new URL(eleven[0]).searchParams.get('waypoints')).split('|').length, 9);

  const parts = directionsUrl(Array.from({ length: 12 }, (_, i) => stop(i, i)));
  assert.equal(parts.length, 2);
  assert.match(parts[0], /destination=10,10/);
  assert.match(parts[1], /origin=10,10&destination=11,11/);

  const [withIds] = directionsUrl([stop(1, 1, 'a'), stop(2, 2, 'b'), stop(3, 3, 'c')]);
  assert.match(withIds, /origin_place_id=a&destination_place_id=c&waypoint_place_ids=b/);
  const [partial] = directionsUrl([stop(1, 1, 'a'), stop(2, 2), stop(3, 3, 'c')]);
  assert.doesNotMatch(partial, /place_id/);
});

test('directions: 2048 char cap drops place ids', () => {
  const long = 'P'.repeat(200);
  const [url] = directionsUrl(Array.from({ length: 11 }, (_, i) => stop(i + 0.123456, i + 0.654321, long + i)));
  assert.ok(url.length <= 2048);
  assert.doesNotMatch(url, /place_id/);
});

test('routeLinks: one "Route in Google Maps" link, or "Part N" links when split', () => {
  assert.deepEqual(routeLinks([stop(1, 1)]), []);
  assert.deepEqual(routeLinks([stop(1, 1), stop(2, 2)]).map((l) => l.label), ['Route in Google Maps']);
  assert.deepEqual(routeLinks(Array.from({ length: 12 }, (_, i) => stop(i, i))).map((l) => l.label), ['Part 1', 'Part 2']);
});

test('stop directions and open-in-maps choice', () => {
  assert.match(stopDirectionsUrl(stop(1, 2, 'x')), /destination=1,2&travelmode=walking&destination_place_id=x/);
  assert.doesNotMatch(stopDirectionsUrl(stop(1, 2)), /place_id/);
  assert.match(openInMaps([stop(1, 1, 'a'), stop(2, 2, 'b')]).url, /\/dir\/.*origin=1,1&destination=2,2/);
  assert.match(openInMaps([stop(1, 1, 'a'), stop(2, 2), stop(3, 3)]).url, /\/dir\//);
  assert.match(openInMaps([stop(5, 6)]).url, /\/dir\/.*destination=5,6/);
  assert.equal(openInMaps([]).url, null);
  const url = openInMaps([stop(1, 1), stop(3, 3)]).url;
  assert.match(url, /origin=1,1&destination=3,3/);
  assert.doesNotMatch(url, /2,2/);
});
