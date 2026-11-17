import { renderLayout, esc } from './layout.js';
import { allVisible } from '../visible.js';
import { kindLabel, plural, formatMinutes, totalMinutes } from '../format.js';
import { stripMarkdown, renderMarkdown } from '../markdown.js';
import { photoCredit } from './photo.js';

const byText = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });

/**
 * items: [{ trip, path }] -> [{ country, regions: [{ region, items }], direct: items }]
 * Alphabetical by country, then region; trips without a region come first; then by title.
 */
export function groupTrips(items) {
  const countries = new Map();
  for (const item of items) {
    const { country, region } = item.trip.location;
    if (!countries.has(country)) countries.set(country, { country, direct: [], regions: new Map() });
    const c = countries.get(country);
    if (region) {
      if (!c.regions.has(region)) c.regions.set(region, { region, items: [] });
      c.regions.get(region).items.push(item);
    } else {
      c.direct.push(item);
    }
  }
  const byTitle = (a, b) => byText(a.trip.title, b.trip.title);
  return [...countries.values()]
    .sort((a, b) => byText(a.country, b.country))
    .map((c) => ({
      country: c.country,
      direct: c.direct.sort(byTitle),
      regions: [...c.regions.values()]
        .sort((a, b) => byText(a.region, b.region))
        .map((r) => ({ region: r.region, items: r.items.sort(byTitle) })),
    }));
}

/** Flat list in index order (same order as the grouped page). */
export function sortedTrips(items) {
  return groupTrips(items).flatMap((c) => [...c.direct, ...c.regions.flatMap((r) => r.items)]);
}

/** One pin per trip, at the mean position of its stops: [{ title, path, country, lat, lng }]. */
export function tripPins(items) {
  const pins = [];
  for (const { trip, path } of sortedTrips(items)) {
    const stops = trip.sections.flatMap((s) => s.stops).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat || p.lng));
    if (!stops.length) continue;
    const mean = (k) => Math.round((stops.reduce((n, p) => n + p[k], 0) / stops.length) * 1e4) / 1e4;
    pins.push({ title: trip.title, path, country: trip.location.country, lat: mean('lat'), lng: mean('lng') });
  }
  return pins;
}

const countTrips = (g) => g.direct.length + g.regions.reduce((n, r) => n + r.items.length, 0);

function card({ trip, path }) {
  const visible = allVisible(trip);
  const minutes = totalMinutes(visible);
  const meta = [trip.location.city, plural(visible.length, 'stop'), minutes ? formatMinutes(minutes) : ''].filter(Boolean).map(esc).join(' · ');
  const note = trip.note && trip.note.trim() ? `<p class="card-note">${esc(stripMarkdown(trip.note, 200))}</p>` : '';
  const photo = trip.photo ? `<a class="card-photo" href="${esc(path)}" tabindex="-1" aria-hidden="true"><img src="${esc(trip.photo.thumb || trip.photo.url)}" alt="" loading="lazy" width="64" height="64"></a>` : '';
  return `<li class="card${photo ? ' has-photo' : ''}" data-trip="${esc(path)}">${photo}<div class="card-text"><div class="card-head"><a class="card-title" href="${esc(path)}">${esc(trip.title)}</a><span class="badge badge-${esc(trip.kind)}">${kindLabel(trip.kind)}</span></div><div class="card-meta">${meta}</div>${note}</div></li>`;
}

const list = (items) => `<ul class="cards">${items.map(card).join('\n')}</ul>`;

/**
 * items: published trips to show. ctx: { config, assets, version, canonical, crumbs: [{path,name}], heading }
 */
export function renderListing(items, ctx) {
  const { config } = ctx;
  const groups = groupTrips(items);
  const siteTitle = config.site_title || 'Trips';
  const heading = ctx.heading || siteTitle;
  const crumbs = ctx.crumbs || [];

  let body = '';
  for (const g of groups) {
    const count = countTrips(g);
    body += `<details class="group" data-country="${esc(g.country)}" open><summary><h2>${esc(g.country)}</h2><span class="count">${count}</span></summary>`;
    if (g.direct.length) body += list(g.direct);
    for (const r of g.regions) body += `<details class="region" open><summary><h3>${esc(r.region)}</h3><span class="count">${r.items.length}</span></summary>${list(r.items)}</details>`;
    body += '</details>';
  }
  if (!groups.length) body = '<p class="empty">No trips yet.</p>';

  const credits = items.filter((i) => i.trip.photo).map((i) => `<li>${esc(i.trip.title)}: ${photoCredit(i.trip.photo)}</li>`);
  const creditsHtml = credits.length ? `<details class="photo-credits"><summary>Photo credits</summary><ul>${credits.join('')}</ul></details>` : '';

  const nav = crumbs.length
    ? `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">${esc(siteTitle)}</a>${crumbs
        .map((c, i) => (i === crumbs.length - 1 ? ` <span aria-hidden="true">›</span> <span aria-current="page">${esc(c.name)}</span>` : ` <span aria-hidden="true">›</span> <a href="${esc(c.path)}">${esc(c.name)}</a>`))
        .join('')}</nav>`
    : '';

  const pins = tripPins(items);
  const mapKey = config.google_maps_api_key;
  const showMap = Boolean(mapKey && pins.length && ctx.assets.indexJs);
  const intro = !crumbs.length && config.intro && config.intro.trim() ? `<div class="intro md">${renderMarkdown(config.intro)}</div>` : '';
  const mapHtml = showMap
    ? `<div class="world-map" id="world-map" role="region" aria-label="Map of trips"></div>
<script type="application/json" id="trip-pins">${JSON.stringify(pins).replace(/</g, '\\u003c')}</script>`
    : '';
  const countryNav =
    groups.length > 1
      ? `<nav class="countries" aria-label="Countries"><ul><li><button type="button" class="country on" data-country="">All<span class="count">${items.length}</span></button></li>${groups
          .map((g) => `<li><button type="button" class="country" data-country="${esc(g.country)}">${esc(g.country)}<span class="count">${countTrips(g)}</span></button></li>`)
          .join('')}</ul></nav>`
      : '';
  const rail = mapHtml || countryNav ? `<aside class="rail">${mapHtml}${countryNav}</aside>` : '';
  const script = rail && ctx.assets.indexJs ? `<script type="module" src="${esc(ctx.assets.indexJs)}"></script>` : '';

  const page = `<main class="listing${rail ? ' has-rail' : ''}">
${nav}
<h1>${esc(heading)}</h1>
${intro}
<div class="listing-body">
${rail}
<div class="trips-col">
${body}
</div>
</div>
${creditsHtml}
</main>
${script}`;

  return renderLayout({
    title: crumbs.length ? `${heading} · ${siteTitle}` : siteTitle,
    description: `Trip logs and city guides${config.author ? ` by ${config.author}` : ''}.`,
    lang: config.default_lang,
    canonical: ctx.canonical,
    body: page,
    bodyAttrs: `class="page-listing"${showMap ? ` data-maps-key="${esc(mapKey)}" data-map-id="${esc(config.google_maps_map_id || 'DEMO_MAP_ID')}"` : ''}`,
    preconnect: showMap ? ['https://maps.googleapis.com', 'https://maps.gstatic.com'] : [],
    config,
    assets: ctx.assets,
    version: ctx.version,
  });
}
