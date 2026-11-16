import { trips, settings, configRec, config, busy, buildInfo, syncErrors, ready } from './signals.js';
import { route, navigate } from './router.js';
import { toast, confirmDialog } from './ui.js';
import { gh, isConfigured } from './connection.js';
import { saveRecord, removeRecord, recoverUnsaved } from './records.js';
import { loadAllTrips, loadConfigRecord, saveConfigRecord } from '../core/store.js';
import { ConflictError, GithubError } from '../core/github.js';
import { syncTrip, publishTrip, unpublishTrip, deleteRemote, pullRemote, loadTheirs, ValidationError } from '../core/sync.js';

/* ---------- startup and refresh ---------- */
export async function init() {
  trips.value = await recoverUnsaved(await loadAllTrips());
  const c = await loadConfigRecord();
  if (c) configRec.value = c;
  fetch('/build.json')
    .then((r) => r.json())
    .then((b) => (buildInfo.value = b))
    .catch(() => {});
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if (!isConfigured() && route.value.name !== 'setup') navigate('#/setup');
  ready.value = true;
}

/** Pull drafts, published trips and config.json from GitHub. Dirty local trips are kept. */
export async function refresh({ quiet = false } = {}) {
  if (!isConfigured()) return;
  busy.value = 'refresh';
  try {
    const { records, removed, config: cfg } = await pullRemote(gh(), trips.value, config.value);
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

/* ---------- GitHub actions on one trip ---------- */
/* The conflict modal lives in components/Conflict.js; main.js registers it so state stays free of UI. */
let conflictHandler = () => {};
export const registerConflictHandler = (fn) => (conflictHandler = fn);

const setErrors = (id, errors) => (syncErrors.value = { ...syncErrors.value, [id]: errors });

/** Run `fn(gh, rec, config)` -> next record; store it. Maps failures to errors, the conflict modal or toasts. */
async function run(id, label, fn) {
  const rec = trips.value.get(id);
  if (!rec) return false;
  busy.value = label;
  setErrors(id, null);
  try {
    await saveRecord(await fn(gh(), rec, config.value));
    return true;
  } catch (e) {
    if (e instanceof ValidationError) setErrors(id, e.errors);
    else if (e instanceof ConflictError) await conflictHandler(id);
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
export const doDiscardLocal = (id) => run(id, 'Discard', loadTheirs).then((ok) => ok && toast('Local changes discarded'));

export async function doDelete(id) {
  const rec = trips.value.get(id);
  if (!rec) return false;
  const yes = await confirmDialog({
    title: 'Delete trip',
    message: `Delete "${rec.trip.title || 'Untitled'}"? ${rec.folder ? 'It is removed from GitHub too; git history keeps a copy.' : ''}`,
    confirmLabel: 'Delete',
    danger: true,
  });
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

/** Retry for trips the user has synced before. Active trip only. */
export async function autoRetry() {
  const id = settings.value.active_trip_id;
  const rec = id && trips.value.get(id);
  if (rec && rec.dirty && rec.auto_sync && isConfigured() && navigator.onLine && !busy.value) await run(id, 'Sync', syncTrip);
}
