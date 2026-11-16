import { renderLayout, esc } from './layout.js';
import { allVisible } from '../visible.js';
import { kindLabel, plural, formatMinutes, totalMinutes } from '../format.js';
import { stripMarkdown } from '../markdown.js';
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

function card({ trip, path }) {
  const visible = allVisible(trip);
  const minutes = totalMinutes(visible);
  const meta = [trip.location.city, plural(visible.length, 'stop'), minutes ? formatMinutes(minutes) : ''].filter(Boolean).map(esc).join(' · ');
  const note = trip.note && trip.note.trim() ? `<p class="card-note">${esc(stripMarkdown(trip.note, 200))}</p>` : '';
  const photo = trip.photo ? `<a class="card-photo" href="${esc(path)}" tabindex="-1" aria-hidden="true"><img src="${esc(trip.photo.thumb || trip.photo.url)}" alt="" loading="lazy" width="96" height="96"></a>` : '';
  return `<li class="card${photo ? ' has-photo' : ''}">${photo}<div class="card-text"><div class="card-head"><a class="card-title" href="${esc(path)}">${esc(trip.title)}</a><span class="badge badge-${esc(trip.kind)}">${kindLabel(trip.kind)}</span></div><div class="card-meta">${meta}</div>${note}</div></li>`;
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
    body += `<section class="group"><h2>${esc(g.country)}</h2>`;
    if (g.direct.length) body += list(g.direct);
    for (const r of g.regions) body += `<h3>${esc(r.region)}</h3>${list(r.items)}`;
    body += '</section>';
  }
  if (!groups.length) body = '<p class="empty">No trips yet.</p>';

  const credits = items.filter((i) => i.trip.photo).map((i) => `<li>${esc(i.trip.title)}: ${photoCredit(i.trip.photo)}</li>`);
  const creditsHtml = credits.length ? `<details class="photo-credits"><summary>Photo credits</summary><ul>${credits.join('')}</ul></details>` : '';

  const nav = crumbs.length
    ? `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">${esc(siteTitle)}</a>${crumbs
        .map((c, i) => (i === crumbs.length - 1 ? ` <span aria-hidden="true">›</span> <span aria-current="page">${esc(c.name)}</span>` : ` <span aria-hidden="true">›</span> <a href="${esc(c.path)}">${esc(c.name)}</a>`))
        .join('')}</nav>`
    : '';

  const page = `<main class="listing">
${nav}
<h1>${esc(heading)}</h1>
${config.author ? `<p class="by">By ${esc(config.author)}</p>` : ''}
${body}
${creditsHtml}
</main>`;

  return renderLayout({
    title: crumbs.length ? `${heading} · ${siteTitle}` : siteTitle,
    description: `Trip logs and city guides${config.author ? ` by ${config.author}` : ''}.`,
    lang: config.default_lang,
    canonical: ctx.canonical,
    body: page,
    bodyAttrs: 'class="page-listing"',
    config,
    assets: ctx.assets,
    version: ctx.version,
  });
}
