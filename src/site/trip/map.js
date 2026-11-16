import { loadMaps } from '../../shared/maps-loader.js';
import { COLORS } from '../../shared/theme.js';
import { mobile } from './dom.js';

const ROUTE_LINE = {
  strokeOpacity: 0,
  strokeColor: COLORS.accent,
  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: COLORS.accent, scale: 3 }, offset: '0', repeat: '14px' }],
};

/**
 * Google map for the trip page. Markers are created once per stop and reused: `render` only toggles
 * visibility and relabels, and selection/hover rebuild just the affected pins.
 * opts: { el, apiKey, mapId, center, onMarkerClick(id), bottomPadding() }
 */
export async function createMapView({ el, apiKey, mapId, center, onMarkerClick, bottomPadding }) {
  const importLibrary = loadMaps(apiKey);
  const { Map, Polyline } = await importLibrary('maps');
  const { AdvancedMarkerElement, PinElement } = await importLibrary('marker');
  const map = new Map(el, { mapId, center, zoom: 13, disableDefaultUI: true, zoomControl: !mobile.matches, gestureHandling: 'greedy' });

  /** id -> { marker, label, off, selected, hovered } */
  const markers = new globalThis.Map();
  let lines = [];
  let points = [];
  let selectedId = null;
  let locationMarker = null;

  function paint(m) {
    const strong = m.selected || m.hovered;
    m.marker.content = new PinElement({
      background: strong ? COLORS.ink : m.off ? COLORS.white : COLORS.accent,
      borderColor: strong ? COLORS.white : m.off ? COLORS.muted : COLORS.white,
      glyph: m.label,
      glyphColor: strong ? COLORS.white : m.off ? COLORS.muted : COLORS.white,
      scale: strong ? 1.3 : 1,
    }).element;
    m.marker.zIndex = m.selected ? 10 : 0;
  }

  function markerFor(entry) {
    const id = entry.stop.id;
    let m = markers.get(id);
    if (!m) {
      const marker = new AdvancedMarkerElement({ position: { lat: entry.stop.lat, lng: entry.stop.lng }, title: entry.stop.name });
      marker.addListener('click', () => onMarkerClick(id));
      m = { marker, label: null, off: null, selected: id === selectedId, hovered: false };
      markers.set(id, m);
    }
    if (m.label !== entry.label || m.off !== entry.offRoute) {
      m.label = entry.label;
      m.off = entry.offRoute;
      paint(m);
    }
    return m;
  }

  const view = {
    /** sections: visibleStops() output. */
    render(sections) {
      lines.forEach((l) => l.setMap(null));
      lines = [];
      points = [];
      const shown = new Set();
      for (const sec of sections) {
        const path = [];
        for (const entry of sec.stops) {
          if (!entry.visible) continue;
          const m = markerFor(entry);
          if (m.marker.map !== map) m.marker.map = map;
          shown.add(entry.stop.id);
          const p = { lat: entry.stop.lat, lng: entry.stop.lng };
          points.push(p);
          if (!entry.offRoute) path.push(p);
        }
        if (sec.section.style === 'route' && path.length > 1) lines.push(new Polyline({ map, path, ...ROUTE_LINE }));
      }
      markers.forEach((m, id) => !shown.has(id) && m.marker.map && (m.marker.map = null));
      view.fit();
    },
    fit() {
      if (!points.length) return;
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      const bottom = mobile.matches ? bottomPadding() + 20 : 40;
      map.fitBounds(bounds, { top: 60, left: 40, right: 40, bottom });
      if (points.length === 1) map.setZoom(15);
    },
    highlight(id) {
      const prev = markers.get(selectedId);
      selectedId = id;
      if (prev) {
        prev.selected = false;
        paint(prev);
      }
      const next = markers.get(id);
      if (next) {
        next.selected = true;
        paint(next);
      }
    },
    hover(id, on) {
      const m = markers.get(id);
      if (!m || id === selectedId || m.hovered === on) return;
      m.hovered = on;
      paint(m);
    },
    showLocation(position) {
      if (locationMarker) {
        locationMarker.position = position;
        return;
      }
      const dot = document.createElement('div');
      dot.className = 'loc-dot';
      locationMarker = new AdvancedMarkerElement({ map, position, content: dot, title: 'You are here' });
    },
  };
  return view;
}
