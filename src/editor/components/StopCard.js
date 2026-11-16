import { useState } from 'preact/hooks';
import { html } from './html.js';
import { trips, updateTrip, structural, showModal, closeModal, config, toast } from '../state/index.js';
import { findStop, autofillLocation, moveStop, deleteStop } from '../core/editing.js';
import { getPosition } from '../core/places.js';
import { Field, Menu, StarInput, AutoTextarea, Chips, memo } from './controls.js';
import { MapPicker } from './MapPicker.js';
import { formatMinutes } from '../../shared/format.js';

const chipMinutes = (n) => formatMinutes(n).replace(/ min$/, '');

function patchStop(tripId, stopId, patch) {
  updateTrip(tripId, (t) => {
    Object.assign(findStop(t, stopId).stop, patch);
    autofillLocation(t);
  });
}

/** "Move to…" modal: Top or Bottom of any section. Reads the trip at click time. */
function openMoveTo(tripId, stopId) {
  const trip = trips.value.get(tripId)?.trip;
  if (!trip) return;
  const act = (sectionId, index) => {
    closeModal();
    structural(tripId, 'Moved.', (t) => moveStop(t, stopId, sectionId, index));
  };
  showModal(
    () =>
      html`<ul class="trip-list">${trip.sections.map(
        (s, i) => html`<li class="trip-row" key=${s.id}>
          <span class="trip-link"><span class="trip-title">${s.title || `Section ${i + 1}`}</span></span>
          <button class="btn btn-small" onClick=${() => act(s.id, 0)}>Top</button>
          <button class="btn btn-small" onClick=${() => act(s.id, Infinity)}>Bottom</button>
        </li>`,
      )}</ul>`,
    { title: 'Move to…' },
  );
}

function StopForm({ tripId, stop, isRoute }) {
  const [details, setDetails] = useState(false);
  const set = (patch) => patchStop(tripId, stop.id, patch);
  const num = (key) => (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v)) set({ [key]: v });
  };
  const presets = config.value.time_presets;

  async function useMyLocation() {
    try {
      const p = await getPosition();
      set({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), coords_source: 'device' });
    } catch {
      toast(navigator.geolocation ? 'Could not get your location' : 'Location is not available on this device');
    }
  }

  return html`<div class="stop-form compact">
    <${Field} label="Name"><input type="text" value=${stop.name} onInput=${(e) => set({ name: e.target.value })} /><//>
    <${Field} label="Note (Markdown)"><${AutoTextarea} minRows=${2} value=${stop.note} onInput=${(note) => set({ note })} /><//>

    <div class="rt-row">
      <div class="field"><span>Rating</span><${StarInput} value=${stop.rating} onChange=${(rating) => set({ rating })} /></div>
      <div class="field"><span>Time at this stop (minutes)</span>
        <div class="time-row">
          <${Chips} options=${presets} value=${stop.minutes} onChange=${(minutes) => set({ minutes })} format=${chipMinutes} />
          <input class="min-input" type="number" inputmode="numeric" min="5" step="5" placeholder="Custom" aria-label="Custom minutes" value=${stop.minutes ?? ''}
            onChange=${(e) => { const v = parseInt(e.target.value, 10); set({ minutes: v > 0 ? v : null }); }} />
          ${stop.minutes >= 60 && html`<span class="hint">${formatMinutes(stop.minutes)}</span>`}
        </div>
      </div>
    </div>
    ${isRoute && html`<label class="check"><input type="checkbox" checked=${stop.off_route === true} onChange=${(e) => set({ off_route: e.target.checked ? true : undefined })} /> <span>Recommended, but not on the route</span></label>`}

    <button type="button" class="details-toggle" aria-expanded=${details} onClick=${() => setDetails(!details)}>
      <span>${details ? '▾' : '▸'} Address and location</span>
    </button>
    ${details && html`<div class="details">
      <${Field} label="Address"><input type="text" value=${stop.address} onInput=${(e) => set({ address: e.target.value })} /><//>
      <div class="grid2">
        <${Field} label="City"><input type="text" autocomplete="off" value=${stop.city} onInput=${(e) => set({ city: e.target.value })} /><//>
        <${Field} label="Region"><input type="text" autocomplete="off" value=${stop.region} onInput=${(e) => set({ region: e.target.value })} /><//>
        <${Field} label="Country"><input type="text" autocomplete="off" value=${stop.country} onInput=${(e) => set({ country: e.target.value })} /><//>
        <${Field} label="Country code"><input type="text" autocomplete="off" maxlength="2" value=${stop.country_code} onInput=${(e) => set({ country_code: e.target.value.toUpperCase() })} /><//>
        <${Field} label="Latitude"><input type="number" step="any" value=${stop.lat} onChange=${num('lat')} /><//>
        <${Field} label="Longitude"><input type="number" step="any" value=${stop.lng} onChange=${num('lng')} /><//>
      </div>
      <div class="row">
        <button type="button" class="btn btn-small" onClick=${useMyLocation}>Use my location</button>
        <button type="button" class="btn btn-small" onClick=${() => showModal(() => html`<${MapPicker} lat=${stop.lat} lng=${stop.lng} onPick=${(p) => set({ ...p, coords_source: 'pin' })} />`, { title: 'Choose location' })}>Pick on map</button>
      </div>
      <div class="field"><span>Google place</span>
        <div class="row"><code>${stop.place_id || 'none'}</code>${stop.place_id && html`<button type="button" class="link-btn" onClick=${() => set({ place_id: null })}>Clear</button>`}</div>
      </div>
    </div>`}

    <${Field} label="Leg to next stop"><input type="text" placeholder="3 min walk" value=${stop.leg_to_next ?? ''} onInput=${(e) => set({ leg_to_next: e.target.value || null })} /><//>
  </div>`;
}

/**
 * One stop in the trip editor: summary row (drag handle, label, name, badges, menu) and, when open, its form.
 * Memoized: re-renders only when this stop object, its label or reorder mode change.
 */
export const StopCard = memo(function StopCard({ tripId, stop, label, reorder, isRoute }) {
  const [open, setOpen] = useState(false);
  const expanded = open && !reorder;
  return html`<li class="stop-card" data-id=${stop.id}>
    <div class="stop-summary">
      <span class="drag drag-stop" aria-hidden="true">⠿</span>
      <button type="button" class="open" aria-expanded=${expanded} onClick=${() => setOpen(!open)}>
        <span class="stop-num">${label}</span>
        <span class="stop-name">${stop.name || 'Unnamed stop'}</span>
        ${stop.minutes > 0 && html`<span class="badge stop-meta">${formatMinutes(stop.minutes)}</span>`}
        ${stop.off_route === true && html`<span class="badge stop-meta off">Off route</span>`}
      </button>
      <${Menu} label=${`Actions for ${stop.name}`}>
        <button role="menuitem" onClick=${() => openMoveTo(tripId, stop.id)}>Move to…</button>
        <button role="menuitem" class="danger" onClick=${() => structural(tripId, 'Deleted.', (t) => deleteStop(t, stop.id))}>Delete stop</button>
      <//>
    </div>
    ${expanded && html`<${StopForm} tripId=${tripId} stop=${stop} isRoute=${isRoute} />`}
  </li>`;
});
