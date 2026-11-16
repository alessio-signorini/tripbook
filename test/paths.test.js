import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/shared/slug.js';
import { tripPath, listingPrefixes, findCollisions } from '../src/shared/paths.js';
import { DEFAULT_CONFIG as config } from '../src/shared/schema.js';
import { pisa, sb, layover } from './fixtures.js';

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
