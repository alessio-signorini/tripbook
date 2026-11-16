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
 * (A, B, C... across the whole trip) instead of a number. Every stop of a `list` section is off-route.
 * Section letters (A, B...) go only to route sections, and only when there are several of them;
 * otherwise `letter` is '' and labels are plain numbers.
 * `only` (a section id) hides every other section's stops without changing labels.
 * Returns [{ section, letter, stops: [{ stop, visible, offRoute, label, number }], visibleStops, routeStops, minutes }]
 * `showOffRoute` (default true) false hides off-route stops entirely.
 * `showLow` defaults to the trip kind: guides hide low-rated stops, logs show them.
 * @param {Trip} trip
 * @param {{ showLow?: boolean, showOffRoute?: boolean, only?: string|null }} [opts]
 * @returns {SectionEntry[]}
 */
export function visibleStops(trip, { showLow = trip.kind === 'log', showOffRoute = true, only = null } = {}) {
  const multi = trip.sections.filter((s) => s.style === 'route').length > 1;
  let offCount = 0;
  let routeIndex = 0;
  return trip.sections.map((section) => {
    const isRoute = section.style === 'route';
    const letter = multi && isRoute ? sectionLetter(routeIndex++) : '';
    const hiddenBySolo = only !== null && section.id !== only;
    let n = 0;
    const stops = section.stops.map((stop) => {
      const offRoute = !isRoute || stop.off_route === true;
      const wanted = (showLow || !isLow(stop)) && (showOffRoute || !offRoute);
      if (!wanted) return { stop, visible: false, offRoute, number: 0, label: '' };
      const visible = !hiddenBySolo;
      if (offRoute) return { stop, visible, offRoute, number: 0, label: sectionLetter(offCount++) };
      n += 1;
      return { stop, visible, offRoute, number: n, label: `${letter}${n}` };
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
