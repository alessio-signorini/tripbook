import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { slugify } from '../src/shared/slug.js';
import { tripPath, listingPrefixes, findCollisions } from '../src/shared/paths.js';
import { validateTrip, newTrip, newSection, newStop, DEFAULT_CONFIG } from '../src/shared/schema.js';
import { directionsUrl, shortlistUrl, stopDirectionsUrl, openInMaps } from '../src/shared/maps-links.js';
import { renderMarkdown } from '../src/shared/markdown.js';
import { renderStars, renderStarCompact, isLow } from '../src/shared/rating.js';
import { visibleStops } from '../src/shared/visible.js';
import { formatMinutes, sectionLetter, shortAddress } from '../src/shared/format.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../examples/data/${p}`, import.meta.url), 'utf8'));
const pisa = () => load('published/pisa-in-one-walk.json');
const sb = () => load('published/santa-barbara-perfect-day.json');
const layover = () => load('drafts/pisa-4-hours-layover.json');
const config = DEFAULT_CONFIG;

test('slugify', () => {
  assert.equal(slugify('Città'), 'citta');
  assert.equal(slugify('  Hello, World!  '), 'hello-world');
  assert.equal(slugify('--a  b--'), 'a-b');
  assert.equal(slugify(''), '');
});

test('paths', () => {
  assert.equal(tripPath(pisa(), config), '/italy/pisa/pisa-in-one-walk/');
  assert.equal(tripPath(sb(), config), '/usa/california/santa-barbara/perfect-day/');
  assert.equal(tripPath(layover(), config, { draft: true }), '/drafts/italy/pisa/4-hours-layover/');
  const t = pisa();
  t.location.city = '';
  assert.equal(tripPath(t, config), '/italy/pisa-in-one-walk/');
  t.location.country_code = 'GB';
  t.location.country = 'United Kingdom';
  assert.equal(tripPath(t, { country_slugs: { GB: 'britain' } }), '/britain/pisa-in-one-walk/');
  assert.deepEqual(listingPrefixes(sb(), config), ['/usa/', '/usa/california/', '/usa/california/santa-barbara/']);
  assert.deepEqual(listingPrefixes(pisa(), config), ['/italy/', '/italy/pisa/']);
  assert.equal(findCollisions([{ file: 'a.json', path: '/x/' }, { file: 'b.json', path: '/x/' }]).length, 1);
  assert.match(findCollisions([{ file: 'a.json', path: '/x/' }, { file: 'b.json', path: '/x/' }])[0], /a\.json.*b\.json|b\.json.*a\.json/);
});

test('schema: examples are valid', () => {
  assert.deepEqual(validateTrip(pisa(), 'pisa-in-one-walk.json'), []);
  assert.deepEqual(validateTrip(sb(), 'santa-barbara-perfect-day.json'), []);
  assert.deepEqual(validateTrip(layover(), 'pisa-4-hours-layover.json'), []);
});

test('schema: rules fail readably', () => {
  const bad = (mutate, re) => {
    const t = pisa();
    mutate(t);
    const errors = validateTrip(t, 'pisa-in-one-walk.json');
    assert.ok(errors.some((e) => re.test(e)), `${re} not in ${JSON.stringify(errors)}`);
  };
  bad((t) => (t.id = 'other'), /file name/);
  bad((t) => (t.slug = 'Bad Slug'), /slug/);
  bad((t) => (t.kind = 'trip'), /kind/);
  bad((t) => (t.title = ' '), /title/);
  bad((t) => (t.location.country_code = 'it'), /country_code/);
  bad((t) => (t.old_paths = ['nope']), /old_paths/);
  bad((t) => (t.sections[0].style = 'grid'), /style/);
  bad((t) => (t.sections[0].auto_date = '15/11/2026'), /auto_date/);
  bad((t) => (t.sections[0].stops[1].id = 'p-1'), /used twice/);
  bad((t) => (t.sections[0].stops[0].lat = 91), /lat/);
  bad((t) => (t.sections[0].stops[0].lng = -181), /lng/);
  bad((t) => (t.sections[0].stops[0].rating = 6), /rating/);
  bad((t) => (t.sections[0].stops[0].minutes = 0), /minutes/);
  bad((t) => (t.sections[0].stops[0].coords_source = 'gps'), /coords_source/);
  bad((t) => (t.sections[0].stops[0].captured_at = 'yesterday'), /captured_at/);
});

test('schema: unknown fields allowed; newer version rejected with exact message', () => {
  const t = pisa();
  t.extra = { a: 1 };
  t.sections[0].stops[0].extra = true;
  assert.deepEqual(validateTrip(t, 'pisa-in-one-walk.json'), []);
  t.v = 2;
  assert.deepEqual(validateTrip(t, 'pisa-in-one-walk.json'), [
    'pisa-in-one-walk.json: uses schema v2, this tripbook release supports v1. Run scripts/release.sh to update the site build.',
  ]);
});

test('schema: factories produce stops and sections that validate', () => {
  const trip = newTrip({ title: 'T', slug: 't', location: { country: 'Italy', country_code: 'IT', region: '', city: '' } });
  const section = newSection({ style: 'route' });
  section.stops.push(newStop({ name: 'X', lat: 1, lng: 2 }));
  trip.sections.push(section);
  assert.deepEqual(validateTrip(trip, `${trip.id}.json`), []);
});

const stop = (lat, lng, place_id = null) => ({ lat, lng, place_id });

test('maps-links: shortlist', () => {
  assert.equal(shortlistUrl([stop(1, 1)]), null);
  const stops = Array.from({ length: 25 }, (_, i) => stop(i, i, `id${i}`));
  const url = shortlistUrl(stops);
  const ids = new URL(url).searchParams.get('place_ids').split(',');
  assert.equal(ids.length, 20);
  assert.equal(ids[0], 'id0');
  assert.equal(ids[19], 'id19');
  assert.match(shortlistUrl([stop(1, 1, 'a'), stop(2, 2), stop(3, 3, 'b')]), /place_ids=a,b$/);
});

test('maps-links: directions', () => {
  assert.equal(directionsUrl([stop(1, 1)]), null);
  const two = directionsUrl([stop(1, 2), stop(3, 4)]);
  assert.match(two, /origin=1,2&destination=3,4&travelmode=walking/);
  assert.doesNotMatch(two, /waypoints/);

  const eleven = Array.from({ length: 11 }, (_, i) => stop(i, i));
  const one = directionsUrl(eleven);
  assert.equal(typeof one, 'string');
  assert.equal(decodeURIComponent(new URL(one).searchParams.get('waypoints')).split('|').length, 9);

  const twelve = Array.from({ length: 12 }, (_, i) => stop(i, i));
  const parts = directionsUrl(twelve);
  assert.equal(parts.length, 2);
  assert.match(parts[0], /destination=10,10/);
  assert.match(parts[1], /origin=10,10&destination=11,11/);

  const withIds = directionsUrl([stop(1, 1, 'a'), stop(2, 2, 'b'), stop(3, 3, 'c')]);
  assert.match(withIds, /origin_place_id=a&destination_place_id=c&waypoint_place_ids=b/);
  const partial = directionsUrl([stop(1, 1, 'a'), stop(2, 2), stop(3, 3, 'c')]);
  assert.doesNotMatch(partial, /place_id/);
});

test('maps-links: 2048 char cap drops place ids', () => {
  const long = 'P'.repeat(200);
  const stops = Array.from({ length: 11 }, (_, i) => stop(i + 0.123456, i + 0.654321, long + i));
  const url = directionsUrl(stops);
  assert.ok(url.length <= 2048);
  assert.doesNotMatch(url, /place_id/);
});

test('maps-links: stop directions and open-in-maps choice', () => {
  assert.match(stopDirectionsUrl(stop(1, 2, 'x')), /destination=1,2&travelmode=walking&destination_place_id=x/);
  assert.doesNotMatch(stopDirectionsUrl(stop(1, 2)), /place_id/);
  const mostly = [stop(1, 1, 'a'), stop(2, 2, 'b'), stop(3, 3)];
  assert.match(openInMaps(mostly).url, /shortlist/);
  const few = [stop(1, 1, 'a'), stop(2, 2), stop(3, 3)];
  assert.match(openInMaps(few).url, /\/dir\//);
  assert.equal(openInMaps([]).url, null);
});

test('markdown', () => {
  assert.match(renderMarkdown('see [x](https://a.com)'), /<a href="https:\/\/a\.com" rel="noopener">x<\/a>/);
  assert.match(renderMarkdown('**b** and *i*'), /<strong>b<\/strong> and <em>i<\/em>/);
  assert.match(renderMarkdown('- a\n- b'), /<ul>\s*<li>a<\/li>\s*<li>b<\/li>\s*<\/ul>/);
  const xss = renderMarkdown('<script>alert(1)</script>');
  assert.doesNotMatch(xss, /<script/);
  assert.match(xss, /&lt;script&gt;/);
  assert.doesNotMatch(renderMarkdown('[x](javascript:alert(1))'), /javascript:/);
  assert.equal(renderMarkdown(''), '');
});

test('rating', () => {
  const five = renderStars(4);
  assert.equal((five.match(/<svg/g) || []).length, 5);
  assert.equal((five.match(/#C2410C/g) || []).length, 4);
  assert.equal((five.match(/#D3D6D0/g) || []).length, 1);
  assert.match(five, /role="img" aria-label="Rated 4 out of 5"/);
  const c1 = renderStarCompact(4);
  const c2 = renderStarCompact(4);
  assert.equal((c1.match(/offset="80%"/g) || []).length, 2);
  assert.match(c1, /\(4\/5\)/);
  assert.match(c1, /aria-label="Rated 4 out of 5"/);
  assert.notEqual(c1.match(/id="([^"]+)"/)[1], c2.match(/id="([^"]+)"/)[1]);
  assert.equal(renderStars(null), '');
  assert.equal(renderStarCompact(null), '');
  assert.deepEqual([1, 2, 3, 5, null].map((rating) => isLow({ rating })), [true, true, false, false, false]);
});

test('format', () => {
  assert.equal(formatMinutes(20), '20 min');
  assert.equal(formatMinutes(90), '1 h 30 min');
  assert.equal(formatMinutes(120), '2 h');
  assert.equal(formatMinutes(null), '');
  assert.deepEqual([0, 1, 25, 26].map(sectionLetter), ['A', 'B', 'Z', 'AA']);
});

test('visible: guide hides low stops and numbers without gaps', () => {
  const [s] = visibleStops(layover());
  assert.deepEqual(s.stops.map((x) => x.visible), [true, true, false, true]);
  assert.deepEqual(s.stops.map((x) => x.label), ['1', '2', '', '3']);
  assert.equal(s.count, 3);
  assert.equal(s.minutes, 110);
});

test('visible: showLow includes and renumbers', () => {
  const [s] = visibleStops(layover(), { showLow: true });
  assert.deepEqual(s.stops.map((x) => x.label), ['1', '2', '3', '4']);
  assert.equal(s.count, 4);
  assert.equal(s.minutes, 130);
});

test('visible: logs show low stops by default; multi-section labels', () => {
  const [a, b] = visibleStops(sb());
  assert.deepEqual(a.stops.map((x) => x.label), ['A1', 'A2']);
  assert.deepEqual(b.stops.map((x) => x.label), ['B1', 'B2']);
  assert.equal(b.minutes, 45);
  const [, b2] = visibleStops(sb(), { showLow: false });
  assert.deepEqual(b2.stops.map((x) => x.label), ['B1', '']);
  assert.equal(b2.count, 1);
});

test('visible: unrated stops are never hidden', () => {
  const [s] = visibleStops(pisa(), { showLow: false });
  assert.equal(s.count, 7);
});

test('shortAddress drops city, region, country and postal parts', () => {
  const stop = (address, extra = {}) => ({ address, city: 'Santa Barbara', region: 'California', country: 'United States', country_code: 'US', ...extra });
  assert.equal(shortAddress(stop('1100 Anacapa St, Santa Barbara, CA')), '1100 Anacapa St');
  assert.equal(shortAddress(stop('1 Main St, Santa Barbara, CA 93101, USA', { country_code: 'USA' })), '1 Main St');
  assert.equal(shortAddress(stop('Piazza della Stazione, Pisa', { city: 'Pisa' })), 'Piazza della Stazione');
  assert.equal(shortAddress(stop('Santa Barbara')), 'Santa Barbara');
  assert.equal(shortAddress(stop('')), '');
});

test('validateTrip: photo is optional but must use https urls', async () => {
  const { validateTrip, newTrip } = await import('../src/shared/schema.js');
  const t = newTrip({ id: 'a', slug: 'a', title: 'A', location: { country: 'X', country_code: '', region: '', city: '' } });
  assert.deepEqual(validateTrip(t, 'a.json'), []);
  assert.deepEqual(validateTrip({ ...t, photo: { url: 'https://x/y.jpg' } }, 'a.json'), []);
  assert.match(validateTrip({ ...t, photo: { url: 'javascript:alert(1)' } }, 'a.json')[0], /photo/);
});
