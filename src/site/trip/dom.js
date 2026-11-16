export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Must match the mobile media queries in src/site/site.css. */
export const MOBILE_QUERY = '(max-width: 899.98px)';
export const mobile = window.matchMedia(MOBILE_QUERY);

/** Run `fn` once per animation frame at most (for resize and observer callbacks). */
export function rafThrottle(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

/** Run `fn` after the first frame has painted, so the list is interactive before heavy work starts. */
export const afterFirstPaint = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));

export function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 2500);
}
