import { html } from './ui.js';
import { useState, useEffect, useRef } from 'preact/hooks';
import { trips, config, settings, saveRecord, updateTrip, setActive, doSync, navigate, toast } from './state.js';
import { StarInput, Chips } from './fields.js';
import { getPosition, nearby, textSearch, reverseGeocode, parseCoordinates, LocationError } from '../places.js';
import { addCapturedStop, newCaptureTrip } from '../capture.js';
import { newRecord, stopCount } from '../sync.js';
import { formatMinutes } from '../../shared/format.js';

const NEW = '__new__';

export function Capture({ addTo }) {
  const [addToTrip, addToSection] = (addTo || '').split('~');
  const searchMode = Boolean(addToSection);
  const cfg = config.value;
  const hasKey = Boolean(cfg.google_maps_api_key);
  const all = [...trips.value.values()].sort((a, b) => (a.trip.title || '').localeCompare(b.trip.title || ''));
  const firstId = addToTrip || settings.value.active_trip_id;
  const [tripId, setTripId] = useState(trips.value.has(firstId) ? firstId : all[0]?.trip.id || NEW);

  const [pos, setPos] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [extra, setExtra] = useState({ minutes: null, rating: null, note: '', name: '' });
  const [loading, setLoading] = useState('');
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef();

  function pick(list, i) {
    setSelected(i);
    setExtra({ minutes: null, rating: null, note: '', name: list[i]?.name || '' });
  }
  const choose = (list) => {
    setItems(list);
    pick(list, list.length ? 0 : null);
  };

  const back = () => navigate(addToTrip && trips.value.has(addToTrip) ? `#/trip/${addToTrip}` : '#/');

  async function locate() {
    setError(null);
    setLoading('Finding your location…');
    try {
      const p = await getPosition();
      setPos(p);
      if (hasKey) {
        setLoading('Looking for places nearby…');
        choose(await nearby(p, cfg));
      }
    } catch (e) {
      setError(e instanceof LocationError ? { message: e.message, location: true } : { message: `Search failed: ${e.message}` });
    } finally {
      setLoading('');
    }
  }

  useEffect(() => {
    if (!searchMode) locate();
  }, []);

  async function search(e) {
    e.preventDefault();
    if (!query.trim() || !hasKey) return;
    setError(null);
    setLoading('Searching…');
    try {
      const point = parseCoordinates(query);
      if (point) {
        choose([{ ...(await reverseGeocode(point, cfg, 'pin')), distance: 0 }]);
        return;
      }
      const found = await textSearch(query.trim(), pos, cfg);
      choose(found);
      if (!found.length) setError({ message: 'No places found.' });
    } catch (err) {
      setError({ message: `Search failed: ${err.message}` });
    } finally {
      setLoading('');
    }
  }

  async function dropPin() {
    setError(null);
    setLoading('Finding your location…');
    try {
      const p = pos || (await getPosition());
      setPos(p);
      const fields = hasKey
        ? await reverseGeocode(p, cfg)
        : { place_id: null, name: 'Dropped pin', address: '', city: '', region: '', country: '', country_code: '', lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), coords_source: 'device' };
      choose([{ ...fields, distance: 0 }, ...items.filter((i) => i.place_id)]);
    } catch (e) {
      setError(e instanceof LocationError ? { message: e.message, location: true } : { message: `Could not drop a pin: ${e.message}` });
    } finally {
      setLoading('');
    }
  }

  const rec = trips.value.get(tripId);
  const stopNumber = rec ? stopCount(rec.trip) + 1 : 1;
  const area = items.find((i) => i.city)?.city || (items[0]?.address || '').split(',').slice(-2)[0]?.trim() || '';

  async function add() {
    const item = items[selected];
    if (!item) return;
    const fields = { ...item, name: extra.name.trim() || item.name, minutes: extra.minutes, rating: extra.rating, note: extra.note };
    let id = tripId;
    if (id === NEW) {
      const trip = newCaptureTrip(fields, cfg);
      await saveRecord(newRecord(trip));
      id = trip.id;
      setActive(id);
    }
    updateTrip(id, (t) => addCapturedStop(t, fields, { sectionId: id === addToTrip ? addToSection : null }));
    toast('Added. Sync when ready.', { label: 'Sync', fn: () => doSync(id) }, 6000);
    back();
  }


  return html`<section class="screen capture">
    <div class="row space"><h1>${searchMode ? 'Add a stop' : 'Add place here'}</h1><button class="btn btn-small" onClick=${back}>Close</button></div>
    <label class="field"><span>Adding to</span>
      <select value=${tripId} onChange=${(e) => setTripId(e.target.value)} disabled=${Boolean(addToSection)}>
        ${all.map((r) => html`<option value=${r.trip.id}>${r.trip.title || 'Untitled trip'}</option>`)}
        <option value=${NEW}>New trip…</option>
      </select>
    </label>
    ${pos && html`<p class="hint">Near ${area || 'you'} · ±${pos.accuracy} m</p>`}
    ${!hasKey && html`<p class="banner">Add a Google Maps key in <a href="#/settings">Settings</a> to see nearby places. You can still drop a pin at your location.</p>`}
    ${loading && html`<p class="hint" role="status">${loading}</p>`}
    ${error && html`<div class="banner" role="alert">${error.message}
      ${error.location && html`<div class="row"><button class="link-btn" onClick=${locate}>Retry</button><button class="link-btn" onClick=${() => searchRef.current?.focus()}>Search instead</button></div>`}</div>`}

    <div class="suggestions" role="radiogroup" aria-label="Nearby places">
      ${items.map(
        (it, i) => html`<div class="suggestion" key=${it.place_id || `${it.lat},${it.lng}`} role="radio" aria-checked=${selected === i} tabindex="0"
          onClick=${() => pick(items, i)} onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), pick(items, i))}>
          <span class="name">${it.name}</span>
          <span class="meta">${[it.type, it.distance != null && it.distance > 0 ? `${it.distance} m` : ''].filter(Boolean).join(' · ') || it.address}</span>
          ${selected === i && html`<div class="extra" onClick=${(e) => e.stopPropagation()}>
            <label class="field"><span>Name</span><input type="text" value=${extra.name} onInput=${(e) => setExtra({ ...extra, name: e.target.value })} /></label>
            <div class="field"><span>Time here</span><${Chips} options=${cfg.time_presets} value=${extra.minutes} onChange=${(minutes) => setExtra({ ...extra, minutes })} format=${formatMinutes} /></div>
            <div class="field"><span>Rating</span><${StarInput} value=${extra.rating} onChange=${(rating) => setExtra({ ...extra, rating })} /></div>
            <label class="field"><span>Note</span><input type="text" value=${extra.note} onInput=${(e) => setExtra({ ...extra, note: e.target.value })} /></label>
          </div>`}
        </div>`,
      )}
    </div>

    ${hasKey && html`<form class="row" onSubmit=${search}>
      <input ref=${searchRef} class="search" type="search" placeholder="Not listed? Search a place or paste coordinates" aria-label="Search a place" value=${query} onInput=${(e) => setQuery(e.target.value)} style="flex:1" />
      <button class="btn" type="submit">Search</button>
    </form>`}
    <div class="capture-actions">
      ${searchMode && html`<button class="btn" onClick=${locate}>Nearby places</button>`}
      <button class="btn" onClick=${dropPin}>Drop pin at my location</button>
      <button class="btn btn-primary" disabled=${selected === null} onClick=${add}>Add as stop ${stopNumber}</button>
    </div>
  </section>`;
}
