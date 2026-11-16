import { useState } from 'preact/hooks';
import { html } from './html.js';
import { findWikipediaPhoto } from '../../shared/wikipedia.js';
import { photoCredit } from '../../shared/render/photo.js';

/** Pick the trip's cover photo from a Wikipedia article's lead image. */
export function PhotoField({ trip, onChange }) {
  const loc = trip.location;
  const [open, setOpen] = useState(false);
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

  const photo = trip.photo;
  const input = html`<input type="text" class="grow" aria-label="Wikipedia article" placeholder=${term ? `Wikipedia article (default: ${term})` : 'Wikipedia article, e.g. Pisa'} value=${query} onInput=${(e) => setQuery(e.target.value)} />`;
  const search = (label) => html`<button type="button" class="btn btn-small" disabled=${state.busy || !term} onClick=${find}>${state.busy ? 'Searching…' : label}</button>`;
  const author = photo && (photo.author || 'Wikimedia Commons');

  return html`<div class="field">
    <div class="details-toggle no-rule">
      <button type="button" class="toggle-btn" aria-expanded=${open} onClick=${() => setOpen(!open)}>${open ? '▾' : '▸'} Photo</button>
      ${!open && photo && html`<span class="hint">${photo.source_url
        ? html`<a href=${photo.source_url} target="_blank" rel="noopener">${author}</a>`
        : author}</span>`}
    </div>
    ${open && (photo
      ? html`<div class="photo-edit">
          <img src=${photo.thumb || photo.url} alt="" width="96" height="96" />
          <div class="photo-side">
            <small dangerouslySetInnerHTML=${{ __html: photoCredit(photo) }}></small>
            ${input}
            <div class="row tight">${search('Replace')}<button type="button" class="btn btn-small" onClick=${() => onChange(null)}>Remove</button></div>
          </div>
        </div>`
      : html`<div class="row nowrap tight">${input}${search('Find photo')}</div>`)}
    ${open && state.error && html`<small role="alert" class="error">${state.error}</small>`}
  </div>`;
}
