// Akkord-Daten: Griffe nachschlagen, Namen verstehen, eigene Griffe einbeziehen.
import { customChords, settings } from './state.js';

let db = null;

export async function loadChords() {
  if (db) return db;
  const res = await fetch('data/chords.json');
  db = await res.json();
  return db;
}

const KEY_ALIASES = {
  'Db': 'C#', 'D#': 'Eb', 'Gb': 'F#', 'G#': 'Ab', 'A#': 'Bb', 'Cb': 'B', 'H': 'B', 'Hb': 'Bb', 'E#': 'F', 'B#': 'C', 'Fb': 'E',
};

const SUFFIX_ALIASES = {
  '': 'major', 'maj': 'major', 'dur': 'major', 'moll': 'minor', 'm': 'minor', 'min': 'minor', '-': 'minor',
  'M7': 'maj7', 'j7': 'maj7', 'min7': 'm7', '-7': 'm7', 'o': 'dim', 'o7': 'dim7', '+': 'aug', 'sus': 'sus4',
  'add2': 'add9', '7sus': '7sus4', 'minmaj7': 'mmaj7', 'mM7': 'mmaj7', 'ø': 'm7b5', 'm7-5': 'm7b5',
};

export function suffixLabel(suffix) {
  if (suffix === 'major') return '';
  if (suffix === 'minor') return 'm';
  return suffix;
}

export function chordLabel(key, suffix) {
  return `${displayKey(key)}${suffixLabel(suffix)}`;
}

function displayKey(key) {
  if (settings.get().noteNames !== 'de') return key;
  if (key === 'B') return 'H';
  if (key === 'Bb') return 'B';
  return key;
}

export function displayChordName(name) {
  const p = parseChordName(name);
  if (!p) return name;
  return chordLabel(p.key, p.suffix);
}

export function parseChordName(text) {
  if (!text || !db) return null;
  const raw = text.trim();
  const m = raw.match(/^([A-Ha-h])([#b♯♭]?)(.*)$/);
  if (!m) return null;
  const root = m[1].toUpperCase();
  const acc = m[2].replace('♯', '#').replace('♭', 'b');
  let rest = m[3].trim();
  let key = root + acc;
  key = KEY_ALIASES[key] || key;
  rest = rest.replace(/^\s*-\s*/, '');
  const candidates = [rest, rest.toLowerCase()];
  for (const c of candidates) {
    const suffix = SUFFIX_ALIASES[c] ?? c;
    if (db.chords[`${key}|${suffix}`]) return { key, suffix };
  }
  return null;
}

// Gespeichert wird immer international. Eingaben mit deutschen Namen werden hier übersetzt.
export function fromInput(text) {
  const t = text.trim();
  if (settings.get().noteNames === 'de' && /^[Bb](?![b♭#♯])/.test(t)) return `Bb${t.slice(1)}`;
  return t;
}

export function normalizeChordName(text) {
  const p = parseChordName(text);
  return p ? `${p.key}${suffixLabel(p.suffix)}` : (text || '').trim();
}

// Liefert gespeicherte Namen; zur Anzeige displayChordName benutzen.
export function allChordIds() {
  if (!db) return [];
  const names = Object.keys(db.chords).map((k) => {
    const [key, suffix] = k.split('|');
    return `${key}${suffixLabel(suffix)}`;
  });
  return [...customChords.all().map((c) => c.name), ...names];
}

function customFor(name) {
  const wanted = name.trim().toLowerCase();
  return customChords.all().filter((c) => c.name.trim().toLowerCase() === wanted)
    .map((c) => ({ f: c.frets, g: c.fingers || [0, 0, 0, 0, 0, 0], b: c.baseFret || 1, r: c.barres || [], custom: c.id }));
}

export function voicingsFor(name) {
  if (!name) return [];
  const own = customFor(name);
  const p = db ? parseChordName(name) : null;
  const known = p ? db.chords[`${p.key}|${p.suffix}`] : [];
  return [...own, ...known];
}

export const absoluteFrets = (v) => v.f.map((f) => (f > 0 ? f + v.b - 1 : f));

export const STANDARD_MIDI = [40, 45, 50, 55, 59, 64];

export function voicingMidi(v, tuning = STANDARD_MIDI) {
  return absoluteFrets(v).map((f, i) => (f < 0 ? null : tuning[i] + f));
}

export const COMMON_CHORDS = ['A', 'Am', 'C', 'D', 'Dm', 'E', 'Em', 'F', 'G', 'A7', 'D7', 'E7', 'G7', 'Am7', 'Em7', 'Cmaj7', 'Fmaj7', 'Bm'];
