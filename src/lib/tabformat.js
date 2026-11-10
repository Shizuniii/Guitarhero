// Tab-Modell: umwandeln nach alphaTex, Text-Tabs einlesen, Takte prüfen.
import { tuningById } from './pitch.js';

export const newModel = (over = {}) => ({
  tempo: 90, ts: [4, 4], capo: 0, tuningId: 'standard',
  bars: [emptyBar([4, 4])],
  ...over,
});

export function emptyBar(ts = [4, 4]) {
  return { beats: Array.from({ length: ts[0] }, () => ({ d: ts[1], notes: [] })) };
}

// N-tolen: t Noten in der Zeit von n normalen. Triole = 3 in der Zeit von 2.
export const TUPLETS = { 3: 2, 5: 4, 6: 4, 7: 4 };
export const TUPLET_NAMES = { 3: 'Triole', 5: 'Quintole', 6: 'Sextole', 7: 'Septole' };

export const durationTicks = (beat) => {
  const base = 3840 / beat.d;
  const len = beat.dot ? base * 1.5 : base;
  return TUPLETS[beat.t] ? (len * TUPLETS[beat.t]) / beat.t : len;
};

export const barTicks = (ts) => (ts[0] * 3840) / ts[1];

// Takte, die nicht genau die Taktart füllen. Zu lange Takte überlappen sich beim Abspielen.
export function badBars(model) {
  const ts = model?.ts || [4, 4];
  return (model?.bars || []).map((bar, i) => ({ bar: i + 1, ...barFill(bar, ts) })).filter((b) => !b.ok);
}

export function barList(bad) {
  const nums = bad.map((b) => b.bar);
  return nums.length === 1 ? `Takt ${nums[0]}` : `Takte ${nums.slice(0, -1).join(', ')} und ${nums[nums.length - 1]}`;
}

export function barFill(bar, ts) {
  const used = bar.beats.reduce((n, b) => n + durationTicks(b), 0);
  const want = barTicks(ts);
  return { used, want, ok: Math.abs(used - want) < 1, over: used > want + 1 };
}

const esc = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function noteTex(n) {
  const fx = [];
  if (n.fx?.h) fx.push('h');
  if (n.fx?.sl) fx.push('sl');
  if (n.fx?.v) fx.push('v');
  if (n.fx?.pm) fx.push('pm');
  if (n.fx?.b) fx.push('b (0 4)');
  const props = fx.length ? `{${fx.join(' ')}}` : '';
  const fret = n.fx?.x ? 'x' : n.f;
  return `${fret}.${n.s}${props}`;
}

function beatTex(b) {
  const props = [b.dot ? 'd' : '', TUPLETS[b.t] ? `tu ${b.t}` : ''].filter(Boolean);
  const dot = props.length ? `{${props.join(' ')}}` : '';
  if (!b.notes.length) return `r.${b.d}${dot}`;
  const sorted = [...b.notes].sort((x, y) => y.s - x.s);
  return `(${sorted.map(noteTex).join(' ')}).${b.d}${dot}`;
}

const MIDI_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (m) => `${MIDI_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

export const GUITAR_PROGRAMS = { nylon: 24, steel: 25, electric: 27 };

export function toAlphaTex(model, { title = '', artist = '', program = 24 } = {}) {
  const head = [];
  if (title) head.push(`\\title "${esc(title)}"`);
  if (artist) head.push(`\\artist "${esc(artist)}"`);
  head.push(`\\tempo ${Math.round(model.tempo || 90)}`);
  const tuning = tuningById(model.tuningId).midi;
  const staff = [`\\instrument ${program}`, `\\tuning (${[...tuning].reverse().map(midiName).join(' ')})`];
  if (model.capo) staff.push(`\\capo ${model.capo}`);
  const ts = model.ts || [4, 4];
  const bars = model.bars.map((bar, i) => {
    const prefix = i === 0 ? `\\ts ${ts[0]} ${ts[1]} ` : '';
    const body = bar.beats.length ? bar.beats.map(beatTex).join(' ') : `r.${ts[1]}`;
    return prefix + body;
  });
  return `${head.join('\n')}\n.\n${staff.join(' ')}\n${bars.join(' |\n')}`;
}

// Text-Tabs -------------------------------------------------------------

const LABEL = /^\s*(?:\d\)\s*)?([eEbBgGdDaAhH])?(?:[#b]?)\s*[|:\]]?/;
const TAB_BODY = /^[-–—|0-9hpbrsvxX/\\~^()<>.*=:\s\[\]tTPM]+$/;

function isTabLine(line) {
  const t = line.replace(LABEL, '');
  if (t.length < 4 || !TAB_BODY.test(t)) return false;
  const dashes = (t.match(/[-–—]/g) || []).length;
  return dashes >= Math.max(3, t.length * 0.4);
}

function cleanLine(line) {
  const start = line.search(/[|:\-–—0-9]/);
  const labelMatch = line.match(/^\s*([eEbBgGdDaAhH])\s*[|:\]]?/);
  let body = labelMatch ? line.slice(labelMatch[0].length) : line.slice(Math.max(0, start));
  body = body.replace(/[–—]/g, '-').replace(/\r/g, '').trimEnd();
  return { label: labelMatch ? labelMatch[1] : '', body };
}

export function findTabBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  while (i <= lines.length - 6) {
    const group = lines.slice(i, i + 6);
    if (group.every(isTabLine)) {
      blocks.push(group.map(cleanLine));
      i += 6;
    } else {
      i += 1;
    }
  }
  return blocks;
}

function orderBlock(block) {
  // Erwartet hohe e-Saite oben; steht tiefes E oben (selten), wird umgedreht.
  const labels = block.map((l) => l.label);
  const reversed = labels[0] === 'E' && labels[5] === 'e';
  const ordered = reversed ? [...block].reverse() : block;
  const width = Math.max(...ordered.map((l) => l.body.length));
  return ordered.map((l) => l.body.padEnd(width, '-'));
}

function splitBars(lines) {
  const width = lines[0].length;
  const cuts = [];
  for (let c = 0; c < width; c++) {
    const pipes = lines.filter((l) => l[c] === '|').length;
    if (pipes >= 4) cuts.push(c);
  }
  const ranges = [];
  let start = 0;
  for (const cut of cuts) {
    if (cut - start >= 3) ranges.push([start, cut]);
    start = cut + 1;
  }
  if (width - start >= 3) ranges.push([start, width]);
  return ranges;
}

function readEvents(lines, from, to) {
  const events = new Map();
  lines.forEach((line, row) => {
    const string = row + 1;
    let c = from;
    while (c < to) {
      const ch = line[c];
      if (ch >= '0' && ch <= '9') {
        let end = c + 1;
        if (end < to && line[end] >= '0' && line[end] <= '9' && Number(line.slice(c, end + 1)) <= 24) end += 1;
        const fret = Number(line.slice(c, end));
        const after = line[end];
        const fx = {};
        if (after === 'h' || after === 'p') fx.h = true;
        if (after === '/' || after === '\\' || after === 's') fx.sl = true;
        if (after === '~' || after === 'v') fx.v = true;
        if (after === 'b') fx.b = true;
        addEvent(events, c, { s: string, f: fret, ...(Object.keys(fx).length ? { fx } : {}) });
        c = end;
      } else if (ch === 'x' || ch === 'X') {
        addEvent(events, c, { s: string, f: 0, fx: { x: true } });
        c += 1;
      } else {
        c += 1;
      }
    }
  });
  return [...events.entries()].sort((a, b) => a[0] - b[0]);
}

function addEvent(events, col, note) {
  // Zweistellige Bünde verschieben Spalten leicht: Nachbarspalte zählt als dieselbe.
  const key = events.has(col - 1) && !events.get(col - 1).some((n) => n.s === note.s) ? col - 1 : col;
  if (!events.has(key)) events.set(key, []);
  events.get(key).push(note);
}

const SLOT_VALUES = [
  [16, 1, false], [12, 2, true], [8, 2, false], [6, 4, true], [4, 4, false], [3, 8, true], [2, 8, false], [1, 16, false],
];

function slotsToBeats(slots, notes) {
  const out = [];
  let left = slots;
  let first = true;
  while (left > 0) {
    const [size, d, dot] = SLOT_VALUES.find(([s]) => s <= left);
    out.push({ d, ...(dot ? { dot: true } : {}), notes: first ? notes : [] });
    first = false;
    left -= size;
  }
  return out;
}

function barFromEvents(evts, from, to, ts) {
  const grid = (ts[0] * 16) / ts[1];
  const span = Math.max(1, to - from);
  const placed = [];
  let lastSlot = -1;
  for (const [col, notes] of evts) {
    let slot = Math.round(((col - from) / span) * grid);
    if (slot <= lastSlot) slot = lastSlot + 1;
    if (slot >= grid) slot = grid - 1;
    if (slot === lastSlot) {
      placed[placed.length - 1].notes.push(...notes);
      continue;
    }
    placed.push({ slot, notes });
    lastSlot = slot;
  }
  const beats = [];
  if (!placed.length) return { beats: slotsToBeats(grid, []) };
  if (placed[0].slot > 0) beats.push(...slotsToBeats(placed[0].slot, []));
  placed.forEach((p, i) => {
    const end = i + 1 < placed.length ? placed[i + 1].slot : grid;
    beats.push(...slotsToBeats(end - p.slot, p.notes));
  });
  return { beats };
}

export function parseTextTab(text, { ts = [4, 4], tempo = 90 } = {}) {
  const blocks = findTabBlocks(text);
  if (!blocks.length) return null;
  const bars = [];
  for (const block of blocks) {
    const lines = orderBlock(block);
    let ranges = splitBars(lines);
    if (ranges.length === 1) {
      // Keine Taktstriche im Text: nach Notenmenge in Takte teilen.
      const [from, to] = ranges[0];
      const count = readEvents(lines, from, to).length;
      const parts = Math.max(1, Math.round(count / 8));
      const size = (to - from) / parts;
      ranges = Array.from({ length: parts }, (_, i) => [Math.round(from + i * size), Math.round(from + (i + 1) * size)]);
    }
    for (const [from, to] of ranges) bars.push(barFromEvents(readEvents(lines, from, to), from, to, ts));
  }
  return { tempo, ts, capo: 0, tuningId: 'standard', bars, approximate: true };
}

// KI-Helfer: prüft das eingefügte Ergebnis ------------------------------

// Version des Formats, das der Tab-Leser liefert. Kommt ein neueres, muss die App erst aktualisiert werden,
// sonst gingen Angaben wie Triolen stillschweigend verloren.
export const HELPER_FORMAT = 2;

export function parseHelperJson(text) {
  let data;
  try {
    data = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (!data || !Array.isArray(data.bars)) return null;
  if (Number(data.format) > HELPER_FORMAT) return { tooNew: true };
  const valid = new Set([1, 2, 4, 8, 16, 32]);
  const ts = Array.isArray(data.ts) && data.ts.length === 2 ? data.ts.map(Number) : [4, 4];
  const bars = data.bars.map((bar) => ({
    beats: (bar.beats || []).map((b) => ({
      d: valid.has(Number(b.d)) ? Number(b.d) : 8,
      ...(b.dot ? { dot: true } : {}),
      ...(TUPLETS[Number(b.t)] ? { t: Number(b.t) } : {}),
      notes: (b.notes || [])
        .filter((n) => n.s >= 1 && n.s <= 6 && n.f >= 0 && n.f <= 30)
        .map((n) => ({ s: Number(n.s), f: Number(n.f), ...(n.fx ? { fx: n.fx } : {}) })),
    })),
  })).filter((b) => b.beats.length);
  if (!bars.length) return null;
  return {
    title: typeof data.title === 'string' ? data.title : '',
    artist: typeof data.artist === 'string' ? data.artist : '',
    model: { tempo: Number(data.tempo) || 90, ts, capo: Number(data.capo) || 0, tuningId: 'standard', bars },
    uncertain: Array.isArray(data.uncertain) ? data.uncertain.map(String) : [],
  };
}
