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
