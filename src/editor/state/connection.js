import { settings } from './signals.js';
import { saveSettings } from '../core/store.js';
import { createGithub } from '../core/github.js';
import { createFakeGithub } from '../core/demo.js';

export const isConfigured = () => Boolean(settings.value.owner && settings.value.repo && settings.value.token);

/** GitHub client for the saved connection (the fake one in demo mode). */
export const gh = () => (settings.value.demo ? createFakeGithub() : createGithub(settings.value));

export function saveConnection({ owner, repo, branch, token }) {
  updateSettings({ owner, repo, branch, token, demo: false });
}

export function updateSettings(patch) {
  settings.value = { ...settings.value, ...patch };
  saveSettings(settings.value);
}

export const setActive = (id) => updateSettings({ active_trip_id: id });
