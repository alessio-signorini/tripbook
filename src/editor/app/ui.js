import { html } from 'htm/preact';
import { toasts, dismissToast, modal, closeModal } from './state.js';

export { html };

export function Toasts() {
  return html`<div class="toasts" role="status" aria-live="polite">
    ${toasts.value.map(
      (t) => html`<div class="toast-item" key=${t.id}>
        <span>${t.text}</span>
        ${t.action && html`<button class="link-btn" onClick=${() => { t.action.fn(); dismissToast(t.id); }}>${t.action.label}</button>`}
      </div>`,
    )}
  </div>`;
}

export function ModalHost() {
  const m = modal.value;
  if (!m) return null;
  const close = m.dismiss || closeModal;
  const body = m.confirm
    ? html`<p>${m.confirm.message}</p>
        <div class="modal-actions">
          <button class="btn" onClick=${() => m.confirm.done(false)}>Cancel</button>
          <button class=${`btn ${m.confirm.danger ? 'btn-danger' : 'btn-primary'}`} onClick=${() => m.confirm.done(true)}>${m.confirm.confirmLabel}</button>
        </div>`
    : m.render();
  return html`<div class="modal-backdrop" onClick=${(e) => e.target === e.currentTarget && close()} onKeyDown=${(e) => e.key === 'Escape' && close()}>
    <div class=${`modal ${m.full ? 'modal-full' : ''}`} role="dialog" aria-modal="true" aria-label=${m.title}>
      <div class="modal-head"><h2>${m.title}</h2><button class="icon-btn" aria-label="Close" onClick=${close}>✕</button></div>
      <div class="modal-body">${body}</div>
    </div>
  </div>`;
}

export const kindLabel = (k) => (k === 'guide' ? 'Guide' : 'Trip log');
