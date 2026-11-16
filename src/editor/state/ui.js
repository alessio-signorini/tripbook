import { toasts, modal } from './signals.js';

let toastId = 0;

/** Show a toast for `ms`; with an action ({ label, fn }) it stays at least 6 s. */
export function toast(text, action, ms = 4000) {
  const id = ++toastId;
  toasts.value = [...toasts.value, { id, text, action }];
  setTimeout(() => dismissToast(id), action ? Math.max(ms, 6000) : ms);
}
export const dismissToast = (id) => (toasts.value = toasts.value.filter((t) => t.id !== id));

export const closeModal = () => (modal.value = null);

/** Open a modal; `render` returns its body. `full` makes it near full screen (Preview). */
export const showModal = (render, { title = '', full = false } = {}) => (modal.value = { render, title, full });

/** Resolves true when confirmed, false when cancelled or dismissed. */
export function confirmDialog({ title, message, confirmLabel = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const done = (v) => {
      closeModal();
      resolve(v);
    };
    modal.value = { title, dismiss: () => done(false), confirm: { message, confirmLabel, danger, done } };
  });
}
