import { validateTrip, SCHEMA_VERSION } from '../../shared/schema.js';
import { tripPath } from '../../shared/paths.js';

export class ValidationError extends Error {
  constructor(errors) {
    super(errors.join('\n'));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

const filePath = (folder, id) => `${folder}/${id}.json`;
const stopCount = (trip) => trip.sections.reduce((n, s) => n + s.stops.length, 0);
export { stopCount };

/** @typedef {import('../../shared/schema.js').TripRecord} TripRecord */

/** A record for a trip that was never synced. @returns {TripRecord} */
export function newRecord(trip) {
  return { trip, folder: null, sha: null, dirty: true, path_at_sync: null, auto_sync: false };
}

function prepare(rec, config) {
  const trip = structuredClone(rec.trip);
  trip.v = SCHEMA_VERSION;
  const errors = validateTrip(trip, `${trip.id}.json`);
  if (errors.length) throw new ValidationError(errors);
  const path = tripPath(trip, config);
  if (rec.folder === 'published' && rec.path_at_sync && rec.path_at_sync !== path && !trip.old_paths.includes(rec.path_at_sync)) {
    trip.old_paths.push(rec.path_at_sync);
  }
  return { trip, path };
}

/** Commit the trip to its current folder (drafts/ when never synced). Throws ConflictError / ValidationError. */
export async function syncTrip(gh, rec, config) {
  const { trip, path } = prepare(rec, config);
  const folder = rec.folder || 'drafts';
  const sha = await gh.putFile(filePath(folder, trip.id), trip, rec.sha, `Sync: ${trip.title}`);
  return { ...rec, trip, folder, sha, dirty: false, synced_at: new Date().toISOString(), path_at_sync: path, auto_sync: true };
}

export async function publishTrip(gh, rec, config) {
  let cur = rec;
  if (rec.dirty || rec.folder !== 'drafts') cur = await syncTrip(gh, { ...rec, folder: rec.folder || 'drafts' }, config);
  const { trip, path } = prepare(cur, config);
  const sha = await gh.moveFile(filePath('drafts', trip.id), filePath('published', trip.id), trip, cur.sha, `Publish: ${trip.title}`);
  return { ...cur, trip, folder: 'published', sha, dirty: false, synced_at: new Date().toISOString(), path_at_sync: path };
}

export async function unpublishTrip(gh, rec, config) {
  let cur = rec;
  if (rec.dirty) cur = await syncTrip(gh, rec, config);
  const { trip, path } = prepare(cur, config);
  const sha = await gh.moveFile(filePath('published', trip.id), filePath('drafts', trip.id), trip, cur.sha, `Unpublish: ${trip.title}`);
  return { ...cur, trip, folder: 'drafts', sha, dirty: false, synced_at: new Date().toISOString(), path_at_sync: path };
}

export async function deleteRemote(gh, rec) {
  if (!rec.folder) return;
  await gh.deleteFile(filePath(rec.folder, rec.trip.id), rec.sha, `Delete: ${rec.trip.title}`);
}

/** Look up the remote copy for conflict resolution. Returns { trip, folder, sha } or null. */
export async function fetchRemote(gh, id, preferredFolder) {
  const order = preferredFolder === 'published' ? ['published', 'drafts'] : ['drafts', 'published'];
  for (const folder of order) {
    const f = await gh.getFile(filePath(folder, id));
    if (f) return { trip: f.data, folder, sha: f.sha };
  }
  return null;
}

export async function loadTheirs(gh, rec, config) {
  const remote = await fetchRemote(gh, rec.trip.id, rec.folder);
  if (!remote) throw new Error('The trip no longer exists on GitHub.');
  return { ...rec, trip: remote.trip, folder: remote.folder, sha: remote.sha, dirty: false, synced_at: new Date().toISOString(), path_at_sync: tripPath(remote.trip, config) };
}

export async function overwrite(gh, rec, config) {
  const remote = await fetchRemote(gh, rec.trip.id, rec.folder);
  return syncTrip(gh, { ...rec, folder: remote ? remote.folder : rec.folder, sha: remote ? remote.sha : null }, config);
}

/**
 * Pull remote state. Returns { records: Map id -> record (to store), removed: [id], config: {config, sha}|null }.
 * `locals` is a Map id -> record. Dirty local records are kept as they are.
 */
export async function pullRemote(gh, locals, config) {
  const remote = new Map();
  for (const folder of ['drafts', 'published']) {
    for (const item of await gh.listFolder(folder)) remote.set(item.name.replace(/\.json$/, ''), { folder, sha: item.sha });
  }
  const records = new Map();
  for (const [id, r] of remote) {
    const local = locals.get(id);
    if (local && local.dirty) continue;
    if (local && local.sha === r.sha && local.folder === r.folder) continue;
    const file = await gh.getFile(filePath(r.folder, id));
    if (!file) continue;
    records.set(id, { trip: file.data, folder: r.folder, sha: file.sha, dirty: false, path_at_sync: tripPath(file.data, config), auto_sync: local?.auto_sync || false });
  }
  const removed = [];
  for (const [id, local] of locals) {
    if (local.folder && !local.dirty && !remote.has(id)) removed.push(id);
  }
  const cfg = await gh.getFile('config.json');
  return { records, removed, config: cfg ? { config: cfg.data, sha: cfg.sha } : null };
}
