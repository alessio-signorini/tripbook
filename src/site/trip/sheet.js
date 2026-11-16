import { mobile, rafThrottle } from './dom.js';

/** Visible height of the sheet as a fraction of the viewport, smallest first. */
const SNAPS = [0.28, 0.55, 0.9];

/**
 * Mobile bottom sheet (#sheet). The sheet is 90dvh tall and slides with `transform`, so dragging and
 * snapping never re-lay-out the list. After each snap the scroll area gets bottom padding equal to the
 * hidden part, so the last stop can still be scrolled into view. On desktop it is a normal column.
 * `onChange()` runs after every snap (the map re-fits its padding).
 */
export function createSheet(el, { handle, grip, scroller, onChange = () => {} }) {
  let snap = 0;
  let drag = null;
  const vh = () => window.innerHeight;
  const offsetFor = (fraction) => Math.max(0, el.offsetHeight - fraction * vh());
  const setOffset = (px) => (el.style.transform = `translateY(${px}px)`);

  function setSnap(i) {
    snap = i;
    if (mobile.matches) {
      const offset = offsetFor(SNAPS[i]);
      setOffset(offset);
      scroller.style.paddingBottom = `${32 + offset}px`;
    } else {
      el.style.transform = '';
      scroller.style.paddingBottom = '';
    }
    onChange();
  }

  /** Height of the sheet on screen once the current snap settles (0 on desktop). */
  const visibleHeight = () => (mobile.matches ? Math.min(el.offsetHeight, SNAPS[snap] * vh()) : 0);

  function onMove(e) {
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 4) drag.moved = true;
    setOffset(Math.min(offsetFor(SNAPS[0]), Math.max(offsetFor(SNAPS[SNAPS.length - 1]), drag.offset + dy)));
  }

  function onEnd() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    const moved = drag.moved;
    drag = moved ? { moved } : null;
    el.classList.remove('dragging');
    if (!moved) return;
    const ratio = (vh() - el.getBoundingClientRect().top) / vh();
    setSnap(SNAPS.reduce((best, s, i) => (Math.abs(s - ratio) < Math.abs(SNAPS[best] - ratio) ? i : best), 0));
    setTimeout(() => (drag = null));
  }

  grip.addEventListener('pointerdown', (e) => {
    if (!mobile.matches || e.target.closest('a, input, label')) return;
    drag = { y: e.clientY, offset: offsetFor(SNAPS[snap]), moved: false };
    el.classList.add('dragging');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  });

  // A tap on the handle (not the end of a drag) steps through the snaps.
  handle.addEventListener('click', () => {
    if (drag?.moved) return;
    setSnap((snap + 1) % SNAPS.length);
  });

  mobile.addEventListener('change', () => setSnap(snap));
  window.addEventListener('resize', rafThrottle(() => setSnap(snap)));
  setSnap(0);

  return {
    get snap() {
      return snap;
    },
    setSnap,
    visibleHeight,
    /** Raise a collapsed sheet so a selected stop is visible. */
    reveal() {
      if (mobile.matches && snap === 0) setSnap(1);
    },
  };
}
