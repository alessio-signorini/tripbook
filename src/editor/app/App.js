import { html, Toasts, ModalHost } from './ui.js';
import { route, dirtyCount, updateReady, isConfigured, applyUpdate, ready } from './state.js';
import { Setup } from './Setup.js';
import { Trips } from './Trips.js';
import { Settings } from './Settings.js';
import { Capture } from './Capture.js';
import { TripEditor } from './TripEditor.js';
import './Conflict.js';

function Screen() {
  const r = route.value;
  if (!ready.value) return html`<section class="screen"><p class="hint">Loading…</p></section>`;
  if (r.name === 'setup' || !isConfigured()) return html`<${Setup} />`;
  if (r.name === 'trip') return html`<${TripEditor} id=${r.id} key=${r.id} />`;
  if (r.name === 'capture') return html`<${Capture} addTo=${r.add_to} key=${r.add_to || 'capture'} />`;
  if (r.name === 'settings') return html`<${Settings} />`;
  return html`<${Trips} />`;
}

export function App() {
  return html`<div class="app">
    <header class="app-header">
      <a class="brand" href="#/">Tripbook</a>
      ${dirtyCount.value > 0 && html`<span class="badge badge-warn" title="Local changes not synced">Not synced</span>`}
      <nav><a href="#/">Trips</a><a href="#/settings">Settings</a></nav>
    </header>
    ${updateReady.value && html`<div class="banner">Update available. <button class="link-btn" onClick=${applyUpdate}>Reload</button></div>`}
    <main><${Screen} /></main>
    <${ModalHost} />
    <${Toasts} />
  </div>`;
}
