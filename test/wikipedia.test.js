import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findWikipediaPhoto } from '../src/shared/wikipedia.js';

const json = (data) => ({ ok: true, json: async () => data });

test('findWikipediaPhoto combines image and licence info', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('commons.wikimedia.org')) {
      return json({ query: { pages: { 1: { imageinfo: [{ extmetadata: {
        Artist: { value: '<a href="//x">Jane Doe</a>' },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
      } }] } } } });
    }
    const size = url.includes('pithumbsize=1200') ? 1200 : 240;
    return json({ query: { pages: { 9: { title: 'Pisa', pageimage: 'Pisa.jpg', thumbnail: { source: `https://u/${size}.jpg` } } } } });
  };
  const photo = await findWikipediaPhoto('Pisa', fetchImpl);
  assert.equal(photo.url, 'https://u/1200.jpg');
  assert.equal(photo.thumb, 'https://u/240.jpg');
  assert.equal(photo.author, 'Jane Doe');
  assert.equal(photo.license, 'CC BY-SA 4.0');
  assert.ok(calls.every((u) => u.includes('origin=*')));
});

test('findWikipediaPhoto returns null when the article has no image', async () => {
  const fetchImpl = async () => json({ query: { pages: { 9: { title: 'X' } } } });
  assert.equal(await findWikipediaPhoto('X', fetchImpl), null);
  assert.equal(await findWikipediaPhoto('  ', fetchImpl), null);
});
