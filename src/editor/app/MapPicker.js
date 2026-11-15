import { html } from './ui.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { loadMaps } from '../../shared/maps-loader.js';
import { config, closeModal } from './state.js';

/** Modal body: drag a pin to choose coordinates. onPick({ lat, lng }). */
export function MapPicker({ lat, lng, onPick }) {
  const el = useRef();
  const [pos, setPos] = useState({ lat, lng });
  const key = config.value.google_maps_api_key;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    (async () => {
      const importLibrary = loadMaps(key);
      const { Map } = await importLibrary('maps');
      const { AdvancedMarkerElement } = await importLibrary('marker');
      if (cancelled) return;
      const map = new Map(el.current, { center: pos, zoom: lat || lng ? 16 : 2, mapId: config.value.google_maps_map_id || 'DEMO_MAP_ID', disableDefaultUI: true, zoomControl: true });
      const marker = new AdvancedMarkerElement({ map, position: pos, gmpDraggable: true });
      const set = (p) => setPos({ lat: +p.lat().toFixed(6), lng: +p.lng().toFixed(6) });
      marker.addListener('dragend', () => set(marker.position));
      map.addListener('click', (e) => {
        marker.position = e.latLng;
        set(e.latLng);
      });
    })().catch(() => {});
    return () => (cancelled = true);
  }, []);

  if (!key) return html`<p class="hint">Add a Google Maps key in Settings to use the map picker.</p>`;
  return html`<div class="picker-map" ref=${el}></div>
    <p class="hint">Drag the pin or tap the map. ${pos.lat}, ${pos.lng}</p>
    <div class="modal-actions"><button class="btn" onClick=${closeModal}>Cancel</button><button class="btn btn-primary" onClick=${() => { onPick(pos); closeModal(); }}>Use this location</button></div>`;
}
