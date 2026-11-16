/** A boolean remembered per trip in localStorage (private mode and blocked storage fall back to `fallback`). */
export function persistedFlag(key, fallback) {
  let value = fallback;
  try {
    const v = localStorage.getItem(key);
    if (v === 'true' || v === 'false') value = v === 'true';
  } catch {}
  return {
    get: () => value,
    set(next) {
      value = next;
      try {
        localStorage.setItem(key, String(next));
      } catch {}
    },
  };
}
