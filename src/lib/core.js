// Kleine Grundbausteine: reaktiver Store, IDs, Formatierung.
import { useEffect, useState, useRef } from '../../vendor/htm-preact.js';

export function createStore(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? next(value) : next;
      subs.forEach((fn) => fn(value));
    },
    patch(part) {
      value = { ...value, ...part };
      subs.forEach((fn) => fn(value));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore(store, selector = (v) => v) {
  const [, force] = useState(0);
  const selRef = useRef(selector);
  selRef.current = selector;
  const last = useRef(selector(store.get()));
  last.current = selector(store.get());
  useEffect(() => {
    const check = (v) => {
      const next = selRef.current(v);
      if (next !== last.current) {
        last.current = next;
        force((n) => n + 1);
      }
    };
    check(store.get());
    return store.subscribe(check);
  }, [store]);
  return last.current;
}

export function createEmitter() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name).delete(fn);
    },
    emit(name, payload) {
      (map.get(name) || []).forEach((fn) => fn(payload));
    },
  };
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtMinutes(seconds) {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  return `${h} Std. ${min % 60} Min.`;
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('de-DE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function safeFileName(text) {
  return text.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Aufnahme';
}

export function bytesToBase64(bytes) {
  const chunk = 0x8000;
  let out = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

export function base64ToBytes(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
