import { $, $$ } from './dom.js';
import { routeLinks, openInMaps } from '../../shared/maps-links.js';
import { formatMinutes, plural } from '../../shared/format.js';

/**
 * The server-rendered stop list (render/trip.js) and the page-level counters.
 * `render(results)` applies visibleStops() output: hides/shows rows and legs, relabels badges,
 * refreshes section and trip totals, route links and every "Open in Google Maps" link.
 */
export function createList() {
  const rows = new Map($$('.stop').map((el) => [el.dataset.stop, el]));
  const legs = new Map($$('.leg').map((el) => [el.dataset.after, el]));
  const sections = new Map($$('.sec').map((el) => [el.dataset.section, el]));
  const multi = sections.size > 1;

  function renderSection(sec) {
    const el = sections.get(sec.section.id);
    const count = $('.sec-count', el);
    if (count) count.textContent = plural(sec.count, 'stop');
    const time = $('.sec-time', el);
    if (time) {
      time.textContent = formatMinutes(sec.minutes);
      time.hidden = !sec.minutes;
    }
    const links = $('.route-links', el);
    if (links && multi) {
      links.replaceChildren(
        ...routeLinks(sec.routeStops).map(({ url, label }) => {
          const a = document.createElement('a');
          a.className = 'route-link';
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = label;
          return a;
        }),
      );
    }
    sec.stops.forEach((entry, i) => {
      const row = rows.get(entry.stop.id);
      row.hidden = !entry.visible;
      row.dataset.label = entry.label;
      $('.badge-num', row).textContent = entry.label;
      const leg = legs.get(entry.stop.id);
      const next = sec.stops[i + 1];
      if (leg) leg.hidden = !(entry.visible && next?.visible && !entry.offRoute && !next.offRoute);
    });
  }

  function render(results) {
    results.forEach(renderSection);
    const visible = results.flatMap((s) => s.visibleStops);
    const total = results.reduce((n, s) => n + s.minutes, 0);
    $$('[data-stop-count]').forEach((el) => (el.textContent = plural(visible.length, 'stop')));
    $$('[data-total-time]').forEach((el) => (el.textContent = formatMinutes(total)));
    $$('[data-total-wrap]').forEach((el) => (el.hidden = !total));
    const maps = openInMaps(results.flatMap((s) => s.routeStops));
    $$('[data-open-maps]').forEach((a) => {
      a.hidden = !maps.url;
      if (maps.url) a.href = maps.url;
    });
  }

  function setSelected(id, { scroll = false } = {}) {
    rows.forEach((el, sid) => el.classList.toggle('selected', sid === id));
    if (id && scroll) rows.get(id).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  return { rows, render, setSelected, isHidden: (id) => Boolean(rows.get(id)?.hidden) };
}
