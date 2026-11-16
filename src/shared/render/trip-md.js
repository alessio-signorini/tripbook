import { visibleStops } from '../visible.js';
import { stopDirectionsUrl } from '../maps-links.js';
import { formatMinutes, locationText, kindLabel } from '../format.js';

const indent = (text, pad = '   ') =>
  String(text)
    .trim()
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');

function stopLines(stop, number, leg) {
  const head = `${number === '-' ? '-' : `${number}.`} **${stop.name}**${stop.address ? ` — ${stop.address}` : ''}`;
  const meta = [];
  if (stop.minutes) meta.push(`Time: ${formatMinutes(stop.minutes)}`);
  if (stop.rating) meta.push(`Rating: ${stop.rating}/5`);
  meta.push(`Google Maps: ${stopDirectionsUrl(stop)}`);
  const lines = [head, `   ${meta.join(' · ')}`];
  if (stop.note && stop.note.trim()) lines.push(indent(stop.note));
  if (leg) lines.push(`   Next: ${leg}`);
  return lines.join('\n');
}

/** ctx: { config, url } where url is the absolute page URL (may be ''). */
export function renderTripMarkdown(trip, ctx) {
  const isGuide = trip.kind === 'guide';
  const sections = visibleStops(trip);
  const multi = trip.sections.length > 1;
  const out = [];

  out.push(`# ${trip.title}`);
  const byline = [kindLabel(trip.kind), locationText(trip.location), ctx.config.author ? `By ${ctx.config.author}` : ''];
  out.push(byline.filter(Boolean).join(' · '));
  if (ctx.url) out.push(`Web: ${ctx.url}`);
  out.push('');
  if (trip.note && trip.note.trim()) out.push(trip.note.trim(), '');

  for (const sec of sections) {
    const title = sec.section.title;
    if (sec.letter) out.push(`## ${sec.letter}${title ? ` · ${title}` : ''}`);
    else if (title) out.push(`## ${title}`);
    if (sec.section.note && sec.section.note.trim()) out.push(sec.section.note.trim(), '');
    else if (multi || title) out.push('');

    const route = sec.section.style === 'route';
    const entries = sec.stops;
    const alsoRecommended = [];
    entries.forEach((entry, i) => {
      if (!entry.visible) return;
      if (entry.offRoute) return alsoRecommended.push(entry.stop);
      const next = entries[i + 1];
      const leg = route && next && next.visible && !next.offRoute ? sec.section.stops[i].leg_to_next : null;
      out.push(stopLines(entry.stop, entry.number, leg));
    });
    if (alsoRecommended.length) {
      out.push('', 'Also recommended (not on the route):', '');
      for (const s of alsoRecommended) out.push(stopLines(s, '-', null));
    }
    out.push('');
  }

  if (isGuide) {
    const low = sections.flatMap((sec) => sec.stops.filter((e) => !e.visible).map((e) => e.stop));
    if (low.length) {
      out.push('## Not recommended', '');
      for (const s of low) {
        const note = s.note && s.note.trim() ? ` ${s.note.trim().replace(/\s+/g, ' ')}` : '';
        out.push(`- **${s.name}** (Rating: ${s.rating}/5)${note}`);
      }
      out.push('');
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
