import { STAR_PATH } from './theme.js';

/** Ratings 1 and 2 are "low": hidden by default in guides, behind the "Show low-rated places" switch. */
export const isLow = (stop) => stop.rating === 1 || stop.rating === 2;

/**
 * Compact rating for the trip page: one 16 px star filled left to right in proportion rating/5,
 * then "(4/5)". The fill is a nested <svg> whose viewport clips the accent star, so there are no ids
 * and the output is deterministic. Colors and sizes come from .stars-compact in src/site/site.css.
 */
export function renderStarCompact(rating) {
  if (!rating) return '';
  const w = (16 * rating) / 5;
  return (
    `<span class="stars-compact" role="img" aria-label="Rated ${rating} out of 5">` +
    `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path class="star-empty" d="${STAR_PATH}"/>` +
    `<svg width="${w}" height="16" viewBox="0 0 ${w} 16"><path class="star-full" d="${STAR_PATH}"/></svg></svg>` +
    `<span class="stars-num">(${rating}/5)</span></span>`
  );
}
