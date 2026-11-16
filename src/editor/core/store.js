import { get, set, del, keys } from 'idb-keyval';

const SETTINGS_KEY = 'tripbook.settings';
const EMPTY = { owner: '', repo: '', branch: '', token: '', active_trip_id: null, demo: false };

export function loadSettings() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...EMPTY };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadAllTrips() {
  const out = new Map();
  for (const k of await keys()) {
    if (typeof k === 'string' && k.startsWith('trip:')) out.set(k.slice(5), await get(k));
  }
  return out;
}

export const saveTripRecord = (rec) => set(`trip:${rec.trip.id}`, rec);
export const deleteTripRecord = (id) => del(`trip:${id}`);

export const loadConfigRecord = () => get('config');
export const saveConfigRecord = (rec) => set('config', rec);

/*
 * Crash-safe backup for edits not yet written to IndexedDB. Typing is saved to IndexedDB with a short
 * delay; when the page is hidden or unloaded, pending records are also copied here synchronously
 * (an IndexedDB write started during unload may not finish). Startup recovers them.
 */
const UNSAVED_PREFIX = 'tripbook.unsaved.';

export function stashUnsaved(rec) {
  try {
    localStorage.setItem(UNSAVED_PREFIX + rec.trip.id, JSON.stringify(rec));
  } catch {}
}

export function clearUnsaved(id) {
  try {
    localStorage.removeItem(UNSAVED_PREFIX + id);
  } catch {}
}

/** Stashed records (all of them; the caller clears each one after handling it). */
export function loadUnsaved() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(UNSAVED_PREFIX)) continue;
      try {
        out.push(JSON.parse(localStorage.getItem(key)));
      } catch {}
    }
  } catch {}
  return out;
}
