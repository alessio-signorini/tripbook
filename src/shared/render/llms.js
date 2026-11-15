import { groupTrips } from './listing.js';
import { renderTripMarkdown } from './trip-md.js';
import { allVisible } from '../visible.js';
import { plural } from '../format.js';

const mdUrl = (config, path) => `${config.base_url || ''}${path}index.md`;

/** items: [{ trip, path }] (published only). */
export function renderLlmsTxt(items, ctx) {
  const { config } = ctx;
  const lines = [`# ${config.site_title || 'Trips'}`, ''];
  lines.push(`> Trip logs and city guides${config.author ? ` by ${config.author}` : ''}.`, '');
  for (const g of groupTrips(items)) {
    lines.push(`## ${g.country}`, '');
    for (const { trip, path } of [...g.direct, ...g.regions.flatMap((r) => r.items)]) {
      const where = trip.location.city || trip.location.region || trip.location.country;
      lines.push(`- [${trip.title}](${mdUrl(config, path)}): ${trip.kind}, ${where}, ${plural(allVisible(trip).length, 'stop')}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function renderLlmsFull(items, ctx) {
  const { config } = ctx;
  const ordered = groupTrips(items).flatMap((g) => [...g.direct, ...g.regions.flatMap((r) => r.items)]);
  return (
    ordered
      .map(({ trip, path }) => renderTripMarkdown(trip, { config, url: `${config.base_url || ''}${path}` }).trimEnd())
      .join('\n\n---\n\n') + '\n'
  );
}
