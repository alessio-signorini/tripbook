import { escapeHtml as esc } from '../format.js';

/** Credit line for a trip photo (HTML). Author and licence come from Wikimedia Commons. */
export function photoCredit(photo) {
  const who = photo.author ? `${esc(photo.author)}` : 'Wikimedia Commons';
  const lic = photo.license
    ? photo.license_url
      ? ` (<a href="${esc(photo.license_url)}" target="_blank" rel="noopener">${esc(photo.license)}</a>)`
      : ` (${esc(photo.license)})`
    : '';
  const src = photo.source_url ? `<a href="${esc(photo.source_url)}" target="_blank" rel="noopener">${who}</a>` : who;
  return `Photo: ${src}${lic}`;
}
