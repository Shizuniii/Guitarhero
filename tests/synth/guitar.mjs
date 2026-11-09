// Künstliche Gitarre (Karplus-Strong) für Tests: Akkorde, Fehler, Rhythmus.
export const SR = 48000;

export function pluck(midi, seconds, { sr = SR, bright = 0.15, decay = 0.9955, seed = 1, cents = 0 } = {}) {
  const f = 440 * 2 ** ((midi - 69 + cents / 100) / 12);
  const period = sr / f - 0.5; // Mittelwertfilter verzögert um eine halbe Probe
  const N = Math.round(period);
  const frac = period - N;
  const out = new Float32Array(Math.round(seconds * sr));
  const buf = new Float32Array(N + 2);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x3fffffff - 1; };
  let prev = 0;
  for (let i = 0; i < buf.length; i++) { prev = prev * (1 - bright) + rnd() * bright; buf[i] = prev; }
  let mean = buf.reduce((a, b) => a + b, 0) / buf.length;
  for (let i = 0; i < buf.length; i++) buf[i] -= mean;
  let pos = 0;
  for (let i = 0; i < out.length; i++) {
    const a = buf[pos % N];
    const b = buf[(pos + 1) % N];
    const v = a + (b - a) * frac;
    out[i] = v;
    buf[pos % N] = 0.5 * (a + b) * decay;
    pos++;
  }
  return out;
}

export function mixInto(target, src, at, gain = 1, sr = SR) {
  const o = Math.round(at * sr);
  for (let i = 0; i < src.length && o + i < target.length; i++) if (o + i >= 0) target[o + i] += src[i] * gain;
}

// Akkord anschlagen: midis von tief nach hoch, kleine Verzögerung zwischen den Saiten.
export function strumChord(target, midis, at, { gain = 0.25, spread = 0.012, up = false, cents = [], seed = 1, dur = 1.8 } = {}) {
  const list = up ? [...midis].reverse() : midis;
  list.forEach((m, i) => {
    if (m === null) return;
    mixInto(target, pluck(m, dur, { seed: seed * 31 + i, cents: cents[midis.indexOf(m)] || 0 }), at + i * spread, gain);
  });
}

export function dead(target, at, gain = 0.15) {
  const len = Math.round(0.04 * SR);
  const o = Math.round(at * SR);
  for (let i = 0; i < len && o + i < target.length; i++) target[o + i] += (Math.random() * 2 - 1) * gain * (1 - i / len) ** 3;
}

export function buzz(target, at, dur = 0.35, gain = 0.3) {
  const o = Math.round(at * SR);
  const n = Math.round(dur * SR);
  for (let i = 0; i < n && o + i < target.length; i++) {
    const env = Math.exp(-i / (0.12 * SR));
    const rattle = (Math.random() * 2 - 1) * (Math.sin(2 * Math.PI * 147 * i / SR) > 0.6 ? 1 : 0.15);
    target[o + i] += rattle * gain * env;
  }
}

export function noise(target, level = 0.0008) {
  for (let i = 0; i < target.length; i++) target[i] += (Math.random() * 2 - 1) * level;
}

export function toWav(samples, sr = SR) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767 | 0, 44 + i * 2);
  return buf;
}
