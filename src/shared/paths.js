import { slugify } from './slug.js';
import { DEFAULT_CONFIG } from './schema.js';

function segments(trip, config) {
  const slugs = (config && config.country_slugs) || DEFAULT_CONFIG.country_slugs;
  const loc = trip.location || {};
  const country = slugs[loc.country_code] || slugify(loc.country);
  return [country, slugify(loc.region), slugify(loc.city)].filter(Boolean);
}

export function tripPath(trip, config, { draft = false } = {}) {
  const path = '/' + [...segments(trip, config), trip.slug].join('/') + '/';
  return draft ? '/drafts' + path : path;
}

/** Listing pages above a trip: /italy/, /italy/pisa/, ... (never the trip itself). */
export function listingPrefixes(trip, config) {
  const segs = segments(trip, config);
  const out = [];
  for (let i = 1; i <= segs.length; i++) out.push('/' + segs.slice(0, i).join('/') + '/');
  return out;
}

/** items: [{ file, path }]. Returns one error string per colliding pair. */
export function findCollisions(items) {
  const seen = new Map();
  const errors = [];
  for (const { file, path } of items) {
    if (seen.has(path)) errors.push(`${file} and ${seen.get(path)} both resolve to ${path}`);
    else seen.set(path, file);
  }
  return errors;
}
