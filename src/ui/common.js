import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { createStore, useStore } from '../lib/core.js';
import { Icon } from './icons.js';

export function Button({ icon, children, variant = 'plain', size, class: cls = '', iconSize, ...rest }) {
  const classes = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', !children ? 'btn-icon' : '', cls].filter(Boolean).join(' ');
  return html`<button type="button" class=${classes} ...${rest}>
    ${icon && html`<${Icon} name=${icon} size=${iconSize || (size === 'lg' ? 26 : 20)}/>`}
    ${children && html`<span>${children}</span>`}
  </button>`;
}

export function Field({ label, hint, children, class: cls = '' }) {
  return html`<label class=${`field ${cls}`}>
    <span class="field-label">${label}</span>
    ${children}
    ${hint && html`<span class="field-hint">${hint}</span>`}
  </label>`;
}

export function Stepper({ value, onChange, min = -Infinity, max = Infinity, step = 1, label, unit, big }) {
  const set = (v) => onChange(Math.min(max, Math.max(min, v)));
  return html`<div class=${`stepper ${big ? 'stepper-big' : ''}`} role="group" aria-label=${label}>
    <${Button} icon="minus" aria-label=${`${label} verringern`} onClick=${() => set(value - step)}/>
    <input class="stepper-value" type="number" value=${value} min=${min} max=${max} aria-label=${label}
      onChange=${(e) => { const n = Number(e.currentTarget.value); if (!Number.isNaN(n)) set(n); }}/>
    ${unit && html`<span class="stepper-unit">${unit}</span>`}
    <${Button} icon="plus" aria-label=${`${label} erhöhen`} onClick=${() => set(value + step)}/>
  </div>`;
}

export function Segmented({ options, value, onChange, label }) {
  return html`<div class="segmented" role="radiogroup" aria-label=${label}>
    ${options.map((o) => html`<button type="button" role="radio" aria-checked=${o.value === value}
      class=${o.value === value ? 'on' : ''} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
  </div>`;
}

export function Toggle({ checked, onChange, children }) {
  return html`<label class="toggle">
    <input type="checkbox" checked=${checked} onChange=${(e) => onChange(e.currentTarget.checked)}/>
    <span class="toggle-led" aria-hidden="true"></span>
    <span>${children}</span>
  </label>`;
}

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d.open) d.showModal();
    return () => d.open && d.close();
  }, []);
  return html`<dialog ref=${ref} class=${`modal ${wide ? 'modal-wide' : ''}`} onCancel=${(e) => { e.preventDefault(); onClose(); }}>
    <header class="modal-head">
      <h2>${title}</h2>
      <${Button} icon="close" aria-label="Schließen" onClick=${onClose}/>
    </header>
    <div class="modal-body">${children}</div>
  </dialog>`;
}

const confirmStore = createStore(null);

export function confirmDialog({ title, text, action = 'Löschen', danger = true }) {
  return new Promise((resolve) => confirmStore.set({ title, text, action, danger, resolve }));
}

export function ConfirmHost() {
  const c = useStore(confirmStore);
  if (!c) return null;
  const done = (v) => { confirmStore.set(null); c.resolve(v); };
  return html`<${Modal} title=${c.title} onClose=${() => done(false)}>
    <p>${c.text}</p>
    <div class="row end">
      <${Button} onClick=${() => done(false)}>Abbrechen<//>
      <${Button} variant=${c.danger ? 'danger' : 'primary'} onClick=${() => done(true)}>${c.action}<//>
    </div>
  <//>`;
}

export function Empty({ title, children }) {
  return html`<div class="empty"><h3>${title}</h3>${children}</div>`;
}

export function PageHead({ title, children, sub }) {
  return html`<header class="page-head">
    <div><h1>${title}</h1>${sub && html`<p class="muted">${sub}</p>`}</div>
    ${children && html`<div class="row wrap">${children}</div>`}
  </header>`;
}

export function useDebounced(fn, ms) {
  const timer = useRef(null);
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => () => clearTimeout(timer.current), []);
  return (...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(...args), ms);
  };
}

export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, value: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, value: null, error: null });
    fn().then(
      (value) => alive && setState({ loading: false, value, error: null }),
      (error) => alive && setState({ loading: false, value: null, error }),
    );
    return () => { alive = false; };
  }, deps);
  return state;
}
