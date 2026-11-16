import { html } from './ui.js';
import { useState } from 'preact/hooks';
import { updateTrip, structural, showModal, closeModal, config, toast } from './state.js';
import { findStop, autofillLocation, moveStop, deleteStop } from '../editing.js';
import { Field, Menu, StarInput, AutoTextarea, Chips } from './fields.js';
import { MapPicker } from './MapPicker.js';
import { renderStarCompact } from '../../shared/rating.js';
import { formatMinutes } from '../../shared/format.js';

export function patchStop(tripId, stopId, patch) {
  updateTrip(tripId, (t) => {
    Object.assign(findStop(t, stopId).stop, patch);
    autofillLocation(t);
  });
}

export function openMoveTo(trip, stopId) {
  const act = (sectionId, index) => {
    closeModal();
    structural(trip.id, 'Moved.', (t) => moveStop(t, stopId, sectionId, index));
  };
  showModal(
    () =>
      html`<ul class="trip-list">${trip.sections.map(
        (s, i) => html`<li class="trip-row" key=${s.id}>
          <span class="trip-link"><span class="trip-title">${String.fromCharCode(65 + i)}${s.title ? ` · ${s.title}` : ''}</span></span>
          <button class="btn btn-small" onClick=${() => act(s.id, 0)}>Top</button>
          <button class="btn btn-small" style="margin-left:8px" onClick=${() => act(s.id, Infinity)}>Bottom</button>
        </li>`,
      )}</ul>`,
    { title: 'Move to…' },
  );
}

function StopForm({ trip, stop }) {
  const tripId = trip.id;
  const set = (patch) => patchStop(tripId, stop.id, patch);
  const num = (key) => (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v)) set({ [key]: v });
  };
  const presets = config.value.time_presets;

  function useMyLocation() {
    if (!navigator.geolocation) return toast('Location is not available on this device');
    navigator.geolocation.getCurrentPosition(
      (pos) => set({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6), coords_source: 'device' }),
      () => toast('Could not get your location'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  }

  const [details, setDetails] = useState(false);
  const isRoute = findStop(trip, stop.id)?.section.style === 'route';
  const place = [stop.address, stop.city].filter(Boolean)[0] || 'not set';

  return html`<div class="stop-form compact">
    <${Field} label="Name"><input type="text" value=${stop.name} onInput=${(e) => set({ name: e.target.value })} /><//>
    <${Field} label="Note (Markdown)"><${AutoTextarea} minRows=${2} value=${stop.note} onInput=${(note) => set({ note })} /><//>

    <div class="rt-row">
      <div class="field"><span>Rating</span><${StarInput} value=${stop.rating} onChange=${(rating) => set({ rating })} /></div>
      <div class="field"><span>Time at this stop</span>
        <div class="time-row">
          <${Chips} options=${presets} value=${stop.minutes} onChange=${(minutes) => set({ minutes })} format=${formatMinutes} />
          <input class="min-input" type="number" inputmode="numeric" min="5" step="5" placeholder="min" aria-label="Custom minutes" value=${stop.minutes ?? ''}
            onChange=${(e) => { const v = parseInt(e.target.value, 10); set({ minutes: v > 0 ? v : null }); }} />
          ${stop.minutes >= 60 && html`<span class="hint">${formatMinutes(stop.minutes)}</span>`}
        </div>
      </div>
    </div>
    ${isRoute && html`<label class="check"><input type="checkbox" checked=${stop.off_route === true} onChange=${(e) => set({ off_route: e.target.checked ? true : undefined })} /> <span>Recommended, but not on the route</span></label>`}

    <button type="button" class="details-toggle" aria-expanded=${details} onClick=${() => setDetails(!details)}>
      <span>${details ? '▾' : '▸'} Address and location</span><span class="hint">${details ? '' : place}</span>
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

export function StopCard({ trip, stop, label, reorder }) {
  const [open, setOpen] = useState(false);
  const expanded = open && !reorder;
  return html`<li class="stop-card" data-id=${stop.id}>
    <div class="stop-summary">
      <span class="drag drag-stop" aria-hidden="true">⠿</span>
      <button type="button" class="open" aria-expanded=${expanded} onClick=${() => setOpen(!open)}>
        <span class="stop-num">${label}</span>
        <span class="stop-name">${stop.name || 'Unnamed stop'}</span>
        ${stop.off_route && html`<span class="badge">Off route</span>`}
        ${stop.minutes && html`<span class="badge">${formatMinutes(stop.minutes)}</span>`}
        ${stop.rating && html`<span dangerouslySetInnerHTML=${{ __html: renderStarCompact(stop.rating) }} />`}
      </button>
      <${Menu} label=${`Actions for ${stop.name}`}>
        <button role="menuitem" onClick=${() => openMoveTo(trip, stop.id)}>Move to…</button>
        <button role="menuitem" class="danger" onClick=${() => structural(trip.id, 'Deleted.', (t) => deleteStop(t, stop.id))}>Delete stop</button>
      <//>
    </div>
    ${expanded && html`<${StopForm} trip=${trip} stop=${stop} />`}
  </li>`;
}
