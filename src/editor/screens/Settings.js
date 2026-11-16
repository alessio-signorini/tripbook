import { useState } from 'preact/hooks';
import { html } from '../components/html.js';
import {
  settings, buildInfo, trips, setActive, config, configRec, pushConfig, pullConfig, rebuildSite, showModal, closeModal, toast, busy,
} from '../state/index.js';
import { ConflictError } from '../core/github.js';
import { Field } from '../components/controls.js';

const parseList = (text) => text.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0);
const slugsToText = (obj) => Object.entries(obj || {}).map(([k, v]) => `${k}=${v}`).join(', ');
const parseSlugs = (text) =>
  Object.fromEntries(text.split(',').map((p) => p.split('=').map((s) => s.trim())).filter(([k, v]) => /^[A-Za-z]{2}$/.test(k || '') && v).map(([k, v]) => [k.toUpperCase(), v]));

function toForm(c) {
  return { ...c, time_presets: c.time_presets.join(', '), country_slugs: slugsToText(c.country_slugs) };
}

function fromForm(f, base) {
  return {
    ...base,
    site_title: f.site_title,
    author: f.author,
    base_url: f.base_url.replace(/\/+$/, ''),
    google_maps_api_key: f.google_maps_api_key.trim(),
    google_maps_map_id: f.google_maps_map_id.trim() || 'DEMO_MAP_ID',
    google_analytics_id: f.google_analytics_id.trim(),
    time_presets: parseList(f.time_presets),
    nearby_radius_m: Number(f.nearby_radius_m) || 75,
    nearby_max_results: Math.min(20, Number(f.nearby_max_results) || 10),
    default_kind: f.default_kind,
    default_lang: f.default_lang || 'en',
    country_slugs: parseSlugs(f.country_slugs),
    ai_crawlers: f.ai_crawlers,
  };
}

function ConfigConflict({ pending }) {
  return html`<p>config.json changed on GitHub since you loaded it.</p>
    <div class="modal-actions">
      <button class="btn" onClick=${async () => { await pullConfig(); closeModal(); toast('Loaded the GitHub version'); }}>Load theirs</button>
      <button class="btn btn-danger" onClick=${async () => {
        try {
          const latest = await pullConfig();
          await pushConfig(pending, latest.sha);
          closeModal();
          toast('Overwrote the GitHub version');
        } catch (e) { toast(e.message); }
      }}>Overwrite</button>
    </div>`;
}

export function Settings() {
  const s = settings.value;
  const b = buildInfo.value;
  const active = s.active_trip_id && trips.value.get(s.active_trip_id);
  const [form, setForm] = useState(() => toForm(config.value));
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const text = (key, label, props = {}) => html`<${Field} label=${label}><input type="text" value=${form[key]} onInput=${set(key)} ...${props} /><//>`;

  async function save() {
    const next = fromForm(form, configRec.value.config);
    setSaving(true);
    try {
      await pushConfig(next, configRec.value.sha);
      setForm(toForm(config.value));
      toast('Settings saved. The site rebuilds automatically (about a minute).');
    } catch (e) {
      if (e instanceof ConflictError) showModal(() => html`<${ConfigConflict} pending=${next} />`, { title: 'Settings conflict' });
      else toast(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return html`<section class="screen">
    <h1>Settings</h1>
    <h2 class="group-title">Data repo</h2>
    <p>${s.demo ? 'Sample data (no GitHub)' : `${s.owner}/${s.repo}`} <span class="hint">(${s.branch || 'default branch'})</span></p>
    <a class="btn" href="#/setup">Change repo/token</a>

    <h2 class="group-title">Site settings (config.json)</h2>
    <div class="grid2">
      ${text('site_title', 'Site title')}
      ${text('author', 'Author')}
    </div>
    ${text('base_url', 'Site URL', { placeholder: 'https://trips.example.com', inputmode: 'url' })}
    <div class="grid2">
      ${text('google_maps_api_key', 'Google Maps API key', { autocomplete: 'off' })}
      ${text('google_maps_map_id', 'Google Maps Map ID')}
    </div>
    ${text('google_analytics_id', 'Google Analytics ID (optional)', { placeholder: 'G-XXXXXXXXXX' })}
    ${text('time_presets', 'Time presets (minutes, comma separated)')}
    <div class="grid2">
      <${Field} label="Nearby radius (m)"><input type="number" min="10" value=${form.nearby_radius_m} onInput=${set('nearby_radius_m')} /><//>
      <${Field} label="Nearby results (max 20)"><input type="number" min="1" max="20" value=${form.nearby_max_results} onInput=${set('nearby_max_results')} /><//>
      <${Field} label="Default kind"><select value=${form.default_kind} onChange=${set('default_kind')}><option value="log">Trip log</option><option value="guide">Guide</option></select><//>
      ${text('default_lang', 'Default language', { placeholder: 'en' })}
    </div>
    ${text('country_slugs', 'Country URL names (US=usa, GB=uk)')}
    <${Field} label="AI crawlers and llms.txt"><select value=${form.ai_crawlers} onChange=${set('ai_crawlers')}><option value="allow">Allow</option><option value="disallow">Disallow</option></select><//>
    <div class="row">
      <button class="btn btn-primary" disabled=${saving} onClick=${save}>${saving ? 'Saving…' : 'Save settings'}</button>
      <button class="btn" disabled=${Boolean(busy.value)} onClick=${rebuildSite}>Rebuild site</button>
    </div>
    <p class="hint">Saving rebuilds the site automatically. Use Rebuild only to re-run it without a change (needs a token with Actions: Read and write).</p>

    <h2 class="group-title">Active trip</h2>
    <p>${active ? active.trip.title || 'Untitled trip' : 'None'}</p>
    ${active && html`<button class="btn" onClick=${() => setActive(null)}>Clear active trip</button>`}

    <h2 class="group-title">App</h2>
    <p class="hint">Install to your home screen so the device keeps your offline drafts.</p>
    <p class="hint">Version ${b ? `${b.version} (${b.commit})` : '…'}</p>
  </section>`;
}
