import { useState } from 'preact/hooks';
import { html } from '../components/html.js';
import {
  trips, settings, config, busy, buildInfo, syncErrors, updateTrip, structural, doSync, doPublish, doUnpublish, doDelete,
  setActive, showModal, toast, navigate, saveRecord,
} from '../state/index.js';
import { Field, Menu, AutoTextarea, CountryList } from '../components/controls.js';
import { PhotoField } from '../components/PhotoField.js';
import { SectionsSortable, SectionCard } from '../components/Sections.js';
import { countryByName } from '../core/countries.js';
import { setTitle, addSection, makeGuide } from '../core/editing.js';
import { newRecord } from '../core/sync.js';
import { tripPath } from '../../shared/paths.js';
import { visibleStops } from '../../shared/visible.js';
/** Render the trip with the site's own renderer into an iframe. The renderer (and marked) is a lazy chunk. */
async function openPreview(trip) {
  const build = buildInfo.value;
  if (!build) return toast('Preview assets are not loaded yet');
  const { renderTripPage } = await import('../../shared/render/trip.js');
  const cfg = config.value;
  const origin = location.origin;
  const doc = renderTripPage(trip, {
    config: cfg,
    assets: { css: `${origin}/${build.preview.site_css}`, js: `${origin}/${build.preview.trip_js}` },
    path: tripPath(trip, cfg),
    draft: true,
    version: build.version,
  });
  showModal(() => html`<iframe class="preview-frame" title="Preview" sandbox="allow-scripts allow-same-origin allow-popups" srcdoc=${doc}></iframe>`, { title: 'Preview', full: true });
}

async function copyLink(rec) {
  const cfg = config.value;
  const path = tripPath(rec.trip, cfg, { draft: rec.folder !== 'published' });
  try {
    await navigator.clipboard.writeText(`${cfg.base_url}${path}`);
    toast('Link copied. Live after the site rebuilds (about a minute).');
  } catch {
    toast('Could not copy the link');
  }
}

async function guideFromLog(rec) {
  const guide = makeGuide(rec.trip);
  await saveRecord(newRecord(guide));
  toast('Guide created as a new draft');
  navigate(`#/trip/${guide.id}`);
}

export function TripEditor({ id }) {
  const rec = trips.value.get(id);
  const [reorder, setReorder] = useState(false);
  const [showLoc, setShowLoc] = useState(!trips.value.get(id)?.trip.location?.country);
  if (!rec) return html`<section class="screen"><p>Trip not found. <a href="#/">Back to trips</a></p></section>`;

  const trip = rec.trip;
  const cfg = config.value;
  const set = (patch) => updateTrip(id, (t) => Object.assign(t, patch));
  const setLoc = (patch) => updateTrip(id, (t) => Object.assign(t.location, patch));
  const published = rec.folder === 'published';
  const working = Boolean(busy.value) && busy.value !== 'refresh';
  const errors = syncErrors.value[id];
  const isActive = settings.value.active_trip_id === id;
  const entries = visibleStops(trip, { showLow: true });
  const path = `${cfg.base_url || ''}${tripPath(trip, cfg, { draft: !published })}`;

  return html`<section class="screen">
    <div class="editor-bar">
      <a class="icon-btn" href="#/" aria-label="Back to trips">←</a>
      <div class="grow bar-title"><span class="bar-name">${trip.title || 'Untitled trip'}</span>
      <span class="status">${rec.dirty ? 'Not synced' : rec.synced_at ? `Synced ${new Date(rec.synced_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Synced'}</span></div>
      <button class="btn btn-small" disabled=${working} onClick=${() => doSync(id)}>${busy.value === 'Sync' ? 'Syncing…' : 'Sync'}</button>
      ${!published && html`<button class="btn btn-small btn-primary bar-publish" disabled=${working} onClick=${() => doPublish(id)}>Publish</button>`}
      <${Menu} label="Trip actions">
        <button role="menuitem" onClick=${() => copyLink(rec)}>Copy live link</button>
        <button role="menuitem" onClick=${() => openPreview(trip)}>Preview</button>
        ${!published && html`<button role="menuitem" class="menu-publish" disabled=${working} onClick=${() => doPublish(id)}>Publish</button>`}
        ${published && html`<button role="menuitem" disabled=${working} onClick=${() => doUnpublish(id)}>Unpublish</button>`}
        <button role="menuitem" onClick=${() => setActive(isActive ? null : id)}>${isActive ? 'Clear active trip' : 'Set as active trip'}</button>
        ${trip.kind === 'log' && html`<button role="menuitem" onClick=${() => guideFromLog(rec)}>Make guide from this log</button>`}
        <button role="menuitem" class="danger" onClick=${async () => (await doDelete(id)) && navigate('#/')}>Delete</button>
      <//>
    </div>
    ${errors && html`<ul class="error-list" role="alert">${errors.map((e) => html`<li>${e}</li>`)}</ul>`}

    <${Field} label="Title"><input type="text" value=${trip.title} onInput=${(e) => updateTrip(id, (t) => setTitle(t, e.target.value))} /><//>
    <div class="kind-slug">
      <div class="field"><span>Kind</span>
        <div class="segmented" role="group" aria-label="Kind">
          <button type="button" aria-pressed=${trip.kind === 'guide'} onClick=${() => set({ kind: 'guide' })}>Guide</button>
          <button type="button" aria-pressed=${trip.kind === 'log'} onClick=${() => set({ kind: 'log' })}>Trip log</button>
        </div>
      </div>
      <${Field} label="Slug" class="grow"><input type="text" value=${trip.slug} autocapitalize="none" onInput=${(e) => set({ slug: e.target.value })} /><small class="slug-url" title=${path}>${tripPath(trip, cfg, { draft: !published })}</small><//>
    </div>
    <${Field} label="Trip note"><${AutoTextarea} minRows=${3} placeholder="Markdown: **bold**, *italic*, [links](https://…), lists" value=${trip.note} onInput=${(note) => set({ note })} /><//>
    <${PhotoField} trip=${trip} onChange=${(photo) => set({ photo })} />
    <button type="button" class="details-toggle no-rule" aria-expanded=${showLoc} onClick=${() => setShowLoc(!showLoc)}>
      <span>${showLoc ? '▾' : '▸'} Location</span><span class="hint">${showLoc ? '' : [trip.location.city, trip.location.region, trip.location.country].filter(Boolean).join(', ')}</span>
    </button>
    ${showLoc && html`<div class="grid2">
      <${Field} label="Country"><input type="text" list="country-list" value=${trip.location.country} onInput=${(e) => { const c = countryByName(e.target.value); setLoc(c ? { country: c.name, country_code: c.code } : { country: e.target.value }); }} /><//>
      <${CountryList} />
      <${Field} label="Country code"><input type="text" maxlength="2" value=${trip.location.country_code} onInput=${(e) => setLoc({ country_code: e.target.value.toUpperCase() })} /><//>
      <${Field} label="Region (optional)"><input type="text" value=${trip.location.region} onInput=${(e) => setLoc({ region: e.target.value })} /><//>
      <${Field} label="City (optional)"><input type="text" value=${trip.location.city} onInput=${(e) => setLoc({ city: e.target.value })} /><//>
    </div>`}

    <div class="row space section-title-row">
      <h2>Sections</h2>
      <button type="button" class="btn btn-small" aria-pressed=${reorder} onClick=${() => setReorder(!reorder)}>${reorder ? 'Done reordering' : 'Reorder mode'}</button>
    </div>
    <${SectionsSortable} tripId=${id} reorder=${reorder}>
      ${entries.map((entry, i) => html`<${SectionCard} key=${entry.section.id} trip=${trip} entry=${entry} index=${i} reorder=${reorder} />`)}
    <//>
    <button type="button" class="btn" onClick=${() => structural(id, 'Section added.', (t) => addSection(t))}>Add section</button>
  </section>`;
}
