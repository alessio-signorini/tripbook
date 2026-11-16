import { $$, rafThrottle } from './dom.js';

/**
 * Mobile notes are clamped to 3 lines by CSS (.clamp). Add a More/Less button after each one that
 * overflows. A ResizeObserver re-checks only when a note changes size; reads happen before writes.
 */
export function watchClamps() {
  const els = $$('.clamp');
  if (!els.length || !('ResizeObserver' in window)) return;

  const check = rafThrottle(() => {
    const states = els.map((el) => ({
      el,
      button: el.nextElementSibling?.classList.contains('more') ? el.nextElementSibling : null,
      overflows: el.scrollHeight > el.clientHeight + 1,
      expanded: el.classList.contains('expanded'),
    }));
    for (const { el, button, overflows, expanded } of states) {
      if (expanded) continue;
      if (overflows && !button) el.after(moreButton(el));
      else if (!overflows && button) button.remove();
    }
  });

  const observer = new ResizeObserver(check);
  els.forEach((el) => observer.observe(el));
}

function moreButton(el) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'more';
  b.textContent = 'More';
  b.addEventListener('click', () => {
    const open = el.classList.toggle('expanded');
    b.textContent = open ? 'Less' : 'More';
  });
  return b;
}
