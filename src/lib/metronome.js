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
    const beatsTotal = Math.floor(index / m.grid);
    const sub = index % m.grid;
    const beat = beatsTotal % m.beatsPerBar;
    const bar = Math.floor(beatsTotal / m.beatsPerBar);
    const clickEvery = m.grid % m.clickDiv === 0 ? m.grid / m.clickDiv : m.grid;
    if (sub % clickEvery === 0) {
      click(nextTime, sub === 0 ? (beat === 0 && m.accent ? 2 : 1) : 0);
    }
    const tick = { beat, sub, bar, index, time: nextTime };
    scheduleListeners.forEach((fn) => fn(tick));
    const delay = Math.max(0, (nextTime - c.currentTime) * 1000);
    setTimeout(() => {
      if (!metronome.get().running) return;
      metronome.patch({ pos: tick });
      tickListeners.forEach((fn) => fn(tick));
    }, delay);
    nextTime += secPerTick;
    index += 1;
  }
}

export async function startMetronome() {
  if (metronome.get().running) return;
  const c = await resumeAudio();
  index = 0;
  nextTime = c.currentTime + 0.08;
  metronome.patch({ running: true });
  schedule();
  timerId = setInterval(schedule, INTERVAL_MS);
}

export function stopMetronome() {
  clearInterval(timerId);
  timerId = null;
  metronome.patch({ running: false, pos: { beat: 0, sub: 0, bar: 0, index: 0 } });
}

export const toggleMetronome = () => (metronome.get().running ? stopMetronome() : startMetronome());

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
