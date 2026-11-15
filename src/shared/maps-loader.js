// Google's dynamic bootstrap loader, wrapped so the key is injected once.
export function loadMaps(key) {
  const g = window.google || (window.google = {});
  if (!g.maps?.importLibrary) {
    ((opts) => {
      let h, a, k;
      const p = 'The Google Maps JavaScript API';
      const c = 'google';
      const l = 'importLibrary';
      const q = '__ib__';
      const m = document;
      const d = g.maps || (g.maps = {});
      const r = new Set();
      const e = new URLSearchParams();
      const u = () =>
        h ||
        (h = new Promise((f, n) => {
          a = m.createElement('script');
          e.set('libraries', [...r] + '');
          for (k in opts) e.set(k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()), opts[k]);
          e.set('callback', c + '.maps.' + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f;
          a.onerror = () => (h = n(Error(p + ' could not load.')));
          m.head.append(a);
        }));
      d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n));
    })({ key, v: 'weekly' });
  }
  return g.maps.importLibrary;
}
