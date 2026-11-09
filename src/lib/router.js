// Sehr kleiner Hash-Router, damit die App auf GitHub Pages in jedem Unterordner läuft.
import { createStore, useStore } from './core.js';

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return {
    parts: path.split('/').filter(Boolean).map(decodeURIComponent),
    query: Object.fromEntries(new URLSearchParams(qs || '')),
  };
}

const routeStore = createStore(parse());
window.addEventListener('hashchange', () => routeStore.set(parse()));

export const useRoute = () => useStore(routeStore);
export const go = (path) => { location.hash = `#/${path}`; };
export const getRoute = () => routeStore.get();
