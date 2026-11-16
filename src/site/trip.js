import { visibleStops } from '../shared/visible.js';
import { openInMaps, directionsUrl } from '../shared/maps-links.js';
import { formatMinutes, plural } from '../shared/format.js';
import { loadMaps } from '../shared/maps-loader.js';

const ACCENT = '#C2410C';
const INK = '#1A1D21';
const data = JSON.parse(document.getElementById('trip-data').textContent);
const body = document.body;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const multi = data.sections.length > 1;
const rows = new Map($$('.stop').map((el) => [el.dataset.stop, el]));
const legs = new Map($$('.leg').map((el) => [el.dataset.after, el]));
const sectionEls = new Map($$('.sec').map((el) => [el.dataset.section, el]));
const mobile = window.matchMedia('(max-width: 899.98px)');

const storageKey = `tripbook.show_low.${data.id}`;
function readShowLow() {
  try {
    const v = localStorage.getItem(storageKey);
    if (v === 'true' || v === 'false') return v === 'true';
  } catch {}
  return body.dataset.showLow === 'true';
}

const toggle = $('#low-toggle');
const state = { tab: 'all', showLow: readShowLow(), selected: null };
let mapView = null;

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2500);
}

function scope(results) {
  return state.tab === 'all' ? results : results.filter((r) => r.section.id === state.tab);
}

function update() {
  const results = visibleStops(data, { showLow: state.showLow });
  const shown = scope(results);
  body.dataset.tab = state.tab;
  body.classList.toggle('hide-stars', Boolean(toggle) && !state.showLow);

  for (const sec of results) {
    const el = sectionEls.get(sec.section.id);
    el.hidden = state.tab !== 'all' && state.tab !== sec.section.id;
    $('.sec-count', el) && ($('.sec-count', el).textContent = plural(sec.count, 'stop'));
    const time = $('.sec-time', el);
    if (time) {
      time.textContent = formatMinutes(sec.minutes);
      time.hidden = !sec.minutes;
    }
    const links = $('.route-links', el);
    if (links) {
      const dir = directionsUrl(sec.routeStops);
      const urls = !dir ? [] : Array.isArray(dir) ? dir : [dir];
      links.innerHTML = '';
      urls.forEach((u, i) => {
        const a = document.createElement('a');
        a.className = 'route-link';
        a.href = u;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = urls.length > 1 ? `Part ${i + 1}` : 'Route in Google Maps';
        links.append(a);
      });
    }
    sec.stops.forEach((entry, i) => {
      const row = rows.get(entry.stop.id);
      row.hidden = !entry.visible;
      const label = state.tab === 'all' && multi ? entry.label : String(entry.number || '');
      row.dataset.label = label;
      $('.badge-num', row).textContent = entry.offRoute ? '•' : label;
      const leg = legs.get(entry.stop.id);
      const next = sec.stops[i + 1];
      if (leg) leg.hidden = !(entry.visible && next?.visible && !entry.offRoute && !next.offRoute);
    });
  }

  const visible = shown.flatMap((s) => s.visibleStops);
  const all = results.flatMap((s) => s.visibleStops);
  $$('[data-stop-count]').forEach((el) => (el.textContent = plural(all.length, 'stop')));
  const total = results.reduce((n, s) => n + s.minutes, 0);
  $$('[data-total-time]').forEach((el) => (el.textContent = formatMinutes(total)));
  $$('[data-total-wrap]').forEach((el) => (el.hidden = !total));

  const maps = openInMaps(visible, shown.flatMap((s) => s.routeStops));
  $$('[data-open-maps]').forEach((a) => {
    a.hidden = !maps.url;
    if (maps.url) a.href = maps.url;
  });

  if (state.selected && rows.get(state.selected)?.hidden) select(null);
  mapView?.render(shown);
  updateMore();
}

function select(id, { scroll = false } = {}) {
  state.selected = id;
  rows.forEach((el, sid) => el.classList.toggle('selected', sid === id));
  mapView?.highlight(id);
  if (id && scroll) rows.get(id).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ---------- low-rated toggle ---------- */
if (toggle) {
  toggle.checked = state.showLow;
  toggle.addEventListener('change', () => {
    state.showLow = toggle.checked;
    try {
      localStorage.setItem(storageKey, String(state.showLow));
    } catch {}
    update();
  });
}

rows.forEach((el, id) => {
  el.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    select(id);
    if (mobile.matches && sheet.snap === 0) sheet.setSnap(1);
  });
  el.addEventListener('mouseenter', () => !mobile.matches && mapView?.hover(id, true));
  el.addEventListener('mouseleave', () => mapView?.hover(id, false));
  el.addEventListener('focusin', () => mapView?.hover(id, true));
  el.addEventListener('focusout', () => mapView?.hover(id, false));
});

/* ---------- share ---------- */
$('#share')?.addEventListener('click', async () => {
  const url = location.href;
  try {
    if (navigator.share) return await navigator.share({ title: document.title, url });
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {}
});

/* ---------- bottom sheet ---------- */
const sheetEl = $('#sheet');
const SNAPS = [0.28, 0.55, 0.9];
const sheet = {
  snap: 0,
  height() {
    return sheetEl.getBoundingClientRect().height;
  },
  setSnap(i) {
    this.snap = i;
    sheetEl.style.height = mobile.matches ? `${SNAPS[i] * window.innerHeight}px` : '';
    mapView?.fit();
  },
};
sheet.setSnap(0);
mobile.addEventListener('change', () => {
  sheet.setSnap(sheet.snap);
  updateMore();
});

const handle = $('#sheet-handle');
let drag = null;
function startDrag(e) {
  if (!mobile.matches || e.target.closest('a, input, label')) return;
  drag = { y: e.clientY, h: sheet.height(), moved: false };
  sheetEl.setPointerCapture?.(e.pointerId);
  sheetEl.classList.add('dragging');
}
function moveDrag(e) {
  if (!drag) return;
  const dy = drag.y - e.clientY;
  if (Math.abs(dy) > 4) drag.moved = true;
  sheetEl.style.height = `${Math.min(SNAPS[2] * window.innerHeight, Math.max(SNAPS[0] * window.innerHeight, drag.h + dy))}px`;
}
function endDrag() {
  if (!drag) return;
  const moved = drag.moved;
  drag = null;
  sheetEl.classList.remove('dragging');
  if (!moved) return;
  const ratio = sheet.height() / window.innerHeight;
  const nearest = SNAPS.reduce((best, s, i) => (Math.abs(s - ratio) < Math.abs(SNAPS[best] - ratio) ? i : best), 0);
  sheet.setSnap(nearest);
}
$('.sheet-top').addEventListener('pointerdown', startDrag);
window.addEventListener('pointermove', moveDrag);
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
handle.addEventListener('click', () => {
  if (drag?.moved) return;
  sheet.setSnap((sheet.snap + 1) % SNAPS.length);
});

/* ---------- clamped notes ---------- */
function updateMore() {
  $$('.clamp').forEach((el) => {
    const existing = el.nextElementSibling?.classList.contains('more') ? el.nextElementSibling : null;
    const overflows = el.scrollHeight > el.clientHeight + 1;
    if (overflows && !existing && !el.classList.contains('expanded')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'more';
      b.textContent = 'More';
      b.addEventListener('click', () => {
        const open = el.classList.toggle('expanded');
        b.textContent = open ? 'Less' : 'More';
      });
      el.after(b);
    } else if (!overflows && existing && !el.classList.contains('expanded')) {
      existing.remove();
    }
  });
}
window.addEventListener('resize', updateMore);

/* ---------- map ---------- */
async function initMap() {
  const el = $('#map');
  const key = body.dataset.mapsKey;
  if (!key) return;
  const importLibrary = loadMaps(key);
  const { Map, Polyline } = await importLibrary('maps');
  const { AdvancedMarkerElement, PinElement } = await importLibrary('marker');
  const first = data.sections.flatMap((s) => s.stops)[0];
  const map = new Map(el, {
    mapId: body.dataset.mapId || 'DEMO_MAP_ID',
    center: first ? { lat: first.lat, lng: first.lng } : { lat: 0, lng: 0 },
    zoom: 13,
    disableDefaultUI: true,
    zoomControl: !mobile.matches,
    gestureHandling: 'greedy',
  });

  let markers = new globalThis.Map();
  let lines = [];
  let current = [];

  const pin = (label, selected) =>
    new PinElement({
      background: selected ? INK : ACCENT,
      borderColor: '#FFFFFF',
      glyph: label,
      glyphColor: '#FFFFFF',
      scale: selected ? 1.3 : 1,
    });

  const api = {
    render(sections) {
      markers.forEach((m) => (m.map = null));
      lines.forEach((l) => l.setMap(null));
      markers = new globalThis.Map();
      lines = [];
      current = [];
      for (const sec of sections) {
        const path = [];
        sec.stops.forEach((entry) => {
          if (!entry.visible) return;
          const label = entry.offRoute ? '•' : rows.get(entry.stop.id).dataset.label;
          const m = new AdvancedMarkerElement({
            map,
            position: { lat: entry.stop.lat, lng: entry.stop.lng },
            content: pin(label, entry.stop.id === state.selected).element,
            title: entry.stop.name,
          });
          m.addListener('click', () => {
            select(entry.stop.id, { scroll: true });
            if (mobile.matches && sheet.snap === 0) sheet.setSnap(1);
          });
          m._label = label;
          markers.set(entry.stop.id, m);
          if (!entry.offRoute) path.push({ lat: entry.stop.lat, lng: entry.stop.lng });
          current.push({ lat: entry.stop.lat, lng: entry.stop.lng });
        });
        if (sec.section.style === 'route' && path.length > 1) {
          lines.push(
            new Polyline({
              map,
              path,
              strokeOpacity: 0,
              strokeColor: ACCENT,
              icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: ACCENT, scale: 3 }, offset: '0', repeat: '14px' }],
            }),
          );
        }
      }
      api.fit();
    },
    fit() {
      if (!current.length) return;
      const bounds = new google.maps.LatLngBounds();
      current.forEach((p) => bounds.extend(p));
      const bottom = mobile.matches ? sheet.height() + 20 : 40;
      map.fitBounds(bounds, { top: 60, left: 40, right: 40, bottom });
      if (current.length === 1) map.setZoom(15);
    },
    highlight(id) {
      markers.forEach((m, sid) => {
        m.content = pin(m._label, sid === id).element;
        m.zIndex = sid === id ? 10 : 0;
      });
    },
    hover(id, on) {
      const m = markers.get(id);
      if (!m || id === state.selected) return;
      m.content = pin(m._label, on).element;
    },
  };
  mapView = api;
  window.__locate = (position) => {
    const dot = document.createElement('div');
    dot.className = 'loc-dot';
    return new AdvancedMarkerElement({ map, position, content: dot, title: 'You are here' });
  };
  update();
}

/* ---------- locate ---------- */
let watching = false;
let locMarker = null;
$('#locate')?.addEventListener('click', () => {
  if (!navigator.geolocation || watching) return;
  watching = true;
  navigator.geolocation.watchPosition(
    (pos) => {
      const position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!window.__locate) return;
      if (locMarker) locMarker.position = position;
      else locMarker = window.__locate(position);
    },
    () => {
      watching = false;
      toast('Location unavailable');
    },
    { enableHighAccuracy: true },
  );
});

update();
initMap().catch(() => toast('Map failed to load'));
