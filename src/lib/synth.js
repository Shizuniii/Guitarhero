// Kleine Gitarren-Simulation (Karplus-Strong) für Akkorde und Strum-Muster.
import { audioCtx, resumeAudio } from './audio.js';
import { settings } from './state.js';

const cache = new Map();

function pluckBuffer(midi) {
  const kind = settings.get().guitar;
  const key = `${kind}-${midi}`;
  if (cache.has(key)) return cache.get(key);
  const nylon = kind === 'nylon';
  const c = audioCtx();
  const sr = c.sampleRate;
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const seconds = 2.2;
  const buffer = c.createBuffer(1, Math.floor(sr * seconds), sr);
  const out = buffer.getChannelData(0);
  const period = Math.round(sr / freq);
  const delay = new Float32Array(period);
  let seed = midi * 7919 + 13;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x3fffffff - 1;
  };
  let prev = 0;
  for (let i = 0; i < period; i++) {
    const n = rnd();
    prev = nylon ? prev * 0.7 + n * 0.3 : prev * 0.45 + n * 0.55;
    delay[i] = prev;
  }
  const damp = nylon ? 0.5 : 0.5 - Math.min(0.012, (midi - 40) * 0.0002);
  const decay = (nylon ? 0.9952 : 0.9965) + Math.min(0.0028, (70 - Math.min(70, midi)) * 0.0001);
  let pos = 0;
  for (let i = 0; i < out.length; i++) {
    const next = (pos + 1) % period;
    const value = delay[pos];
    out[i] = value;
    delay[pos] = (value * (1 - damp) + delay[next] * damp) * decay;
    pos = next;
  }
  for (let i = 0; i < 64; i++) out[i] *= i / 64;
  cache.set(key, buffer);
  return buffer;
}

function playNote(midi, time, gain, duration = 1.8) {
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = pluckBuffer(midi);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, time);
  g.gain.setTargetAtTime(0, time + duration, 0.08);
  src.connect(g).connect(c.destination);
  src.start(time);
  src.stop(time + duration + 0.5);
}

let ringing = [];

export function strum(midis, { direction = 'D', time, volume = 0.7, spread = 0.012, duration = 1.8 } = {}) {
  const c = audioCtx();
  const t = time ?? c.currentTime + 0.02;
  const notes = midis.filter((m) => m !== null);
  const ordered = direction === 'U' ? [...notes].reverse() : notes;
  ordered.forEach((m, i) => playNote(m, t + i * spread, volume / Math.sqrt(ordered.length) * 1.2, duration));
}

export function muteHit({ time, volume = 0.5 } = {}) {
  const c = audioCtx();
  const t = time ?? c.currentTime + 0.01;
  const len = Math.floor(c.sampleRate * 0.05);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1400;
  filter.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = volume;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t);
}

export async function previewChord(midis, direction = 'D') {
  await resumeAudio();
  ringing = [];
  strum(midis, { direction, spread: 0.022, volume: 0.8, duration: 2 });
}
