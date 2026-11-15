import { isLow } from './rating.js';
import { sectionLetter, totalMinutes } from './format.js';

/**
 * Sections with their stops and number labels.
 * Every stop is returned with `visible` and `label`; hidden stops get label ''.
 * Returns [{ section, letter, stops: [{ stop, visible, label, number }], visibleStops, minutes }]
 * `showLow` defaults to the trip kind: guides hide low-rated stops, logs show them.
 */
export function visibleStops(trip, { showLow = trip.kind === 'log' } = {}) {
  const multi = trip.sections.length > 1;
  return trip.sections.map((section, si) => {
    const letter = sectionLetter(si);
    let n = 0;
    const stops = section.stops.map((stop) => {
      const visible = showLow || !isLow(stop);
      if (!visible) return { stop, visible, number: 0, label: '' };
      n += 1;
      return { stop, visible, number: n, label: multi ? `${letter}${n}` : String(n) };
    });
    const visible = stops.filter((s) => s.visible).map((s) => s.stop);
    return { section, letter, stops, visibleStops: visible, count: visible.length, minutes: totalMinutes(visible) };
  });
}

export function allVisible(trip, opts) {
  return visibleStops(trip, opts).flatMap((s) => s.visibleStops);
}
