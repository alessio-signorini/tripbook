import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTrip, newTrip, newSection, newStop } from '../src/shared/schema.js';
import { pisa, sb, layover } from './fixtures.js';

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
  bad((t) => (t.sections[0].stops[0].off_route = 'yes'), /off_route/);
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

test('schema: photo is optional but must use https urls', () => {
  const t = newTrip({ id: 'a', slug: 'a', title: 'A', location: { country: 'X', country_code: '', region: '', city: '' } });
  assert.deepEqual(validateTrip(t, 'a.json'), []);
  assert.deepEqual(validateTrip({ ...t, photo: { url: 'https://x/y.jpg' } }, 'a.json'), []);
  assert.match(validateTrip({ ...t, photo: { url: 'javascript:alert(1)' } }, 'a.json')[0], /photo/);
});
