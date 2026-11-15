import { html } from './ui.js';
import { settings, buildInfo, trips, setActive } from './state.js';

export function Settings() {
  const s = settings.value;
  const b = buildInfo.value;
  const active = s.active_trip_id && trips.value.get(s.active_trip_id);
  return html`<section class="screen">
    <h1>Settings</h1>
    <h2 class="group-title">Data repo</h2>
    <p>${s.owner}/${s.repo} <span class="hint">(${s.branch || 'default branch'})</span></p>
    <a class="btn" href="#/setup">Change repo/token</a>
    <h2 class="group-title">Active trip</h2>
    <p>${active ? active.trip.title || 'Untitled trip' : 'None'}</p>
    ${active && html`<button class="btn" onClick=${() => setActive(null)}>Clear active trip</button>`}
    <h2 class="group-title">App</h2>
    <p class="hint">Install to your home screen so the device keeps your offline drafts.</p>
    <p class="hint">Version ${b ? `${b.version} (${b.commit})` : '…'}</p>
  </section>`;
}
