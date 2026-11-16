import { isLow } from './rating.js';
import { sectionLetter, totalMinutes } from './format.js';

/** @typedef {import('./schema.js').Trip} Trip */
/** @typedef {import('./schema.js').Section} Section */
/** @typedef {import('./schema.js').Stop} Stop */
/**
 * @typedef {object} StopEntry
 * @property {Stop} stop
 * @property {boolean} visible
 * @property {boolean} offRoute
 * @property {number} number   1-based among visible on-route stops with the same section prefix; 0 otherwise.
 * @property {string} label    "3", "B2" (section prefix) or "A" (off-route); '' when hidden.
 */
/**
 * @typedef {object} SectionEntry
 * @property {Section} section
 * @property {string} prefix          Label prefix chosen for the section ('' for none).
 * @property {StopEntry[]} stops      Every stop, in order.
 * @property {Stop[]} visibleStops
 * @property {Stop[]} routeStops      Visible and not off-route: the path, legs and route links.
 * @property {number} count           visibleStops.length
 * @property {number} minutes         Total minutes of visible stops.
 */

/**
 * Sections with their stops and number labels.
 * Every stop is returned with `visible`, `offRoute` and `label`; hidden stops get label ''.
 * A stop is off the route when it is flagged `off_route` inside a `route` section: it stays in the
 * list and on the map, is left out of the path, legs and route links, and is labelled with a letter
 * (A, B, C... across the whole trip) instead of a number. Every stop of a `list` section is off-route.
 * Each section may set a `prefix` (e.g. "B" gives B1, B2...). Numbers continue across route sections
 * that share the same prefix (including none), so unprefixed sections number 1..n through the trip.
 * `only` (a section id) hides every other section's stops without changing labels.
 * Returns [{ section, prefix, stops: [{ stop, visible, offRoute, label, number }], visibleStops, routeStops, minutes }]
 * `showOffRoute` (default true) false hides off-route stops entirely.
 * `showLow` defaults to the trip kind: guides hide low-rated stops, logs show them.
 * @param {Trip} trip
 * @param {{ showLow?: boolean, showOffRoute?: boolean, only?: string|null }} [opts]
 * @returns {SectionEntry[]}
 */
export function visibleStops(trip, { showLow = trip.kind === 'log', showOffRoute = true, only = null } = {}) {
  let offCount = 0;
  const counters = new Map();
  return trip.sections.map((section) => {
    const isRoute = section.style === 'route';
    const prefix = isRoute ? section.prefix ?? '' : '';
    const hiddenBySolo = only !== null && section.id !== only;
    const stops = section.stops.map((stop) => {
      const offRoute = !isRoute || stop.off_route === true;
      const wanted = (showLow || !isLow(stop)) && (showOffRoute || !offRoute);
      if (!wanted) return { stop, visible: false, offRoute, number: 0, label: '' };
      const visible = !hiddenBySolo;
      if (offRoute) return { stop, visible, offRoute, number: 0, label: sectionLetter(offCount++) };
      const n = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, n);
      return { stop, visible, offRoute, number: n, label: `${prefix}${n}` };
    });
    const visible = stops.filter((s) => s.visible).map((s) => s.stop);
    const route = stops.filter((s) => s.visible && !s.offRoute).map((s) => s.stop);
    return { section, prefix, stops, visibleStops: visible, routeStops: route, count: visible.length, minutes: totalMinutes(visible) };
  });
}

/** Visible stops of every section, in order. @returns {Stop[]} */
export function allVisible(trip, opts) {
  return visibleStops(trip, opts).flatMap((s) => s.visibleStops);
}
