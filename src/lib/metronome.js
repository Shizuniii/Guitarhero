// Metronom mit Vorausplanung auf der Audio-Uhr, damit es auch bei voller Seite exakt bleibt.
import { audioCtx, resumeAudio } from './audio.js';
import { clamp, createStore } from './core.js';
import { settings, updateSettings } from './state.js';

const LOOKAHEAD = 0.14;
const INTERVAL_MS = 25;

const initial = settings.get().metronome;

export const metronome = createStore({
  ...initial,
  running: false,
  grid: initial.clickDiv,
  pos: { beat: 0, sub: 0, bar: 0, index: 0 },
});

// Wenn ein Riff oder Song läuft, übernimmt dessen Wiedergabe das Metronom.
export const metronomeBridge = createStore(null);

const scheduleListeners = new Set();
const tickListeners = new Set();
let timerId = null;
let nextTime = 0;
let index = 0;

export const onMetronomeSchedule = (fn) => {
  scheduleListeners.add(fn);
  return () => scheduleListeners.delete(fn);
};
export const onMetronomeTick = (fn) => {
  tickListeners.add(fn);
  return () => tickListeners.delete(fn);
};

function click(time, strength) {
  const m = metronome.get();
  if (m.silent || m.volume <= 0) return;
  const c = audioCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  const freq = strength === 2 ? 1760 : strength === 1 ? 1175 : 880;
  const level = (strength === 0 ? 0.32 : 0.75) * m.volume;
  osc.type = 'triangle';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(level, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
  osc.connect(g).connect(c.destination);
  osc.start(time);
  osc.stop(time + 0.05);
}

function schedule() {
  const c = audioCtx();
  const m = metronome.get();
  const secPerTick = 60 / m.bpm / m.grid;
  while (nextTime < c.currentTime + LOOKAHEAD) {
    // Beim Einzählen ist der Index negativ: Modulo so rechnen, dass Schlag und Unterteilung stimmen.
    const beatsTotal = Math.floor(index / m.grid);
    const sub = ((index % m.grid) + m.grid) % m.grid;
    const beat = ((beatsTotal % m.beatsPerBar) + m.beatsPerBar) % m.beatsPerBar;
    const bar = Math.floor(beatsTotal / m.beatsPerBar);
    const clickEvery = m.grid % m.clickDiv === 0 ? m.grid / m.clickDiv : m.grid;
    if (sub % clickEvery === 0) {
      click(nextTime, sub === 0 ? (beat === 0 && m.accent ? 2 : 1) : 0);
    }
    const tick = { beat, sub, bar, index, time: nextTime };
    scheduleListeners.forEach((fn) => fn(tick));
    // Anzeige zum Zeitpunkt, an dem der Klick zu hören ist, nicht wenn er geplant wird.
    const delay = Math.max(0, (nextTime - c.currentTime + (c.outputLatency || 0)) * 1000);
    setTimeout(() => {
      if (!metronome.get().running) return;
      metronome.patch({ pos: tick });
      tickListeners.forEach((fn) => fn(tick));
    }, delay);
    nextTime += secPerTick;
    index += 1;
  }
}

// `preBeats`: so viele Schläge Einzählen vor Takt 1. Liefert die Audiozeit von Takt 1, Schlag 1.
export async function startMetronome({ preBeats = 0 } = {}) {
  if (metronome.get().running) return null;
  const c = await resumeAudio();
  const m = metronome.get();
  index = -preBeats * m.grid;
  nextTime = c.currentTime + 0.08;
  const barOne = nextTime + (preBeats * 60) / m.bpm;
  // Bis zum ersten Klick zeigt nichts einen Schlag an.
  metronome.patch({ running: true, pos: { beat: -1, sub: 0, bar: 0, index: -1 } });
  schedule();
  timerId = setInterval(schedule, INTERVAL_MS);
  return barOne;
}

// Audiozeit des ersten Taktanfangs, der frühestens in `seconds` kommt. Nur bei laufendem Metronom.
export function nextBarStart(seconds) {
  if (!metronome.get().running) return null;
  const c = audioCtx();
  const m = metronome.get();
  const sec = 60 / m.bpm / m.grid;
  const bar = m.grid * m.beatsPerBar;
  const earliest = c.currentTime + seconds;
  let k = index + Math.max(0, Math.ceil((earliest - nextTime) / sec - 1e-6));
  k = Math.ceil(k / bar) * bar;
  return nextTime + (k - index) * sec;
}

export function stopMetronome() {
  clearInterval(timerId);
  timerId = null;
  metronome.patch({ running: false, pos: { beat: 0, sub: 0, bar: 0, index: 0 } });
}

export const toggleMetronome = () => (metronome.get().running ? stopMetronome() : startMetronome());

// Gesamtzahl Einzähl-Schläge: mindestens `seconds` lang und mindestens ein ganzer Takt.
export function countInBeats(seconds) {
  const m = metronome.get();
  return Math.max(m.beatsPerBar, Math.ceil((seconds * m.bpm) / 60 - 1e-6));
}

function persist() {
  const { bpm, beatsPerBar, clickDiv, volume, accent, silent } = metronome.get();
  updateSettings({ metronome: { bpm, beatsPerBar, clickDiv, volume, accent, silent } });
}

export function setMetronome(patch, { save = true } = {}) {
  const next = { ...patch };
  if (next.bpm !== undefined) next.bpm = clamp(Math.round(next.bpm), 20, 320);
  if (next.clickDiv !== undefined && patch.grid === undefined) next.grid = next.clickDiv;
  metronome.patch(next);
  if (save) persist();
}

export function loadMetronomeSettings() {
  const s = settings.get().metronome;
  metronome.patch({ ...s, grid: s.clickDiv });
}

// Tap-Tempo: Mittelwert der letzten Abstände
let taps = [];
export function tapTempo() {
  const now = performance.now();
  taps = taps.filter((t) => now - t < 2500);
  taps.push(now);
  if (taps.length >= 2) {
    const gaps = taps.slice(1).map((t, i) => t - taps[i]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    setMetronome({ bpm: 60000 / avg });
  }
}
