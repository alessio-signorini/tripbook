import { trips, settings } from './signals.js';
import { navigate } from './router.js';
import { toast } from './ui.js';
import { setActive } from './connection.js';
import { saveTripRecord, deleteTripRecord, stashUnsaved, clearUnsaved, loadUnsaved } from '../core/store.js';
import { reuseUnchanged } from '../core/editing.js';
import { newRecord } from '../core/sync.js';
import { newTrip } from '../../shared/schema.js';

/** Typing edits are written to IndexedDB this long after the last change (memory is updated at once). */
const SAVE_DELAY_MS = 300;
const pendingSaves = new Map();

function setRecord(rec) {
  const next = new Map(trips.value);
  next.set(rec.trip.id, rec);
  trips.value = next;
}

function cancelPendingSave(id) {
  clearTimeout(pendingSaves.get(id));
  pendingSaves.delete(id);
  clearUnsaved(id);
}

function saveSoon(id) {
  clearTimeout(pendingSaves.get(id));
  pendingSaves.set(id, setTimeout(() => flushSave(id), SAVE_DELAY_MS));
}

/** Writes the latest in-memory record, so a late flush never stores stale data. */
async function flushSave(id) {
  clearTimeout(pendingSaves.get(id));
  pendingSaves.delete(id);
  const rec = trips.value.get(id);
  if (rec) await saveTripRecord(rec);
  if (!pendingSaves.has(id)) clearUnsaved(id);
}

/**
 * Called on pagehide and when the app is hidden: copy pending records to localStorage synchronously
 * (survives the page being killed), then write them to IndexedDB.
 */
export function flushPendingSaves() {
  const ids = [...pendingSaves.keys()];
  ids.forEach((id) => trips.value.has(id) && stashUnsaved(trips.value.get(id)));
  return Promise.all(ids.map(flushSave));
}

/** At startup: apply edits stashed by flushPendingSaves that are newer than the IndexedDB copy. */
export async function recoverUnsaved(records) {
  for (const rec of loadUnsaved()) {
    const id = rec?.trip?.id;
    if (!id) continue;
    const stored = records.get(id);
    if (!stored || (rec.trip.updated_at || '') >= (stored.trip.updated_at || '')) {
      records.set(id, rec);
      await saveTripRecord(rec);
    }
    clearUnsaved(id);
  }
  return records;
}

export async function saveRecord(rec) {
  cancelPendingSave(rec.trip.id);
  setRecord(rec);
  await saveTripRecord(rec);
}

export async function removeRecord(id) {
  cancelPendingSave(id);
  const next = new Map(trips.value);
  next.delete(id);
  trips.value = next;
  await deleteTripRecord(id);
  if (settings.value.active_trip_id === id) setActive(null);
}

/**
 * Apply a change to a trip. `fn` receives a clone and mutates it.
 * Unchanged sections and stops keep their object identity (memoized cards skip re-rendering).
 */
export function updateTrip(id, fn) {
  const rec = trips.value.get(id);
  if (!rec) return;
  const draft = structuredClone(rec.trip);
  fn(draft);
  draft.updated_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  setRecord({ ...rec, trip: reuseUnchanged(rec.trip, draft), dirty: true });
  saveSoon(id);
}

/** A structural change (move, delete, add section) with a 6 s Undo toast. */
export function structural(id, message, fn) {
  const rec = trips.value.get(id);
  if (!rec) return;
  const snapshot = structuredClone(rec.trip);
  updateTrip(id, fn);
  toast(message, { label: 'Undo', fn: () => updateTrip(id, (t) => Object.assign(t, snapshot)) }, 6000);
}

export async function newTripAndOpen(cfg, fields = {}) {
  const trip = newTrip(fields, cfg);
  await saveRecord(newRecord(trip));
  navigate(`#/trip/${trip.id}`);
  return trip.id;
}
