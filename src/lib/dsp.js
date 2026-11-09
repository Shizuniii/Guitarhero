// Signalverarbeitung ohne Abhängigkeiten. Läuft im Browser, im Worker und in Node-Tests.

const fftCache = new Map();

export function getFFT(n) {
  if (fftCache.has(n)) return fftCache.get(n);
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / n);
    sin[i] = Math.sin((-2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const f = {
    n, re, im,
    run() {
      for (let i = 0; i < n; i++) {
        const j = rev[i];
        if (i < j) {
          let t = re[i]; re[i] = re[j]; re[j] = t;
          t = im[i]; im[i] = im[j]; im[j] = t;
        }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const half = len >> 1;
        const step = n / len;
        for (let i = 0; i < n; i += len) {
          for (let k = 0; k < half; k++) {
            const a = i + k;
            const b = a + half;
            const wr = cos[k * step];
            const wi = sin[k * step];
            const xr = re[b] * wr - im[b] * wi;
            const xi = re[b] * wi + im[b] * wr;
            re[b] = re[a] - xr; im[b] = im[a] - xi;
            re[a] += xr; im[a] += xi;
          }
        }
      }
    },
  };
  fftCache.set(n, f);
  return f;
}

const hannCache = new Map();
function hann(len) {
  if (hannCache.has(len)) return hannCache.get(len);
  const w = new Float64Array(len);
  for (let i = 0; i < len; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, len - 1));
  hannCache.set(len, w);
  return w;
}

export const nextPow2 = (v) => 2 ** Math.ceil(Math.log2(Math.max(2, v)));

// Betragsspektrum eines Ausschnitts: Hann-Fenster über `len` Samples, mit Nullen auf n aufgefüllt.
export function magnitude(x, start, len, n) {
  const f = getFFT(n);
  const w = hann(len);
  f.re.fill(0);
  f.im.fill(0);
  const s0 = Math.max(0, Math.floor(start));
  for (let i = 0; i < len && s0 + i < x.length; i++) f.re[i] = x[s0 + i] * w[i];
  f.run();
  const out = new Float32Array(n / 2);
  const norm = 2 / Math.max(1, len);
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(f.re[i], f.im[i]) * norm;
  return out;
}

export function rms(x, start = 0, len = x.length) {
  let s = 0;
  const end = Math.min(x.length, start + len);
  for (let i = Math.max(0, start); i < end; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, end - start));
}

export const midiToHz = (m, a4 = 440) => a4 * 2 ** ((m - 69) / 12);
export const hzToMidi = (f, a4 = 440) => 69 + 12 * Math.log2(f / a4);

function median(arr) {
  if (!arr.length) return 0;
  const s = Float64Array.from(arr).sort();
  return s[Math.floor(s.length / 2)];
}
export { median };

export function quantile(arr, q) {
  if (!arr.length) return 0;
  const s = Float64Array.from(arr).sort();
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

// Anschläge finden: spektraler Fluss mit logarithmischer Stauchung, damit auch weiche Nylon-Anschläge zählen.
export function detectOnsets(x, sr, { size = 1024, hop = 256, minGap = 0.07, sensitivity = 1 } = {}) {
  const frames = Math.max(0, Math.floor((x.length - size) / hop) + 1);
  if (frames < 3) return [];
  const loBin = Math.floor((60 * size) / sr);
  const hiBin = Math.min(size / 2, Math.ceil((8000 * size) / sr));
  let prev = null;
  const flux = new Float32Array(frames);
  const level = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const mag = magnitude(x, i * hop, size, size);
    const cur = new Float32Array(hiBin);
    let sum = 0;
    for (let k = loBin; k < hiBin; k++) {
      cur[k] = Math.log1p(1000 * mag[k]);
      if (prev) {
        const d = cur[k] - prev[k];
        if (d > 0) sum += d;
      }
    }
    flux[i] = prev ? sum / (hiBin - loBin) : 0;
    level[i] = rms(x, i * hop, size);
    prev = cur;
  }
  const floor = quantile(Array.from(level), 0.1);
  const loudest = quantile(Array.from(level), 0.98);
  // Bei durchgehendem Spielen ist der Grundpegel hoch, daher begrenzt.
  const gate = Math.max(0.0015, loudest * 0.04, Math.min(floor * 3, loudest * 0.15));
  const globalMean = flux.reduce((a, b) => a + b, 0) / frames;
  const W = Math.round((0.15 * sr) / hop);
  const out = [];
  let last = -Infinity;
  for (let i = 1; i < frames - 1; i++) {
    if (flux[i] < flux[i - 1] || flux[i] < flux[i + 1]) continue;
    const from = Math.max(0, i - W);
    const to = Math.min(frames, i + W + 1);
    const local = median(Array.from(flux.subarray(from, to)));
    const thr = (local * 1.6 + globalMean * 0.9) / sensitivity;
    if (flux[i] <= thr) continue;
    const after = Math.max(level[i], level[Math.min(frames - 1, i + 2)]);
    if (after < gate) continue;
    const t = (i * hop + size * 0.5) / sr;
    if (t - last < minGap) {
      if (out.length && flux[i] > out[out.length - 1].strength) {
        out[out.length - 1] = { t, strength: flux[i] };
        last = t;
      }
      continue;
    }
    out.push({ t, strength: flux[i] });
    last = t;
  }
  return out;
}

// Logarithmische Frequenzachse: drei Bins pro Halbton von MIDI 36 bis 100.
export const LS_LO = 36;
export const LS_HI = 100;
export const LS_BPS = 3;
export const LS_BINS = (LS_HI - LS_LO) * LS_BPS + 1;

export function logSpectrum(mag, sr, n) {
  const out = new Float32Array(LS_BINS);
  const hzPerBin = sr / n;
  for (let b = 0; b < LS_BINS; b++) {
    const m = LS_LO + b / LS_BPS;
    const f = midiToHz(m);
    const half = 2 ** (1 / (2 * LS_BPS * 12));
    const kLo = (f / half) / hzPerBin;
    const kHi = (f * half) / hzPerBin;
    if (kHi - kLo < 1.5) {
      const k = f / hzPerBin;
      const k0 = Math.floor(k);
      const frac = k - k0;
      out[b] = (mag[k0] || 0) * (1 - frac) + (mag[k0 + 1] || 0) * frac;
      out[b] = Math.max(out[b], mag[Math.round(k)] || 0);
    } else {
      let v = 0;
      for (let k = Math.floor(kLo); k <= Math.ceil(kHi) && k < mag.length; k++) v = Math.max(v, mag[k]);
      out[b] = v;
    }
  }
  return out;
}

// Obertonprofile: Nylon hat weniger und schneller abfallende Obertöne als Stahl.
export const PROFILES = {
  nylon: [1, 0.8, 0.55, 0.38, 0.26, 0.18, 0.12, 0.08, 0.05, 0.035],
  steel: [1, 0.9, 0.72, 0.58, 0.46, 0.36, 0.28, 0.22, 0.17, 0.13],
  electric: [1, 0.85, 0.65, 0.5, 0.38, 0.28, 0.2, 0.15, 0.11, 0.08],
};

export const NOTE_LO = 38;
export const NOTE_HI = 88;

const templateCache = new Map();

export function noteTemplates(profileName = 'nylon') {
  if (templateCache.has(profileName)) return templateCache.get(profileName);
  const profile = PROFILES[profileName] || PROFILES.nylon;
  const W = [];
  for (let m = NOTE_LO; m <= NOTE_HI; m++) {
    const t = new Float32Array(LS_BINS);
    const f0 = midiToHz(m);
    profile.forEach((amp0, idx) => {
      const h = idx + 1;
      const hm = hzToMidi(f0 * h);
      if (hm > LS_HI) return;
      const pos = (hm - LS_LO) * LS_BPS;
      // Tiefe Grundtöne sind bei kleinen Gitarren und Mikros schwach.
      const amp = h === 1 && f0 < 110 ? amp0 * 0.6 : amp0;
      for (let b = Math.max(0, Math.floor(pos - 2)); b <= Math.min(LS_BINS - 1, Math.ceil(pos + 2)); b++) {
        t[b] += amp * Math.exp(-0.5 * ((b - pos) / 0.7) ** 2);
      }
    });
    W.push(t);
  }
  const K = W.length;
  const WtW = new Float64Array(K * K);
  for (let a = 0; a < K; a++) {
    for (let b = a; b < K; b++) {
      let s = 0;
      for (let i = 0; i < LS_BINS; i++) s += W[a][i] * W[b][i];
      WtW[a * K + b] = s;
      WtW[b * K + a] = s;
    }
  }
  const set = { W, WtW, K, lo: NOTE_LO };
  templateCache.set(profileName, set);
  return set;
}

// Zerlegt ein logarithmisches Spektrum in Notenstärken (nicht-negative kleinste Quadrate, multiplikativ).
export function decompose(ls, set, iters = 150) {
  const { W, WtW, K } = set;
  const WtX = new Float64Array(K);
  let mean = 0;
  for (let i = 0; i < LS_BINS; i++) mean += ls[i];
  mean /= LS_BINS;
  for (let k = 0; k < K; k++) {
    let s = 0;
    const w = W[k];
    for (let i = 0; i < LS_BINS; i++) s += w[i] * ls[i];
    WtX[k] = s;
  }
  const h = new Float64Array(K).fill(mean + 1e-9);
  for (let it = 0; it < iters; it++) {
    for (let k = 0; k < K; k++) {
      let d = 1e-12;
      const row = k * K;
      for (let j = 0; j < K; j++) d += WtW[row + j] * h[j];
      h[k] *= WtX[k] / d;
    }
  }
  return h;
}

export const noteIndex = (midi, set) => midi - set.lo;

// Genaue Tonhöhe eines Tons aus den ersten Obertönen, in Cent gegenüber dem Soll.
// `others`: weitere klingende Töne. Obertöne, die mit deren Obertönen zusammenfallen, werden übersprungen.
export function centsOffset(mag, sr, n, midi, others = []) {
  const f0 = midiToHz(midi);
  const clash = [];
  for (const o of others) for (let k = 1; k <= 6; k++) clash.push(midiToHz(o) * k);
  let wsum = 0;
  let csum = 0;
  for (let h = 1; h <= 4; h++) {
    const f = f0 * h;
    if (clash.some((c) => Math.abs(1200 * Math.log2(c / f)) < 35)) continue;
    const k = f / (sr / n);
    const span = Math.max(2, Math.ceil(k * (2 ** (40 / 1200) - 1)));
    let best = -1;
    let bv = 0;
    for (let i = Math.max(1, Math.floor(k - span)); i <= Math.min(mag.length - 2, Math.ceil(k + span)); i++) {
      if (mag[i] > bv && mag[i] >= mag[i - 1] && mag[i] >= mag[i + 1]) { bv = mag[i]; best = i; }
    }
    if (best < 0) continue;
    const a = mag[best - 1];
    const b = mag[best];
    const c = mag[best + 1];
    const den = a - 2 * b + c;
    const p = den !== 0 ? (0.5 * (a - c)) / den : 0;
    const fp = (best + p) * (sr / n);
    const cents = 1200 * Math.log2(fp / f);
    const w = bv * h;
    wsum += w;
    csum += cents * w;
  }
  return wsum > 0 ? csum / wsum : null;
}

// Anteil hoher Frequenzen: steigt, wenn eine Saite schnarrt.
export function highBandRatio(mag, sr, n) {
  const hz = sr / n;
  let low = 0;
  let high = 0;
  for (let i = Math.floor(80 / hz); i < mag.length; i++) {
    const f = i * hz;
    const p = mag[i] * mag[i];
    if (f < 2500) low += p;
    else if (f < 7000) high += p;
  }
  return high / (low + 1e-12);
}
