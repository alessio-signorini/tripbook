import { render } from 'preact';
import { html } from 'htm/preact';
import { App } from './app/App.js';
import { route, parseHash, init, refresh, autoRetry, updateReady, isConfigured, sw } from './app/state.js';

window.addEventListener('hashchange', () => (route.value = parseHash()));
window.addEventListener('online', autoRetry);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && autoRetry());

render(html`<${App} />`, document.getElementById('app'));

init().then(() => {
  if (isConfigured()) refresh({ quiet: true });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    sw.registration = reg;
    const notify = () => reg.waiting && navigator.serviceWorker.controller && (updateReady.value = true);
    notify();
    reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', notify));
  }).catch(() => {});
}
