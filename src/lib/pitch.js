// Tonhöhenerkennung nach dem YIN-Verfahren (de Cheveigné & Kawahara).
const THRESHOLD = 0.12;

export function detectPitch(buf, sampleRate, { minHz = 60, maxHz = 1200 } = {}) {
  const tauMin = Math.floor(sampleRate / maxHz);
  const tauMax = Math.min(Math.ceil(sampleRate / minHz), Math.floor(buf.length / 2));
  const size = buf.length - tauMax;

  let energy = 0;
  for (let i = 0; i < buf.length; i++) energy += buf[i] * buf[i];
  const rms = Math.sqrt(energy / buf.length);
  if (rms < 0.002) return { freq: 0, clarity: 0, rms };

  const diff = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const d = buf[i] - buf[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += diff[tau];
    cmnd[tau] = running > 0 ? (diff[tau] * tau) / running : 1;
  }

  let best = -1;
  for (let tau = Math.max(2, tauMin); tau < tauMax; tau++) {
    if (cmnd[tau] < THRESHOLD) {
      while (tau + 1 < tauMax && cmnd[tau + 1] < cmnd[tau]) tau += 1;
      best = tau;
      break;
    }
  }
  if (best < 0) {
    let min = 1;
    for (let tau = Math.max(2, tauMin); tau < tauMax; tau++) {
      if (cmnd[tau] < min) { min = cmnd[tau]; best = tau; }
    }
    if (min > 0.35) return { freq: 0, clarity: 1 - min, rms };
  }

  const y0 = cmnd[best - 1] ?? cmnd[best];
  const y1 = cmnd[best];
  const y2 = cmnd[best + 1] ?? cmnd[best];
  const denom = y0 + y2 - 2 * y1;
  const shift = denom !== 0 ? (y0 - y2) / (2 * denom) : 0;
  return { freq: sampleRate / (best + shift), clarity: 1 - y1, rms };
}

const NAMES_INTL = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NAMES_DE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'B', 'H'];

export const midiToFreq = (midi, a4 = 440) => a4 * 2 ** ((midi - 69) / 12);
export const freqToMidi = (freq, a4 = 440) => 69 + 12 * Math.log2(freq / a4);
export const centsBetween = (freq, target) => 1200 * Math.log2(freq / target);

export function noteName(midi, style = 'intl') {
  const names = style === 'de' ? NAMES_DE : NAMES_INTL;
  return names[((Math.round(midi) % 12) + 12) % 12];
}

export function noteLabel(midi, style = 'intl') {
  return `${noteName(midi, style)}${Math.floor(Math.round(midi) / 12) - 1}`;
}

export const TUNINGS = [
  { id: 'standard', name: 'Standard', midi: [40, 45, 50, 55, 59, 64] },
  { id: 'dropd', name: 'Drop D', midi: [38, 45, 50, 55, 59, 64] },
  { id: 'halfdown', name: 'Halbton tiefer', midi: [39, 44, 49, 54, 58, 63] },
  { id: 'wholedown', name: 'Ganzton tiefer', midi: [38, 43, 48, 53, 57, 62] },
  { id: 'dadgad', name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
  { id: 'openg', name: 'Open G', midi: [38, 43, 50, 55, 59, 62] },
];

export const tuningById = (id) => TUNINGS.find((t) => t.id === id) || TUNINGS[0];
