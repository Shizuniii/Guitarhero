// Schickt Aufnahmen zur Auswertung in den Hintergrund und liefert das Ergebnis zurück.
import { audioCtx } from './audio.js';
import { absoluteFrets, voicingsFor } from './chords.js';
import { chordModel } from './analysis.js';
import { settings } from './state.js';

let worker = null;
let seq = 0;
const waiting = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./analysis-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const w = waiting.get(e.data.id);
    if (!w) return;
    waiting.delete(e.data.id);
    if (e.data.error) w.reject(new Error(e.data.error)); else w.resolve(e.data.result);
  };
  worker.onerror = (e) => {
    for (const w of waiting.values()) w.reject(new Error(e.message || 'Auswertung abgebrochen'));
    waiting.clear();
    worker = null;
  };
  return worker;
}

export function analyze(job) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ id, job: { profile: settings.get().guitar, ...job } }, [job.samples.buffer]);
  });
}

export function chordFor(chord) {
  const list = voicingsFor(chord.name);
  const v = list[Math.min(chord.voicing || 0, list.length - 1)];
  return v ? chordModel(chord.name, absoluteFrets(v)) : null;
}

// Verzögerung zwischen Klick im Kopfhörer und Anschlag im Mikrofon.
export function latency() {
  const ms = settings.get().latencyMs;
  if (ms !== null && ms !== undefined) return { sec: ms / 1000, calibrated: true };
  const c = audioCtx();
  return { sec: (c.outputLatency || 0) + (c.baseLatency || 0) + 0.02, calibrated: false };
}
