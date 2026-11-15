import { html } from './ui.js';
import { trips } from './state.js';

export function TripEditor({ id }) {
  const rec = trips.value.get(id);
  if (!rec) return html`<section class="screen"><p>Trip not found. <a href="#/">Back to trips</a></p></section>`;
  return html`<section class="screen"><h1>${rec.trip.title || 'Untitled trip'}</h1></section>`;
}
