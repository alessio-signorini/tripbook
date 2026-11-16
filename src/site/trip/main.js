/**
 * Trip page entry point. The page is fully rendered by src/shared/render/trip.js; this script makes
 * it interactive: low-rated / off-route switches, selection, mobile sheet, clamped notes, map, share, locate.
 * It reads only the #trip-data JSON (fields listed in CLIENT_STOP_FIELDS) and the rendered DOM.
 */
import { visibleStops } from '../../shared/visible.js';
import { $, mobile, toast, afterFirstPaint } from './dom.js';
import { persistedFlag } from './prefs.js';
import { createList } from './list.js';
import { createSheet } from './sheet.js';
import { watchClamps } from './clamp.js';
import { createMapView } from './map.js';

const data = JSON.parse($('#trip-data').textContent);
const body = document.body;
const lowToggle = $('#low-toggle');
const offToggle = $('#off-toggle');
const showLow = persistedFlag(`tripbook.show_low.${data.id}`, body.dataset.showLow === 'true');
const showOff = persistedFlag(`tripbook.show_off_route.${data.id}`, true);
let selected = null;
let only = null;
let mapView = null;

const list = createList();
const sheet = createSheet($('#sheet'), {
  handle: $('#sheet-handle'),
  grip: $('.sheet-top'),
  scroller: $('#sheet-scroll'),
  onChange: () => mapView?.fit(),
});

function update() {
  const results = visibleStops(data, { showLow: showLow.get(), showOffRoute: showOff.get(), only });
  body.classList.toggle('hide-stars', Boolean(lowToggle) && !showLow.get());
  list.render(results);
  if (selected && list.isHidden(selected)) select(null);
  mapView?.render(results);
}

function select(id, { scroll = false } = {}) {
  selected = id;
  list.setSelected(id, { scroll });
  mapView?.highlight(id);
}

function bindSwitch(input, flag) {
  if (!input) return;
  input.checked = flag.get();
  input.addEventListener('change', () => {
    flag.set(input.checked);
    update();
  });
}
bindSwitch(lowToggle, showLow);
bindSwitch(offToggle, showOff);

document.querySelectorAll('[data-solo]').forEach((btn) => {
  btn.addEventListener('click', () => {
    only = only === btn.dataset.solo ? null : btn.dataset.solo;
    document.querySelectorAll('[data-solo]').forEach((b) => {
      const on = b.dataset.solo === only;
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? 'Show all' : 'Show only this';
    });
    update();
  });
});

list.rows.forEach((el, id) => {
  el.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    select(id);
    sheet.reveal();
  });
  el.addEventListener('mouseenter', () => !mobile.matches && mapView?.hover(id, true));
  el.addEventListener('mouseleave', () => mapView?.hover(id, false));
  el.addEventListener('focusin', () => mapView?.hover(id, true));
  el.addEventListener('focusout', () => mapView?.hover(id, false));
});

$('#share')?.addEventListener('click', async () => {
  const url = location.href;
  try {
    if (navigator.share) return await navigator.share({ title: document.title, url });
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {}
});

let watching = false;
$('#locate')?.addEventListener('click', () => {
  if (!navigator.geolocation || watching) return;
  watching = true;
  navigator.geolocation.watchPosition(
    (pos) => mapView?.showLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => {
      watching = false;
      toast('Location unavailable');
    },
    { enableHighAccuracy: true },
  );
});

async function initMap() {
  const apiKey = body.dataset.mapsKey;
  if (!apiKey) return;
  const first = data.sections.flatMap((s) => s.stops)[0];
  mapView = await createMapView({
    el: $('#map'),
    apiKey,
    mapId: body.dataset.mapId || 'DEMO_MAP_ID',
    center: first ? { lat: first.lat, lng: first.lng } : { lat: 0, lng: 0 },
    onMarkerClick: (id) => {
      select(id, { scroll: true });
      sheet.reveal();
    },
    bottomPadding: () => sheet.visibleHeight(),
  });
  if (selected) mapView.highlight(selected);
  update();
}

update();
watchClamps();
afterFirstPaint(() => initMap().catch(() => toast('Map failed to load')));
