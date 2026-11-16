import { Component, h } from 'preact';
import { useState, useRef, useLayoutEffect, useEffect } from 'preact/hooks';
import { html } from './html.js';
import { STAR_PATH } from '../../shared/theme.js';
import { countries } from '../core/countries.js';

const shallowEqual = (a, b) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => Object.is(a[k], b[k]));
};

/** Re-render `Comp` only when a prop changes by identity (like React.memo, without preact/compat). */
export function memo(Comp) {
  class Memo extends Component {
    shouldComponentUpdate(next) {
      return !shallowEqual(this.props, next);
    }
    render(props) {
      return h(Comp, props);
    }
  }
  Memo.displayName = `Memo(${Comp.name})`;
  return Memo;
}

/** A textarea that grows with its content. */
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

/** 1-5 stars. Tapping the current value clears the rating. */
export function StarInput({ value, onChange }) {
  return html`<div class="star-input" role="group" aria-label="Rating">
    ${[1, 2, 3, 4, 5].map(
      (i) => html`<button type="button" key=${i} aria-label=${`${i} ${i === 1 ? 'star' : 'stars'}`} aria-pressed=${value === i} onClick=${() => onChange(value === i ? null : i)}>
        <svg class=${value && i <= value ? 'on' : ''} viewBox="0 0 16 16" aria-hidden="true"><path d=${STAR_PATH} /></svg>
      </button>`,
    )}
  </div>`;
}

/** "⋯" button with a popup menu; children are <button role="menuitem">. Closes on outside tap. */
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

/** Labelled form field: <label class="field"><span>label</span>children</label>. */
export function Field({ label, children, class: cls = '' }) {
  return html`<label class=${`field ${cls}`}><span>${label}</span>${children}</label>`;
}

/** Toggle chips; tapping the selected chip clears the value. */
export function Chips({ options, value, onChange, format = String }) {
  return html`<div class="chips">${options.map((o) => html`<button type="button" class="chip" key=${o} aria-pressed=${value === o} onClick=${() => onChange(value === o ? null : o)}>${format(o)}</button>`)}</div>`;
}

/** <datalist id="country-list"> with ~250 countries; memoized so typing elsewhere does not re-diff it. */
export const CountryList = memo(function CountryList() {
  return html`<datalist id="country-list">${countries().map((c) => html`<option key=${c.code} value=${c.name} />`)}</datalist>`;
});
