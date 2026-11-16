import { slugify } from '../../shared/slug.js';
import { newSection, newStop } from '../../shared/schema.js';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Set the title; the slug follows the title until the user edits the slug. */
export function setTitle(trip, title) {
  if (!trip.slug || trip.slug === slugify(trip.title)) trip.slug = slugify(title);
  trip.title = title;
}

export function findStop(trip, stopId) {
  for (const section of trip.sections) {
    const index = section.stops.findIndex((s) => s.id === stopId);
    if (index > -1) return { section, index, stop: section.stops[index] };
  }
  return null;
}

export function addSection(trip, fields = {}) {
  const section = newSection({ style: trip.kind === 'guide' ? 'route' : 'list', ...fields });
  trip.sections.push(section);
  return section;
}

export function deleteSection(trip, sectionId) {
  trip.sections = trip.sections.filter((s) => s.id !== sectionId);
}

export function moveSection(trip, sectionId, newIndex) {
  const from = trip.sections.findIndex((s) => s.id === sectionId);
  if (from < 0) return;
  const [section] = trip.sections.splice(from, 1);
  trip.sections.splice(Math.max(0, Math.min(newIndex, trip.sections.length)), 0, section);
}

/** Move a stop to `index` within `toSectionId`; `index: Infinity` puts it last. */
export function moveStop(trip, stopId, toSectionId, index) {
  const found = findStop(trip, stopId);
  const to = trip.sections.find((s) => s.id === toSectionId);
  if (!found || !to) return;
  found.section.stops.splice(found.index, 1);
  to.stops.splice(Math.max(0, Math.min(index, to.stops.length)), 0, found.stop);
}

export function deleteStop(trip, stopId) {
  const found = findStop(trip, stopId);
  if (found) found.section.stops.splice(found.index, 1);
}

/** Fill the trip location from the first stop when the trip has none yet. */
export function autofillLocation(trip) {
  const loc = trip.location;
  if (loc.country) return;
  const first = trip.sections.flatMap((s) => s.stops).find((s) => s.country);
  if (!first) return;
  loc.country = first.country;
  loc.country_code = first.country_code || '';
  if (!loc.region) loc.region = first.region || '';
  if (!loc.city) loc.city = first.city || '';
}

/** A new draft guide copied from a log. Returns a new trip object. */
export function makeGuide(log) {
  const trip = structuredClone(log);
  trip.id = crypto.randomUUID();
  trip.kind = 'guide';
  trip.title = `Guide: ${log.title}`;
  trip.slug = slugify(trip.title);
  trip.old_paths = [];
  trip.created_at = trip.updated_at = nowIso();
  for (const section of trip.sections) {
    section.auto_date = null;
    for (const stop of section.stops) stop.captured_at = null;
  }
  return trip;
}

const isObject = (v) => v !== null && typeof v === 'object';

/**
 * Structural sharing for immutable updates: returns `next`, but with every sub-object that is
 * deep-equal to its counterpart in `prev` replaced by the `prev` object (so `===` means unchanged).
 * Array items with an `id` are matched by id, so moved sections/stops are reused too.
 */
export function reuseUnchanged(prev, next) {
  if (prev === next || !isObject(prev) || !isObject(next) || Array.isArray(prev) !== Array.isArray(next)) {
    return Object.is(prev, next) ? prev : next;
  }
  if (Array.isArray(next)) {
    const byId = new Map(prev.filter((p) => isObject(p) && p.id != null).map((p) => [p.id, p]));
    const out = next.map((item, i) => reuseUnchanged(isObject(item) && item.id != null ? byId.get(item.id) : prev[i], item));
    return out.length === prev.length && out.every((v, i) => v === prev[i]) ? prev : out;
  }
  const keys = Object.keys(next);
  const out = {};
  let same = keys.length === Object.keys(prev).length;
  for (const k of keys) {
    out[k] = reuseUnchanged(prev[k], next[k]);
    if (!(k in prev) || out[k] !== prev[k]) same = false;
  }
  return same ? prev : out;
}
