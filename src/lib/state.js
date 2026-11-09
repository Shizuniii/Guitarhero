// Gemeinsamer App-Zustand: Einstellungen und die gespeicherten Sammlungen.
import { createStore, uid } from './core.js';
import { dbAll, dbDelete, dbGet, dbPut } from './db.js';
import { seedData, testPlan } from './seed.js';

export const DEFAULT_SETTINGS = {
  timerSeconds: 60,
  countdownSeconds: 5,
  tailSeconds: 3,
  recordDuringTimer: true,
  micDeviceId: '',
  noteNames: 'intl',
  theme: 'auto',
  lastPatternId: null,
  lastPlanId: null,
  metronome: { bpm: 80, beatsPerBar: 4, clickDiv: 1, volume: 0.8, accent: true, silent: false },
  tuner: { tuningId: 'standard', a4: 440, capo: 0, autoAdvance: true },
  player: { stave: 'Tab', layout: 'Page', countIn: true, click: false, zoom: 130 },
  quick: {},
  seeded: false,
  seedVersion: 0,
  guitar: 'nylon',
  latencyMs: null,
};

export const settings = createStore(DEFAULT_SETTINGS);

function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object'
      ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function updateSettings(patch) {
  settings.set((s) => deepMerge(s, patch));
  dbPut('kv', settings.get(), 'settings');
}

function createCollection(name) {
  const store = createStore([]);
  return {
    name,
    store,
    all: () => store.get(),
    find: (id) => store.get().find((x) => x.id === id) || null,
    async load() {
      const items = await dbAll(name);
      items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      store.set(items);
    },
    async put(item) {
      const next = { createdAt: Date.now(), ...item, id: item.id || uid(), updatedAt: Date.now() };
      // Erst der Zustand im Speicher, damit direkt folgende Änderungen darauf aufbauen.
      store.set((list) => {
        const i = list.findIndex((x) => x.id === next.id);
        if (i < 0) return [...list, next];
        const copy = list.slice();
        copy[i] = next;
        return copy;
      });
      await dbPut(name, next);
      return next;
    },
    async remove(id) {
      await dbDelete(name, id);
      store.set((list) => list.filter((x) => x.id !== id));
    },
  };
}

export const plans = createCollection('plans');
export const customChords = createCollection('chords');
export const patterns = createCollection('patterns');
export const scores = createCollection('scores');
export const recordings = createCollection('recordings');
export const records = createCollection('records');
export const sessions = createCollection('sessions');

export async function bootState() {
  const saved = await dbGet('kv', 'settings');
  if (saved) settings.set(deepMerge(DEFAULT_SETTINGS, saved));
  await Promise.all([plans, customChords, patterns, scores, recordings, records, sessions].map((c) => c.load()));
  if (!settings.get().seeded) {
    const seed = seedData();
    for (const p of seed.patterns) await patterns.put(p);
    for (const s of seed.scores) await scores.put(s);
    for (const p of seed.plans) await plans.put(p);
    updateSettings({ seeded: true, lastPlanId: seed.plans[0].id, lastPatternId: seed.patterns[2].id });
  }
  if ((settings.get().seedVersion || 0) < 2) {
    for (const p of testPlan(patterns.all(), scores.all())) await plans.put(p);
    updateSettings({ seedVersion: 2 });
  }
}

export function logPractice({ type, title, seconds }) {
  if (seconds < 3) return;
  sessions.put({ type, title, seconds: Math.round(seconds), at: Date.now() });
}

export const STEP_TYPES = {
  chord: { label: 'Akkord', plural: 'Akkorde' },
  timer: { label: 'Timer', plural: 'Timer' },
  metronome: { label: 'Metronom', plural: 'Metronome' },
  change: { label: 'Akkordwechsel', plural: 'Akkordwechsel' },
  strum: { label: 'Strum', plural: 'Strums' },
  riff: { label: 'Riff', plural: 'Riffs' },
  song: { label: 'Song', plural: 'Songs' },
  record: { label: 'Aufnahme', plural: 'Aufnahmen' },
};

export function stepTitle(step) {
  const c = step.config || {};
  switch (step.type) {
    case 'chord': return c.chord?.name || 'Akkord';
    case 'change': return `${c.a?.name || '?'} und ${c.b?.name || '?'}`;
    case 'strum': return patterns.find(c.patternId)?.name || 'Strum';
    case 'riff':
    case 'song': return scores.find(c.scoreId)?.title || STEP_TYPES[step.type].label;
    case 'record': return c.label || 'Aufnahme';
    case 'timer': return c.label || 'Freies Üben';
    case 'metronome': return c.label || `Metronom ${c.bpm || 80} BPM`;
    default: return 'Schritt';
  }
}
