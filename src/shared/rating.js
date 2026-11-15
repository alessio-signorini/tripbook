const ACCENT = '#C2410C';
const EMPTY = '#D3D6D0';
const STAR = 'M8 1.2l2.1 4.4 4.8.6-3.5 3.3.9 4.8L8 12l-4.3 2.3.9-4.8L1.1 6.2l4.8-.6z';

let counter = 0;

export const isLow = (stop) => stop.rating === 1 || stop.rating === 2;

const label = (rating) => `Rated ${rating} out of 5`;

export function renderStars(rating) {
  if (!rating) return '';
  let svgs = '';
  for (let i = 1; i <= 5; i++) {
    svgs += `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="${STAR}" fill="${i <= rating ? ACCENT : EMPTY}"/></svg>`;
  }
  return `<span class="stars" role="img" aria-label="${label(rating)}" style="display:inline-flex;gap:2px;vertical-align:middle">${svgs}</span>`;
}

export function renderStarCompact(rating) {
  if (!rating) return '';
  const id = `star-grad-${++counter}`;
  const pct = `${(rating / 5) * 100}%`;
  return (
    `<span class="stars-compact" role="img" aria-label="${label(rating)}" style="display:inline-flex;align-items:center;gap:3px;vertical-align:middle">` +
    `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">` +
    `<stop offset="${pct}" stop-color="${ACCENT}"/><stop offset="${pct}" stop-color="${EMPTY}"/></linearGradient></defs>` +
    `<path d="${STAR}" fill="url(#${id})"/></svg>` +
    `<span style="font-size:12px;color:#5F6368">(${rating}/5)</span></span>`
  );
}
