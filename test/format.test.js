import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMinutes, sectionLetter, shortAddress } from '../src/shared/format.js';
import { renderMarkdown } from '../src/shared/markdown.js';
import { renderStarCompact, isLow } from '../src/shared/rating.js';

test('format', () => {
  assert.equal(formatMinutes(20), '20 min');
  assert.equal(formatMinutes(90), '1 h 30 min');
  assert.equal(formatMinutes(120), '2 h');
  assert.equal(formatMinutes(null), '');
  assert.deepEqual([0, 1, 25, 26].map(sectionLetter), ['A', 'B', 'Z', 'AA']);
});

test('shortAddress drops city, region, country and postal parts', () => {
  const stop = (address, extra = {}) => ({ address, city: 'Santa Barbara', region: 'California', country: 'United States', country_code: 'US', ...extra });
  assert.equal(shortAddress(stop('1100 Anacapa St, Santa Barbara, CA')), '1100 Anacapa St');
  assert.equal(shortAddress(stop('1 Main St, Santa Barbara, CA 93101, USA', { country_code: 'USA' })), '1 Main St');
  assert.equal(shortAddress(stop('Piazza della Stazione, Pisa', { city: 'Pisa' })), 'Piazza della Stazione');
  assert.equal(shortAddress(stop('Santa Barbara')), 'Santa Barbara');
  assert.equal(shortAddress(stop('')), '');
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

test('rating: compact star is deterministic, clipped to rating/5, without ids or inline styles', () => {
  const c = renderStarCompact(4);
  assert.equal(c, renderStarCompact(4));
  assert.match(c, /<svg width="12\.8" height="16" viewBox="0 0 12\.8 16">/);
  assert.match(c, /\(4\/5\)/);
  assert.match(c, /role="img" aria-label="Rated 4 out of 5"/);
  assert.doesNotMatch(c, / id=| style=/);
  assert.equal(renderStarCompact(null), '');
  assert.deepEqual([1, 2, 3, 5, null].map((rating) => isLow({ rating })), [true, true, false, false, false]);
});
