import { loadMaps } from '../shared/maps-loader.js';
import { COLORS } from '../shared/theme.js';

const { mapsKey, mapId } = document.body.dataset;
const buttons = [...document.querySelectorAll('.country')];
const groups = [...document.querySelectorAll('.group[data-country]')];
const cards = new Map([...document.querySelectorAll('.card[data-trip]')].map((c) => [c.dataset.trip, c]));
let mapView = null;
let current = '';

function select(country, { updateHash = true } = {}) {
  current = groups.some((g) => g.dataset.country === country) ? country : '';
  buttons.forEach((b) => {
    const on = b.dataset.country === current;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  groups.forEach((g) => {
    g.hidden = Boolean(current) && g.dataset.country !== current;
  });
  if (updateHash) history.replaceState(null, '', current ? `#${encodeURIComponent(current)}` : location.pathname + location.search);
  mapView?.focus(current);
}

buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.country)));
if (buttons.length) select(decodeURIComponent(location.hash.slice(1)), { updateHash: false });

async function initMap() {
  const el = document.getElementById('world-map');
  // The map only shows on desktop (see site.css); skip loading Google Maps on mobile.
  if (!el || !mapsKey || !matchMedia('(min-width: 900px)').matches) return;
  const pins = JSON.parse(document.getElementById('trip-pins').textContent);
  const importLibrary = loadMaps(mapsKey);
  const { Map: GoogleMap } = await importLibrary('maps');
  const { LatLngBounds } = await importLibrary('core');
  const { AdvancedMarkerElement, PinElement } = await importLibrary('marker');
  const map = new GoogleMap(el, {
    mapId: mapId || 'DEMO_MAP_ID',
    center: { lat: 20, lng: 0 },
    zoom: 2,
    minZoom: 1,
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'cooperative',
  });

  const entries = pins.map((pin) => {
    const marker = new AdvancedMarkerElement({ map, position: { lat: pin.lat, lng: pin.lng }, title: pin.title });
    const entry = { pin, marker, card: cards.get(pin.path), hovered: false };
    marker.addEventListener('gmp-click', () => {
      location.href = pin.path;
    });
    marker.element.addEventListener('mouseenter', () => hover(entry, true));
    marker.element.addEventListener('mouseleave', () => hover(entry, false));
    return entry;
  });
  const byPath = new Map(entries.map((e) => [e.pin.path, e]));

  // Pins of the selected country stand out; the others fade back.
  function paint(entry) {
    const inCountry = !current || entry.pin.country === current;
    const strong = entry.hovered;
    entry.marker.content = new PinElement({
      background: strong ? COLORS.ink : inCountry ? COLORS.accent : COLORS.track,
      borderColor: COLORS.white,
      glyphColor: COLORS.white,
      scale: strong ? 0.9 : inCountry ? 0.6 : 0.45,
    });
    entry.marker.zIndex = strong ? 10 : inCountry ? 1 : 0;
    entry.card?.classList.toggle('hover', strong);
  }
  function hover(entry, on) {
    entry.hovered = on;
    paint(entry);
  }

  mapView = {
    focus(country) {
      entries.forEach(paint);
      const shown = entries.filter((e) => !country || e.pin.country === country);
      if (!shown.length) return;
      if (shown.length === 1) {
        map.setCenter(shown[0].marker.position);
        map.setZoom(6);
        return;
      }
      const bounds = new LatLngBounds();
      shown.forEach((e) => bounds.extend(e.marker.position));
      map.fitBounds(bounds, 30);
    },
  };
  mapView.focus(current);

  const list = document.querySelector('.trips-col');
  const target = (e) => byPath.get(e.target.closest?.('.card[data-trip]')?.dataset.trip);
  if (matchMedia('(hover: hover)').matches) {
    list.addEventListener('mouseover', (e) => target(e) && hover(target(e), true));
    list.addEventListener('mouseout', (e) => target(e) && hover(target(e), false));
  }
  list.addEventListener('focusin', (e) => target(e) && hover(target(e), true));
  list.addEventListener('focusout', (e) => target(e) && hover(target(e), false));
}

initMap().catch((e) => {
  console.error('World map failed to load', e);
  document.getElementById('world-map')?.remove();
});
