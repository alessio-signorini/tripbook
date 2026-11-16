import { newSection, newStop, newTrip } from '../../shared/schema.js';
import { slugify } from '../../shared/slug.js';
import { autofillLocation } from './editing.js';

const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD in the device's local time zone. */
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** ISO 8601 with the device's UTC offset, e.g. 2026-03-14T17:12:00-07:00. */
export function isoWithOffset(now = new Date()) {
  const off = -now.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${localDate(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Section a captured stop should go into; creates it when needed. Mutates trip. */
export function sectionForCapture(trip, now = new Date()) {
  if (trip.kind === 'guide') {
    const last = trip.sections[trip.sections.length - 1];
    if (last) return last;
    const section = newSection({ title: '', style: 'route' });
    trip.sections.push(section);
    return section;
  }
  const today = localDate(now);
  const existing = trip.sections.find((s) => s.auto_date === today);
  if (existing) return existing;
  const n = trip.sections.filter((s) => s.auto_date).length + 1;
  const section = newSection({ title: `Day ${n}`, style: 'list', auto_date: today });
  trip.sections.push(section);
  return section;
}

/**
 * Add a stop to a trip (mutates). `sectionId` forces the section (Add stop from a section);
 * otherwise the placement rules apply. Returns the new stop.
 */
export function addCapturedStop(trip, fields, { sectionId = null, now = new Date() } = {}) {
  const section = (sectionId && trip.sections.find((s) => s.id === sectionId)) || sectionForCapture(trip, now);
  const { type, distance, ...rest } = fields;
  const stop = newStop({ ...rest, captured_at: isoWithOffset(now) });
  section.stops.push(stop);
  autofillLocation(trip);
  return stop;
}

/** A new log trip titled with the city of the first result. */
export function newCaptureTrip(fields, config) {
  const title = fields.city ? `${fields.city} trip` : 'New trip';
  return newTrip({ title, slug: slugify(title), kind: 'log' }, config);
}
