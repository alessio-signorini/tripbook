import { html } from './ui.js';
import { useState, useRef, useLayoutEffect, useEffect } from 'preact/hooks';

export function AutoTextarea({ value, onInput, minRows = 2, ...rest }) {
  const ref = useRef();
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit, [value]);
  return html`<textarea ref=${ref} rows=${minRows} value=${value} onInput=${(e) => { onInput(e.target.value); fit(); }} ...${rest} />`;
}

const STAR = 'M8 1.2l2.1 4.4 4.8.6-3.5 3.3.9 4.8L8 12l-4.3 2.3.9-4.8L1.1 6.2l4.8-.6z';

/** Tapping the current value clears the rating. */
export function StarInput({ value, onChange }) {
  return html`<div class="star-input" role="group" aria-label="Rating">
    ${[1, 2, 3, 4, 5].map(
      (i) => html`<button type="button" key=${i} aria-label=${`${i} ${i === 1 ? 'star' : 'stars'}`} aria-pressed=${value === i} onClick=${() => onChange(value === i ? null : i)}>
        <svg class=${value && i <= value ? 'on' : ''} viewBox="0 0 16 16" aria-hidden="true"><path d=${STAR} /></svg>
      </button>`,
    )}
  </div>`;
}

export function Menu({ label = 'More', children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return html`<div class="menu-wrap" ref=${ref}>
    <button type="button" class="icon-btn" aria-label=${label} aria-haspopup="menu" aria-expanded=${open} onClick=${() => setOpen(!open)}>⋯</button>
    ${open && html`<div class="menu" role="menu" onClick=${() => setOpen(false)}>${children}</div>`}
  </div>`;
}

export function Field({ label, children, class: cls = '' }) {
  return html`<label class=${`field ${cls}`}><span>${label}</span>${children}</label>`;
}

export function Chips({ options, value, onChange, format = String }) {
  return html`<div class="chips">${options.map((o) => html`<button type="button" class="chip" key=${o} aria-pressed=${value === o} onClick=${() => onChange(value === o ? null : o)}>${format(o)}</button>`)}</div>`;
}
