// Zustand der Oberfläche: welches Panel offen ist, Hinweise, Tastenkürzel.
import { createStore, uid } from './core.js';

export const panel = createStore(null); // null | 'timer' | 'metronome' | 'tuner'
export const togglePanel = (name) => panel.set((p) => (p === name ? null : name));

export const toasts = createStore([]);
export function toast(text, tone = 'info', ms = 4200) {
  const id = uid();
  toasts.set((l) => [...l, { id, text, tone }]);
  setTimeout(() => toasts.set((l) => l.filter((t) => t.id !== id)), ms);
}

// Aktive Seite meldet hier ihre Tastenbefehle an.
export const hotkeys = createStore({});
export const setHotkeys = (map) => hotkeys.set(map);
