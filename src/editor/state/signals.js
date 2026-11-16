import { signal, computed } from '@preact/signals';
import { mergeConfig } from '../../shared/schema.js';
import { loadSettings } from '../core/store.js';

/** @typedef {import('../../shared/schema.js').TripRecord} TripRecord */

/** Connection and device settings (localStorage): { owner, repo, branch, token, active_trip_id, demo }. */
export const settings = signal(loadSettings());
/** @type {import('@preact/signals').Signal<Map<string, TripRecord>>} Local trip records by trip id. */
export const trips = signal(new Map());
/** config.json as last loaded from GitHub, with its sha. */
export const configRec = signal({ config: {}, sha: null });
/** config.json merged with DEFAULT_CONFIG. */
export const config = computed(() => mergeConfig(configRec.value.config));
export const toasts = signal([]);
export const modal = signal(null);
/** Label of the running GitHub action ('Sync', 'Publish', 'refresh', ...) or ''. */
export const busy = signal('');
/** /build.json: { version, commit, preview: { trip_js, site_css } }. */
export const buildInfo = signal(null);
/** Validation errors from the last sync, by trip id. */
export const syncErrors = signal({});
export const updateReady = signal(false);
export const ready = signal(false);

export const dirtyCount = computed(() => [...trips.value.values()].filter((r) => r.dirty).length);
