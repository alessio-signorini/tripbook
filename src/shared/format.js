export function formatMinutes(n) {
  if (!n || n <= 0) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function sectionLetter(i) {
  let n = i;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function totalMinutes(stops) {
  return stops.reduce((sum, s) => sum + (s.minutes || 0), 0);
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "Pisa, Italy" / "Santa Barbara, California, United States"; empty parts skipped. */
export function locationText(loc = {}) {
  return [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
}

/** Street part of an address: drops trailing city, region, country and postal parts. */
export function shortAddress(stop) {
  const parts = String(stop.address || '').split(',').map((p) => p.trim()).filter(Boolean);
  const known = [stop.city, stop.region, stop.country, stop.country_code].filter(Boolean).map((v) => v.toLowerCase());
  const isTail = (p) => known.includes(p.toLowerCase()) || /^[A-Z]{2}(\s+\d{4,5}(-\d{4})?)?$/.test(p) || /^\d{4,5}(-\d{4})?$/.test(p);
  while (parts.length > 1 && isTail(parts[parts.length - 1])) parts.pop();
  return parts.join(', ');
}

export const kindLabel = (kind) => (kind === 'guide' ? 'Guide' : 'Trip log');

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
