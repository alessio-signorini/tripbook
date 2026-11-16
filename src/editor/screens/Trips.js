import { useState } from 'preact/hooks';
import { html } from '../components/html.js';
import {
  trips, settings, busy, config, syncErrors, navigate, newTripAndOpen, refresh, doSync, doDiscardLocal, dirtyCount,
} from '../state/index.js';
import { stopCount } from '../core/sync.js';
import { locationText, kindLabel, plural } from '../../shared/format.js';

function Row({ rec, activeId }) {
  const t = rec.trip;
  const unsynced = rec.dirty;
  const where = locationText(t.location);
  return html`<li class="trip-row">
    <a class="trip-link" href=${`#/trip/${t.id}`}>
      <span class="trip-title">${t.title || 'Untitled trip'}</span>
      <span class="trip-sub">${[kindLabel(t.kind), where, plural(stopCount(t), 'stop')].filter(Boolean).join(' · ')}</span>
    </a>
    <span class="badges">
      ${t.id === activeId && html`<span class="badge badge-active">Active</span>`}
      ${unsynced && html`<span class="badge badge-warn">Not synced</span>`}
    </span>
    ${unsynced && rec.folder && html`<div class="row-actions">
      <span class="hint">Local changes not synced</span>
      <button class="link-btn" onClick=${() => doSync(t.id)}>Sync now</button>
      <button class="link-btn" onClick=${() => doDiscardLocal(t.id)}>Discard local</button>
    </div>`}
    ${syncErrors.value[t.id] && html`<ul class="error-list">${syncErrors.value[t.id].map((e) => html`<li>${e}</li>`)}</ul>`}
  </li>`;
}

function Group({ title, items, activeId }) {
  if (!items.length) return null;
  return html`<h2 class="group-title">${title}</h2><ul class="trip-list">${items.map((rec) => html`<${Row} key=${rec.trip.id} rec=${rec} activeId=${activeId} />`)}</ul>`;
}

export function Trips() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const all = [...trips.value.values()].filter((r) => !q || `${r.trip.title} ${locationText(r.trip.location)}`.toLowerCase().includes(q));
  const byTitle = (a, b) => (a.trip.title || '').localeCompare(b.trip.title || '');
  const drafts = all.filter((r) => r.folder !== 'published').sort(byTitle);
  const published = all.filter((r) => r.folder === 'published').sort(byTitle);
  const activeId = settings.value.active_trip_id;
  const active = activeId && trips.value.get(activeId);

  return html`<section class="screen">
    <div class="row space">
      <h1>Trips</h1>
      <div class="row">
        <button class="btn" onClick=${() => refresh()} disabled=${busy.value === 'refresh'}>${busy.value === 'refresh' ? 'Refreshing…' : 'Refresh'}</button>
        <button class="btn btn-primary" onClick=${() => newTripAndOpen(config.value)}>New trip</button>
      </div>
    </div>
    ${dirtyCount.value > 0 && html`<p class="banner">${dirtyCount.value} ${dirtyCount.value === 1 ? 'trip has' : 'trips have'} local changes not synced.</p>`}
    <input class="search" type="search" placeholder="Search trips" value=${query} onInput=${(e) => setQuery(e.target.value)} aria-label="Search trips" />
    <${Group} title="Drafts" items=${drafts} activeId=${activeId} />
    <${Group} title="Published" items=${published} activeId=${activeId} />
    ${!all.length && html`<p class="hint">${trips.value.size ? 'No trips match.' : 'No trips yet. Create one, or refresh to load your trips from GitHub.'}</p>`}
    ${active && html`<div class="fab-wrap"><button class="btn btn-primary fab" onClick=${() => navigate('#/capture')}>Add place here</button></div>`}
  </section>`;
}
