import { updateReady } from './signals.js';

let registration = null;

/** Register sw.js; flag `updateReady` when a new version is waiting. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      registration = reg;
      const notify = () => reg.waiting && navigator.serviceWorker.controller && (updateReady.value = true);
      notify();
      reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', notify));
    })
    .catch(() => {});
}

/** Activate the waiting service worker, then reload. */
export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) return location.reload();
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage('skip-waiting');
}
