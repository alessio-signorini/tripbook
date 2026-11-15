import { renderLayout, esc } from './layout.js';
import { renderMarkdown, stripMarkdown } from '../markdown.js';
import { renderStars, renderStarCompact, isLow } from '../rating.js';
import { visibleStops } from '../visible.js';
import { openInMaps, directionsUrl, stopDirectionsUrl } from '../maps-links.js';
import { formatMinutes, locationText, kindLabel, plural } from '../format.js';
import { tripJsonLd } from './jsonld.js';
import { icons } from './icons.js';

function routeLinks(stops) {
  const dir = directionsUrl(stops);
  if (!dir) return '';
  const urls = Array.isArray(dir) ? dir : [dir];
  return urls
    .map((u, i) => `<a class="route-link" href="${esc(u)}" target="_blank" rel="noopener">${urls.length > 1 ? `Part ${i + 1}` : 'Route in Google Maps'}</a>`)
    .join(' ');
}

function mapsNote(missing) {
  return missing > 0 ? `${plural(missing, 'stop')} without a Google place ${missing === 1 ? 'is' : 'are'} not in this list` : '';
}

function stopRow(entry, section, nextEntry) {
  const { stop, visible, label } = entry;
  const low = isLow(stop);
  const attrs = `class="stop" data-stop="${esc(stop.id)}" data-number="${entry.number}" data-label="${esc(label)}"${low ? ' data-low' : ''}${visible ? '' : ' hidden'}`;
  const time = stop.minutes ? `<span class="time">${esc(formatMinutes(stop.minutes))}</span>` : '';
  const rating = stop.rating
    ? `<span class="rating-full">${renderStars(stop.rating)}</span><span class="rating-compact">${renderStarCompact(stop.rating)}</span>`
    : '';
  const note = stop.note && stop.note.trim() ? `<div class="stop-note md">${renderMarkdown(stop.note)}</div>` : '';
  const row =
    `<li ${attrs}><span class="badge-num">${esc(label)}</span>` +
    `<div class="stop-main"><div class="stop-head"><h3 class="stop-name">${esc(stop.name)}</h3>${time}${rating}</div>` +
    (stop.address ? `<div class="addr">${esc(stop.address)}</div>` : '') +
    note +
    `</div><a class="dir-link" href="${esc(stopDirectionsUrl(stop))}" target="_blank" rel="noopener" aria-label="Directions to ${esc(stop.name)}">${icons.directions}<span>Directions</span></a></li>`;

  let leg = '';
  if (section.style === 'route' && nextEntry && stop.leg_to_next) {
    const show = visible && nextEntry.visible;
    leg = `<li class="leg" data-after="${esc(stop.id)}"${show ? '' : ' hidden'} aria-hidden="true"><span>${esc(stop.leg_to_next)}</span></li>`;
  }
  return row + leg;
}

function sectionBlock(sec, multi) {
  const { section, letter } = sec;
  const head = multi || section.title;
  const titleText = [multi ? letter : '', section.title].filter(Boolean).join(' · ');
  const meta =
    `<span class="sec-count">${esc(plural(sec.count, 'stop'))}</span>` +
    `<span class="sec-time"${sec.minutes ? '' : ' hidden'}>${esc(formatMinutes(sec.minutes))}</span>`;
  const links = section.style === 'route' ? `<span class="route-links" data-route-links="${esc(section.id)}">${routeLinks(sec.visibleStops)}</span>` : '';
  const note = section.note && section.note.trim() ? `<div class="sec-note md clamp">${renderMarkdown(section.note)}</div>` : '';
  return (
    `<section class="sec" data-section="${esc(section.id)}" data-style="${esc(section.style)}">` +
    (head ? `<div class="sec-head"><h2 class="sec-title">${esc(titleText)}</h2><div class="sec-meta">${meta}${links}</div></div>` : '') +
    note +
    `<ol class="stops">${sec.stops.map((e, i) => stopRow(e, section, sec.stops[i + 1])).join('')}</ol></section>`
  );
}

/** ctx: { config, assets:{css,js}, path, draft, version } */
export function renderTripPage(trip, ctx) {
  const { config, draft = false } = ctx;
  const sections = visibleStops(trip);
  const multi = trip.sections.length > 1;
  const visible = sections.flatMap((s) => s.visibleStops);
  const total = sections.reduce((n, s) => n + s.minutes, 0);
  const lowCount = trip.sections.reduce((n, s) => n + s.stops.filter(isLow).length, 0);
  const defaultShowLow = trip.kind === 'log';
  const base = config.base_url || '';
  const pagePath = draft ? `/drafts${ctx.path}` : ctx.path;
  const url = `${base}${pagePath}`;
  const maps = openInMaps(visible);
  const author = config.author ? `By ${esc(config.author)}` : '';

  const data = {
    id: trip.id,
    kind: trip.kind,
    sections: sections.map((s) => ({
      id: s.section.id,
      letter: s.letter,
      title: s.section.title,
      style: s.section.style,
      stops: s.section.stops.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, place_id: p.place_id, rating: p.rating, minutes: p.minutes })),
    })),
  };

  const kicker = `${draft ? 'Draft · ' : ''}${kindLabel(trip.kind)}${locationText(trip.location) ? ` · ${locationText(trip.location)}` : ''}`;
  const noteHtml = trip.note && trip.note.trim() ? renderMarkdown(trip.note) : '';
  const tripNote = noteHtml ? `<div class="trip-note md d-only">${noteHtml}</div>` : '';
  const metaParts = [
    author,
    `<span data-stop-count>${esc(plural(visible.length, 'stop'))}</span>`,
    `<span data-total-wrap${total ? '' : ' hidden'}>About <span data-total-time>${esc(formatMinutes(total))}</span></span>`,
  ].filter(Boolean);
  const mobileMeta = [author, `<span data-total-wrap${total ? '' : ' hidden'}>about <span data-total-time>${esc(formatMinutes(total))}</span></span>`].filter(Boolean).join(' · ');

  const tabs = multi
    ? `<div class="tabs" role="tablist" aria-label="Sections"><button role="tab" class="tab" data-tab="all" aria-selected="true">All</button>${sections
        .map((s) => `<button role="tab" class="tab" data-tab="${esc(s.section.id)}" aria-selected="false">${esc([s.letter, s.section.title].filter(Boolean).join(' · '))}</button>`)
        .join('')}</div>`
    : '';

  const toggle = lowCount
    ? `<div class="low-toggle"><input type="checkbox" role="switch" id="low-toggle"${defaultShowLow ? ' checked' : ''}><label for="low-toggle">Show low-rated places (${lowCount})</label></div>`
    : '';

  const mapsBtn = maps.url
    ? `<a class="btn btn-primary d-only" data-open-maps href="${esc(maps.url)}" target="_blank" rel="noopener">${icons.map}<span>Open in Google Maps</span></a>`
    : '';
  const mapsIcon = maps.url
    ? `<a class="m-maps-btn" data-open-maps href="${esc(maps.url)}" target="_blank" rel="noopener" aria-label="Open in Google Maps">${icons.map}</a>`
    : '';

  const mapPlaceholder = config.google_maps_api_key
    ? ''
    : '<div class="map-placeholder">Map unavailable: add google_maps_api_key to config.json</div>';

  const body = `<div class="trip">
<header class="trip-header">
<div class="kicker">${esc(kicker)}</div>
<h1>${esc(trip.title)}</h1>
${tripNote}
<div class="trip-meta">${metaParts.join(' · ')}</div>
<div class="trip-actions">${mapsBtn}<button type="button" class="btn btn-secondary d-only" id="share" aria-label="Share">${icons.share}<span>Share</span></button></div>
<div class="maps-note d-only" data-maps-note>${esc(mapsNote(maps.missing))}</div>
</header>
<div class="m-card"><div class="m-title">${esc(trip.title)}</div><div class="m-meta">${mobileMeta}</div></div>
${mapsIcon}
<button type="button" class="m-locate" id="locate" aria-label="Show my location">${icons.locate}</button>
<div class="trip-body">
<div class="map-col"><div id="map" class="map" role="region" aria-label="Map">${mapPlaceholder}</div></div>
<div class="list-col" id="sheet">
<div class="sheet-top"><button type="button" class="sheet-handle" id="sheet-handle" aria-label="Resize list"><span></span></button></div>
<div class="sheet-scroll" id="sheet-scroll">
${tabs}
${toggle}
${noteHtml ? `<div class="m-note md clamp" data-m-note>${noteHtml}</div>` : ''}
<div class="sections">${sections.map((s) => sectionBlock(s, multi)).join('')}</div>
</div>
</div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
</div>
<script type="application/json" id="trip-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script type="module" src="${esc(ctx.assets.js)}"></script>`;

  return renderLayout({
    title: `${trip.title} · ${config.site_title || 'Trips'}`,
    description: stripMarkdown(trip.note, 160) || `${kindLabel(trip.kind)} · ${locationText(trip.location)}`,
    lang: trip.lang,
    canonical: url,
    body,
    bodyAttrs: `class="page-trip" data-maps-key="${esc(config.google_maps_api_key || '')}" data-map-id="${esc(config.google_maps_map_id || 'DEMO_MAP_ID')}" data-show-low="${defaultShowLow}"`,
    config,
    assets: ctx.assets,
    draft,
    version: ctx.version,
    markdownHref: draft ? '' : 'index.md',
    jsonld: draft ? '' : tripJsonLd(trip, { config, url }),
  });
}
