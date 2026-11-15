import { signal, computed } from '@preact/signals';
import { mergeConfig, newTrip } from '../../shared/schema.js';
import { createGithub, ConflictError, GithubError } from '../github.js';
import {
  loadSettings, saveSettings, loadAllTrips, saveTripRecord, deleteTripRecord, loadConfigRecord, saveConfigRecord,
} from '../store.js';
import { newRecord, syncTrip, publishTrip, unpublishTrip, deleteRemote, pullRemote, loadTheirs, ValidationError } from '../sync.js';

export const settings = signal(loadSettings());
export const trips = signal(new Map());
export const configRec = signal({ config: {}, sha: null });
export const config = computed(() => mergeConfig(configRec.value.config));
export const route = signal(parseHash());
export const toasts = signal([]);
export const modal = signal(null);
export const busy = signal('');
export const buildInfo = signal(null);
export const syncErrors = signal({});
export const updateReady = signal(false);
export const sw = { registration: null };

export function applyUpdate() {
  const waiting = sw.registration?.waiting;
  if (!waiting) return location.reload();
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage('skip-waiting');
}

export const isConfigured = () => Boolean(settings.value.owner && settings.value.repo && settings.value.token);
export const gh = () => createGithub(settings.value);

/* ---------- routing ---------- */
export function parseHash(hash = location.hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'trip' && parts[1]) return { name: 'trip', id: parts[1] };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'setup') return { name: 'setup' };
  if (parts[0] === 'capture') return { name: 'capture', add_to: parts[1] || null };
  return { name: 'trips' };
}
export const navigate = (hash) => (location.hash = hash);

/* ---------- toasts and modals ---------- */
let toastId = 0;
export function toast(text, action, ms = 4000) {
  const id = ++toastId;
  toasts.value = [...toasts.value, { id, text, action }];
  setTimeout(() => dismissToast(id), action ? Math.max(ms, 6000) : ms);
}
export const dismissToast = (id) => (toasts.value = toasts.value.filter((t) => t.id !== id));

export const closeModal = () => (modal.value = null);
export const showModal = (render, { title = '', full = false } = {}) => (modal.value = { render, title, full });

export function confirmDialog({ title, message, confirmLabel = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const done = (v) => {
      closeModal();
      resolve(v);
    };
    modal.value = { title, dismiss: () => done(false), confirm: { message, confirmLabel, danger, done } };
  });
}

/* ---------- local records ---------- */
export async function saveRecord(rec) {
  const next = new Map(trips.value);
  next.set(rec.trip.id, rec);
  trips.value = next;
  await saveTripRecord(rec);
}

export async function removeRecord(id) {
  const next = new Map(trips.value);
  next.delete(id);
  trips.value = next;
  await deleteTripRecord(id);
  if (settings.value.active_trip_id === id) setActive(null);
}

/** Apply a change to a trip. fn receives a clone and mutates it. */
export function updateTrip(id, fn) {
  const rec = trips.value.get(id);
  if (!rec) return;
  const trip = structuredClone(rec.trip);
  fn(trip);
  trip.updated_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const next = { ...rec, trip, dirty: true };
  const map = new Map(trips.value);
  map.set(id, next);
  trips.value = map;
  saveTripRecord(next);
}

export async function newTripAndOpen(cfg, fields = {}) {
  const trip = newTrip(fields, cfg);
  await saveRecord(newRecord(trip));
  navigate(`#/trip/${trip.id}`);
  return trip.id;
}

export function setActive(id) {
  settings.value = { ...settings.value, active_trip_id: id };
  saveSettings(settings.value);
}

export function saveConnection({ owner, repo, branch, token }) {
  settings.value = { ...settings.value, owner, repo, branch, token };
  saveSettings(settings.value);
}

export const dirtyCount = computed(() => [...trips.value.values()].filter((r) => r.dirty).length);

/* ---------- init and refresh ---------- */
export async function init() {
  trips.value = await loadAllTrips();
  const c = await loadConfigRecord();
  if (c) configRec.value = c;
  fetch('/build.json')
    .then((r) => r.json())
    .then((b) => (buildInfo.value = b))
    .catch(() => {});
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if (!isConfigured() && route.value.name !== 'setup') navigate('#/setup');
}

export async function refresh({ quiet = false } = {}) {
  if (!isConfigured()) return;
  busy.value = 'refresh';
  try {
    const g = gh();
    const { records, removed, config: cfg } = await pullRemote(g, trips.value, config.value);
    for (const rec of records.values()) await saveRecord(rec);
    for (const id of removed) await removeRecord(id);
    if (cfg) {
      configRec.value = cfg;
      await saveConfigRecord(cfg);
    }
  } catch (e) {
    if (!quiet) toast(navigator.onLine ? `Could not refresh: ${e.message}` : 'Offline: showing local copies');
  } finally {
    busy.value = '';
  }
}

/* ---------- actions ---------- */
function setErrors(id, errors) {
  syncErrors.value = { ...syncErrors.value, [id]: errors };
}

async function run(id, label, fn) {
  const rec = trips.value.get(id);
  if (!rec) return false;
  busy.value = label;
  setErrors(id, null);
  try {
    const next = await fn(gh(), rec, config.value);
    await saveRecord(next);
    return true;
  } catch (e) {
    if (e instanceof ValidationError) setErrors(id, e.errors);
    else if (e instanceof ConflictError) await showConflict(id);
    else if (e instanceof GithubError && e.status === 401) toast('GitHub rejected the token. Check Settings.');
    else toast(navigator.onLine ? `${label} failed: ${e.message}` : 'Offline. Your changes are saved on this device.');
    return false;
  } finally {
    busy.value = '';
  }
}

export const doSync = (id) => run(id, 'Sync', syncTrip).then((ok) => ok && toast('Synced'));
export const doPublish = (id) => run(id, 'Publish', publishTrip).then((ok) => ok && toast('Published. Live after the site rebuilds.'));
export const doUnpublish = (id) => run(id, 'Unpublish', unpublishTrip).then((ok) => ok && toast('Unpublished'));

export async function doDiscardLocal(id) {
  const ok = await run(id, 'Discard', loadTheirs);
  if (ok) toast('Local changes discarded');
}

export async function doDelete(id) {
  const rec = trips.value.get(id);
  if (!rec) return false;
  const yes = await confirmDialog({ title: 'Delete trip', message: `Delete "${rec.trip.title || 'Untitled'}"? ${rec.folder ? 'It is removed from GitHub too; git history keeps a copy.' : ''}`, confirmLabel: 'Delete', danger: true });
  if (!yes) return false;
  busy.value = 'Delete';
  try {
    await deleteRemote(gh(), rec);
    await removeRecord(id);
    toast('Deleted');
    return true;
  } catch (e) {
    toast(`Delete failed: ${e.message}`);
    return false;
  } finally {
    busy.value = '';
  }
}

/* The conflict modal is defined in Conflict.js to keep this file free of UI; it registers here. */
let conflictHandler = () => {};
export const registerConflictHandler = (fn) => (conflictHandler = fn);
const showConflict = (id) => conflictHandler(id);

/** Retry for trips the user has synced before. Active trip only. */
export async function autoRetry() {
  const id = settings.value.active_trip_id;
  const rec = id && trips.value.get(id);
  if (rec && rec.dirty && rec.auto_sync && isConfigured() && navigator.onLine && !busy.value) await run(id, 'Sync', syncTrip);
}

/** A structural change (move, delete, add section) with a 6 s Undo toast. */
export function structural(id, message, fn) {
  const rec = trips.value.get(id);
  if (!rec) return;
  const snapshot = structuredClone(rec.trip);
  updateTrip(id, fn);
  toast(message, { label: 'Undo', fn: () => updateTrip(id, (t) => Object.assign(t, snapshot)) }, 6000);
}
