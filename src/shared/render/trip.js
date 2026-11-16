import { renderLayout, esc } from './layout.js';
import { renderMarkdown, stripMarkdown } from '../markdown.js';
import { renderStarCompact, isLow } from '../rating.js';
import { visibleStops } from '../visible.js';
import { openInMaps, routeLinks, stopDirectionsUrl } from '../maps-links.js';
import { formatMinutes, locationText, kindLabel, plural, shortAddress } from '../format.js';
import { tripJsonLd } from './jsonld.js';
import { icons } from './icons.js';

/** @typedef {import('../schema.js').Trip} Trip */
/** @typedef {import('../visible.js').SectionEntry} SectionEntry */

/**
 * Stop fields copied into the page's #trip-data JSON for src/site/trip/. The browser script and the
 * shared code it calls (visibleStops, maps-links, totals) must read only these; a missing field fails
 * silently in the browser. test/render.test.js checks both directions.
 */
export const CLIENT_STOP_FIELDS = ['id', 'name', 'lat', 'lng', 'place_id', 'rating', 'minutes', 'off_route'];

const hasText = (s) => Boolean(s && s.trim());
/** <a target=_blank>; `lead` attributes go before href, `extra` after rel. */
const external = (url, cls, inner, { lead = '', extra = '' } = {}) =>
  `<a class="${cls}"${lead} href="${esc(url)}" target="_blank" rel="noopener"${extra}>${inner}</a>`;

/** The JSON embedded as #trip-data: ids, kind and per-section stops with CLIENT_STOP_FIELDS only. */
export function tripClientData(trip) {
  const pick = (stop) => Object.fromEntries(CLIENT_STOP_FIELDS.filter((k) => stop[k] !== undefined && !(k === 'off_route' && stop[k] !== true)).map((k) => [k, stop[k]]));
  return {
    id: trip.id,
    kind: trip.kind,
    sections: visibleStops(trip).map((s) => ({
      id: s.section.id,
      prefix: s.prefix,
      title: s.section.title,
      style: s.section.style,
      stops: s.section.stops.map(pick),
    })),
  };
}

/** One <li class="stop"> plus, in route sections, the dotted leg <li> to the next stop. */
function stopRow(entry, section, nextEntry) {
  const { stop, visible, label, offRoute } = entry;
  const note = hasText(stop.note) ? `<div class="stop-note md">${renderMarkdown(stop.note)}</div>` : '';
  const classes = `stop${note ? '' : ' no-note'}${offRoute ? ' off-route' : ''}`;
  const attrs = `class="${classes}" data-stop="${esc(stop.id)}" data-number="${entry.number}" data-label="${esc(label)}"${isLow(stop) ? ' data-low' : ''}${visible ? '' : ' hidden'}`;
  const time = stop.minutes ? `<span class="time">${esc(formatMinutes(stop.minutes))}</span>` : '';
  const rating = stop.rating ? renderStarCompact(stop.rating) : '';
  const address = stop.address
    ? `<span class="addr"><span class="addr-full">${esc(stop.address)}</span><span class="addr-short">${esc(shortAddress(stop))}</span></span>`
    : '';
  const directions = external(stopDirectionsUrl(stop), 'dir-link', icons.directions, { extra: ` aria-label="Directions to ${esc(stop.name)}" title="Directions"` });
  const row =
    `<li ${attrs}><span class="badge-num${offRoute ? ' off' : ''}">${esc(label)}</span>` +
    `<div class="stop-main"><div class="stop-head"><h3 class="stop-name">${esc(stop.name)}</h3>${time}</div>` +
    (rating || address ? `<div class="stop-where">${rating}${address}</div>` : '') +
    note +
    `</div>${directions}</li>`;

  if (section.style !== 'route' || !nextEntry || !stop.leg_to_next) return row;
  const show = visible && nextEntry.visible && !offRoute && !nextEntry.offRoute;
  return row + `<li class="leg" data-after="${esc(stop.id)}"${show ? '' : ' hidden'} aria-hidden="true"><span>${esc(stop.leg_to_next)}</span></li>`;
}

/** <section class="sec">: head (prefix · title, count, time, route links) only when there are several sections or a title. */
function sectionBlock(sec, multi) {
  const { section, prefix } = sec;
  const titleText = [prefix, section.title].filter(Boolean).join(' · ');
  const meta = multi
    ? `<span class="sec-count">${esc(plural(sec.count, 'stop'))}</span>` +
      `<span class="sec-time"${sec.minutes ? '' : ' hidden'}>${esc(formatMinutes(sec.minutes))}</span>`
    : '';
  const solo = multi
    ? `<button type="button" class="sec-solo" data-solo="${esc(section.id)}" aria-pressed="false">Show only this</button>`
    : '';
  const links =
    multi && section.style === 'route'
      ? `<span class="route-links" data-route-links="${esc(section.id)}">${routeLinks(sec.routeStops)
          .map(({ url, label }) => external(url, 'route-link', label))
          .join(' ')}</span>`
      : '';
  const head = multi || section.title ? `<div class="sec-head"><h2 class="sec-title">${esc(titleText)}</h2><div class="sec-meta">${meta}${links}${solo}</div></div>` : '';
  const note = hasText(section.note) ? `<div class="sec-note md clamp">${renderMarkdown(section.note)}</div>` : '';
  return (
    `<section class="sec" data-section="${esc(section.id)}" data-style="${esc(section.style)}">` +
    head +
    note +
    `<ol class="stops">${sec.stops.map((e, i) => stopRow(e, section, sec.stops[i + 1])).join('')}</ol></section>`
  );
}

/** Desktop header: kicker, title, note with stats, Open in Google Maps and Share. */
function tripHeader({ trip, draft, multi, noteHtml, visibleCount, total, mapsUrl }) {
  const where = locationText(trip.location);
  const kicker = `${draft ? 'Draft · ' : ''}${kindLabel(trip.kind)}${where ? ` · ${where}` : ''}`;
  const stats = multi
    ? ''
    : `<span class="trip-meta">(<span data-stop-count>${esc(plural(visibleCount, 'stop'))}</span><span data-total-wrap${total ? '' : ' hidden'}> <span class="dot">·</span> <span data-total-time>${esc(formatMinutes(total))}</span></span>)</span>`;
  const note = noteHtml || stats ? `<div class="trip-note md d-only">${noteHtml}${stats}</div>` : '';
  const mapsBtn = mapsUrl ? external(mapsUrl, 'btn btn-primary d-only', `${icons.map}<span>Open in Google Maps</span>`, { lead: ' data-open-maps' }) : '';
  return `<header class="trip-header">
<div class="trip-header-main">
<div class="kicker">${esc(kicker)}</div>
<h1>${esc(trip.title)}</h1>
${note}
</div>
<div class="trip-header-actions">
<div class="trip-actions">${mapsBtn}<button type="button" class="btn btn-secondary d-only" id="share" aria-label="Share">${icons.share}<span>Share</span></button></div>
</div>
</header>`;
}

/** Mobile controls floating over the full-screen map: title card, Open in Google Maps, locate. */
function mobileChrome({ trip, config, total, mapsUrl }) {
  const author = config.author ? `By ${esc(config.author)}` : '';
  const meta = [author, `<span data-total-wrap${total ? '' : ' hidden'}>about <span data-total-time>${esc(formatMinutes(total))}</span></span>`].filter(Boolean).join(' · ');
  const mapsIcon = mapsUrl ? external(mapsUrl, 'm-maps-btn', icons.map, { lead: ' data-open-maps', extra: ' aria-label="Open in Google Maps"' }) : '';
  return `<div class="m-card"><div class="m-title">${esc(trip.title)}</div><div class="m-meta">${meta}</div></div>
${mapsIcon}
<button type="button" class="m-locate" id="locate" aria-label="Show my location">${icons.locate}</button>`;
}

/** Switches above the list: low-rated places (when any) and off-the-path places (when any). */
function toggles({ lowCount, offCount, defaultShowLow }) {
  const low = lowCount
    ? `<div class="low-toggle"><input type="checkbox" role="switch" id="low-toggle"${defaultShowLow ? ' checked' : ''}><label for="low-toggle">Show low-rated places (${lowCount})</label></div>`
    : '';
  const off = offCount
    ? `<div class="low-toggle"><input type="checkbox" role="switch" id="off-toggle" checked><label for="off-toggle">Show places off the path (${offCount})</label></div>`
    : '';
  return low + off;
}

/**
 * Full trip page (published or draft). Also used by the editor's Preview.
 * ctx: { config, assets: { css | cssText, font?, js }, path, draft, version }
 * @param {Trip} trip
 */
export function renderTripPage(trip, ctx) {
  const { config, draft = false } = ctx;
  const sections = visibleStops(trip);
  const multi = trip.sections.length > 1;
  const visibleCount = sections.reduce((n, s) => n + s.count, 0);
  const total = sections.reduce((n, s) => n + s.minutes, 0);
  const lowCount = trip.sections.reduce((n, s) => n + s.stops.filter(isLow).length, 0);
  const offCount = trip.sections.reduce((n, s) => n + (s.style === 'route' ? s.stops.filter((p) => p.off_route === true).length : s.stops.length), 0);
  const defaultShowLow = trip.kind === 'log';
  const url = `${config.base_url || ''}${draft ? `/drafts${ctx.path}` : ctx.path}`;
  const mapsUrl = openInMaps(sections.flatMap((s) => s.routeStops)).url;
  const noteHtml = hasText(trip.note) ? renderMarkdown(trip.note) : '';
  const mapPlaceholder = config.google_maps_api_key ? '' : '<div class="map-placeholder">Map unavailable: add google_maps_api_key to config.json</div>';

  const body = `<div class="trip">
${tripHeader({ trip, draft, multi, noteHtml, visibleCount, total, mapsUrl })}
${mobileChrome({ trip, config, total, mapsUrl })}
<div class="trip-body">
<div class="map-col"><div id="map" class="map" role="region" aria-label="Map">${mapPlaceholder}</div></div>
<div class="list-col" id="sheet">
<div class="sheet-top"><button type="button" class="sheet-handle" id="sheet-handle" aria-label="Resize list"><span></span></button></div>
<div class="sheet-scroll" id="sheet-scroll">
${toggles({ lowCount, offCount, defaultShowLow })}
${noteHtml ? `<div class="m-note md clamp" data-m-note>${noteHtml}</div>` : ''}
<div class="sections">${sections.map((s) => sectionBlock(s, multi)).join('')}</div>
</div>
</div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
</div>
<script type="application/json" id="trip-data">${JSON.stringify(tripClientData(trip)).replace(/</g, '\\u003c')}</script>
<script type="module" src="${esc(ctx.assets.js)}"></script>`;

  return renderLayout({
    title: `${trip.title} · ${config.site_title || 'Trips'}`,
    description: stripMarkdown(trip.note, 160) || `${kindLabel(trip.kind)} · ${locationText(trip.location)}`,
    lang: trip.lang,
    canonical: url,
    image: trip.photo?.url,
    body,
    bodyAttrs: `class="page-trip${lowCount && !defaultShowLow ? ' hide-stars' : ''}" data-maps-key="${esc(config.google_maps_api_key || '')}" data-map-id="${esc(config.google_maps_map_id || 'DEMO_MAP_ID')}" data-show-low="${defaultShowLow}"`,
    config,
    assets: ctx.assets,
    preconnect: config.google_maps_api_key ? ['https://maps.googleapis.com', 'https://maps.gstatic.com'] : [],
    draft,
    version: ctx.version,
    markdownHref: draft ? '' : 'index.md',
    jsonld: draft ? '' : tripJsonLd(trip, { config, url }),
  });
}
