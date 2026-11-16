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
 * @property {number} number   1-based among visible on-route stops of the section; 0 otherwise.
 * @property {string} label    "3", "B2" (several sections) or "A" (off-route); '' when hidden.
 */
/**
 * @typedef {object} SectionEntry
 * @property {Section} section
 * @property {string} letter          A, B, C...
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
 * (A, B, C... across the whole trip) instead of a number.
 * Returns [{ section, letter, stops: [{ stop, visible, offRoute, label, number }], visibleStops, routeStops, minutes }]
 * `showOffRoute` (default true) false hides off-route stops entirely.
 * `showLow` defaults to the trip kind: guides hide low-rated stops, logs show them.
 * @param {Trip} trip
 * @param {{ showLow?: boolean, showOffRoute?: boolean }} [opts]
 * @returns {SectionEntry[]}
 */
export function visibleStops(trip, { showLow = trip.kind === 'log', showOffRoute = true } = {}) {
  const multi = trip.sections.length > 1;
  let offCount = 0;
  return trip.sections.map((section, si) => {
    const letter = sectionLetter(si);
    let n = 0;
    const stops = section.stops.map((stop) => {
      const offRoute = section.style === 'route' && stop.off_route === true;
      const visible = (showLow || !isLow(stop)) && (showOffRoute || !offRoute);
      if (!visible) return { stop, visible, offRoute, number: 0, label: '' };
      if (offRoute) return { stop, visible, offRoute, number: 0, label: sectionLetter(offCount++) };
      n += 1;
      return { stop, visible, offRoute, number: n, label: multi ? `${letter}${n}` : String(n) };
    });
    const visible = stops.filter((s) => s.visible).map((s) => s.stop);
    const route = stops.filter((s) => s.visible && !s.offRoute).map((s) => s.stop);
    return { section, letter, stops, visibleStops: visible, routeStops: route, count: visible.length, minutes: totalMinutes(visible) };
  });
}

/** Visible stops of every section, in order. @returns {Stop[]} */
export function allVisible(trip, opts) {
  return visibleStops(trip, opts).flatMap((s) => s.visibleStops);
}
