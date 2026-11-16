import { html } from './ui.js';
import { useState } from 'preact/hooks';
import { Field } from './fields.js';
import { findWikipediaPhoto } from '../../shared/wikipedia.js';
import { photoCredit } from '../../shared/render/photo.js';

/** Pick the trip's cover photo from a Wikipedia article's lead image. */
export function PhotoField({ trip, onChange }) {
  const loc = trip.location;
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });
  const term = query.trim() || loc.city || loc.region || loc.country;

  async function find() {
    setState({ busy: true, error: '' });
    try {
      const photo = await findWikipediaPhoto(term);
      if (!photo) setState({ busy: false, error: `No image on the Wikipedia article "${term}". Try another title.` });
      else {
        onChange(photo);
        setState({ busy: false, error: '' });
      }
    } catch (e) {
      setState({ busy: false, error: e.message || 'Could not reach Wikipedia' });
    }
  }

  return html`<div class="field"><span>Photo</span>
    ${trip.photo && html`<div class="row" style="gap:12px;align-items:flex-start;margin-bottom:8px">
      <img src=${trip.photo.thumb || trip.photo.url} alt="" width="96" height="96" style="object-fit:cover;border-radius:8px" />
      <div class="grow"><small dangerouslySetInnerHTML=${{ __html: photoCredit(trip.photo) }}></small></div>
      <button type="button" class="btn btn-small" onClick=${() => onChange(null)}>Remove</button>
    </div>`}
    <div class="row" style="gap:8px">
      <input type="text" class="grow" aria-label="Wikipedia article" placeholder=${term ? `Wikipedia article (default: ${term})` : 'Wikipedia article, e.g. Pisa'} value=${query} onInput=${(e) => setQuery(e.target.value)} />
      <button type="button" class="btn btn-small" disabled=${state.busy || !term} onClick=${find}>${state.busy ? 'Searching…' : trip.photo ? 'Replace' : 'Find photo'}</button>
    </div>
    ${state.error && html`<small role="alert" class="danger">${state.error}</small>`}
  </div>`;
}
