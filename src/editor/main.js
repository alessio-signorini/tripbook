/** Editor entry point: wire global events, render the app, load local data, register the service worker. */
import { render } from 'preact';
import { html } from './components/html.js';
import { App } from './App.js';
import { showConflict } from './components/Conflict.js';
import {
  route, parseHash, init, refresh, autoRetry, isConfigured, registerConflictHandler, registerServiceWorker, flushPendingSaves,
} from './state/index.js';

registerConflictHandler(showConflict);

window.addEventListener('hashchange', () => (route.value = parseHash()));
window.addEventListener('online', autoRetry);
window.addEventListener('pagehide', flushPendingSaves);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') autoRetry();
  else flushPendingSaves();
});

render(html`<${App} />`, document.getElementById('app'));

init().then(() => {
  if (isConfigured()) refresh({ quiet: true });
});

registerServiceWorker();
