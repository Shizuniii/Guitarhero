// Bewertung von Aufnahmen. Reine Funktionen: liefern Daten, die Texte entstehen in feedback.js.
import {
  decompose, detectOnsets, evidence, highBandRatio, hzToMidi, logSpectrum, magnitude, median, nextPow2,
  noteIndex, noteTemplates, NOTE_HI, NOTE_LO, quantile, rms, sounds,
} from './dsp.js';

export const STANDARD = [40, 45, 50, 55, 59, 64];

// Akkord aus absoluten Bünden (-1 = nicht anschlagen), Saite 0 = tiefe E-Saite.
export function chordModel(name, frets, tuning = STANDARD) {
  const notes = [];
  const muted = [];
  frets.forEach((f, s) => {
    if (f < 0) muted.push({ string: s, openMidi: tuning[s] });
    else notes.push({ string: s, fret: f, midi: tuning[s] + f, openMidi: tuning[s] });
  });
  return { name, notes, muted };
}

function notesAt(x, sr, t, len, set) {
  const n = nextPow2(sr * 0.34);
  const lenS = Math.min(n, Math.max(64, Math.round(len * sr)));
  const mag = magnitude(x, Math.round(t * sr), lenS, n);
  const ls = logSpectrum(mag, sr, n);
  return { h: decompose(ls, set), mag, n };
}

const inRange = (m) => m >= NOTE_LO && m <= NOTE_HI;

// Bewertet einen Anschlag gegen den erwarteten Akkord.
// Prüft einen Anschlag gegen den Akkord. Gemeldet wird nur, was sich an eindeutigen Obertönen belegen lässt.
export function judgeStrum(mag, sr, n, chord) {
  const exp = chord.notes;
  const all = exp.map((e) => e.midi);
  const issues = [];
  const extra = [];
  // 1. Saiten, die nicht angeschlagen werden sollen
  for (const m of chord.muted) {
    if (exp.some((e) => e.midi === m.openMidi)) continue;
    if (sounds(evidence(mag, sr, n, m.openMidi, all)) === 'yes') {
      issues.push({ kind: 'muted-rings', string: m.string });
      extra.push(m.openMidi);
    }
  }
  // 2. Erwartete Töne
  const missing = [];
  for (const e of exp) {
    const others = [...all.filter((m) => m !== e.midi), ...extra];
    if (sounds(evidence(mag, sr, n, e.midi, others)) === 'no') missing.push(e);
    else if (sounds(evidence(mag, sr, n, e.midi, others)) === null) {
      // Lässt sich der Ton selbst nicht belegen, kann trotzdem ein Ersatzton eindeutig klingen.
      e.unsure = true;
    }
  }
  const used = new Set();
  for (const e of exp) {
    if (e.fret === 0 || !(missing.includes(e) || e.unsure)) continue;
    const others = [...all.filter((x) => x !== e.midi), ...extra];
    const cands = [];
    if (!all.includes(e.openMidi)) cands.push({ m: e.openMidi, issue: { kind: 'open', string: e.string, fret: e.fret } });
    for (const d of [1, -1, 2, -2]) {
      const m = e.midi + d;
      if (m === e.openMidi || all.includes(m) || chord.muted.some((x) => x.openMidi === m)) continue;
      cands.push({ m, issue: { kind: 'fret', string: e.string, fret: e.fret, delta: d } });
    }
    // Ließ sich der erwartete Ton selbst nicht prüfen, muss der Ersatzton doppelt belegt sein.
    const strict = !missing.includes(e);
    let best = null;
    for (const c of cands) {
      const ev = evidence(mag, sr, n, c.m, others);
      if (sounds(ev) !== 'yes') continue;
      const top = Math.max(...ev.map((v) => v.snr));
      if (strict && !(top >= 40 && ev.filter((v) => v.snr >= 15).length >= 2)) continue;
      if (!best || top > best.top) best = { ...c, top };
    }
    if (best) { issues.push(best.issue); used.add(e); }
  }
  for (const e of exp) delete e.unsure;
  if (missing.length >= Math.ceil(exp.length * 0.6) && !used.size) return null;
  for (const e of missing) if (!used.has(e)) issues.push({ kind: 'missing', string: e.string, fret: e.fret });
  return issues;
}

const PENALTY = { missing: 0.3, open: 0.35, fret: 0.35, 'muted-rings': 0.25, extra: 0.2, buzz: 0.2 };

export const issueKey = (i) => `${i.chord ? `${i.chord}:` : ''}${i.kind}:${i.string ?? i.midi ?? ''}:${i.delta ?? ''}`;

function aggregate(segments, total) {
  const map = new Map();
  for (const seg of segments) {
    for (const i of seg.issues) {
      const key = issueKey(i);
      if (!map.has(key)) map.set(key, { ...i, key, count: 0, times: [] });
      const e = map.get(key);
      e.count += 1;
      e.times.push(seg.t0);
    }
  }
  // Nur Fehler melden, die wiederholt auftreten: Einzelfälle sind oft Messrauschen.
  return [...map.values()]
    .filter((e) => e.count >= 2 && e.count >= total * 0.2)
    .sort((a, b) => b.count - a.count);
}

// Ein langsamer Strum über sechs Saiten erzeugt mehrere Anschläge kurz hintereinander: die gehören zusammen.
export function strumClusters(onsets, gap = 0.2) {
  const out = [];
  for (const o of onsets) {
    const last = out[out.length - 1];
    if (last && o.t - last.end < gap) last.end = o.t;
    else out.push({ t: o.t, end: o.t });
  }
  return out;
}

function strumSegments(x, sr, onsets, duration) {
  const out = [];
  const groups = strumClusters(onsets);
  groups.forEach((o, i) => {
    const next = i + 1 < groups.length ? groups[i + 1].t : duration;
    const start = o.end + 0.05;
    const len = Math.min(0.34, next - start - 0.02);
    if (len < 0.07) return;
    out.push({ t0: Math.max(0, o.t - 0.03), t1: next, start, len, level: rms(x, Math.round(start * sr), Math.round(len * sr)) });
  });
  const typical = median(out.map((s) => s.level));
  return out.filter((s) => s.level >= typical * 0.2);
}

function evaluateStrums(x, sr, segs, chordAt, set) {
  const ratios = [];
  const results = segs.map((s) => {
    const chord = chordAt(s.start);
    if (!chord) return { ...s, chord: null, issues: [], score: null };
    const { mag, n } = notesAt(x, sr, s.start, s.len, set);
    const judged = judgeStrum(mag, sr, n, chord);
    if (!judged) return { ...s, chord: null, issues: [], score: null };
    const issues = judged.map((i) => ({ ...i, chord: chord.name }));
    const short = nextPow2(sr * 0.15);
    const ratio = highBandRatio(magnitude(x, Math.round((s.start - 0.01) * sr), Math.min(short, Math.round(0.14 * sr)), short), sr, short);
    ratios.push(ratio);
    return { ...s, chord: chord.name, issues, ratio };
  });
  const typicalRatio = quantile(ratios, 0.25);
  for (const r of results) {
    if (r.ratio === undefined) continue;
    let score = 1;
    for (const i of r.issues) score -= PENALTY[i.kind] || 0.2;
    r.score = Math.max(0, Math.min(1, score));
  }
  const dedup = [];
  return { results, tuningIssues: dedup };
}

function levelInfo(x) {
  let peak = 0;
  for (let i = 0; i < x.length; i += 4) peak = Math.max(peak, Math.abs(x[i]));
  return { peak };
}

const emptyResult = (kind, x, sr) => {
  const { peak } = levelInfo(x);
  return { kind, duration: x.length / sr, empty: true, reason: peak < 0.01 ? 'silent' : 'no-strums', peak, segments: [], issues: [] };
};

export function analyzeChord(x, sr, chord, { profile = 'nylon' } = {}) {
  const set = noteTemplates(profile);
  const duration = x.length / sr;
  const segs = strumSegments(x, sr, detectOnsets(x, sr), duration);
  if (!segs.length) return emptyResult('chord', x, sr);
  const { results, tuningIssues } = evaluateStrums(x, sr, segs, () => chord, set);
  const issues = [...aggregate(results, results.length).map((i) => ({ ...i, chord: undefined })), ...tuningIssues.map((t) => ({ ...t, chord: undefined }))];
  return {
    kind: 'chord', duration, chord: chord.name,
    segments: results.map((r) => ({ t0: r.t0, t1: r.t1, score: r.score, issues: r.issues.map((i) => i.kind) })),
    issues, total: results.length, clean: results.filter((r) => r.score >= 0.85).length,
  };
}

// Erkennt, welcher von zwei Akkorden gerade klingt, über die Töne, die nur einer der beiden hat.
export function changeModel(a, b) {
  const am = new Set(a.notes.map((n) => n.midi));
  const bm = new Set(b.notes.map((n) => n.midi));
  let onlyA = [...am].filter((m) => !bm.has(m));
  let onlyB = [...bm].filter((m) => !am.has(m));
  if (!onlyA.length && !onlyB.length) {
    const ap = new Set([...am].map((m) => m % 12));
    const bp = new Set([...bm].map((m) => m % 12));
    onlyA = [...am].filter((m) => !bp.has(m % 12));
    onlyB = [...bm].filter((m) => !ap.has(m % 12));
  }
  return { a, b, onlyA: onlyA.filter(inRange), onlyB: onlyB.filter(inRange) };
}

export function frameLabel(h, model, set) {
  const avg = (list) => (list.length ? list.reduce((s, m) => s + h[noteIndex(m, set)], 0) / list.length : 0);
  const ea = avg(model.onlyA);
  const eb = avg(model.onlyB);
  const r = (ea - eb) / (ea + eb + 1e-12);
  if (r > 0.25) return 'a';
  if (r < -0.25) return 'b';
  return null;
}

export class ChordSwitcher {
  constructor(need = 2) { this.need = need; this.current = null; this.cand = null; this.run = 0; this.count = 0; this.switches = []; }

  push(label, t = 0) {
    if (!label) { this.run = 0; return this.count; }
    if (label === this.current) { this.cand = null; this.run = 0; return this.count; }
    if (label === this.cand) this.run += 1; else { this.cand = label; this.run = 1; }
    if (this.run >= this.need) {
      if (this.current) { this.count += 1; this.switches.push(t); }
      this.current = label;
      this.cand = null;
      this.run = 0;
    }
    return this.count;
  }
}

const FRAME_HOP = 0.1;

// Für die Anzeige während des Spielens: bekommt laufend neue Samples.
export class LiveChangeCounter {
  constructor(a, b, sr, profile = 'nylon') {
    this.model = changeModel(a, b);
    this.sr = sr;
    this.set = noteTemplates(profile);
    this.n = nextPow2(sr * 0.17);
    this.ring = new Float32Array(this.n);
    this.filled = 0;
    this.sinceHop = 0;
    this.hop = Math.round(FRAME_HOP * sr);
    this.switcher = new ChordSwitcher(2);
    this.levels = [];
  }

  push(chunk) {
    const n = this.n;
    if (chunk.length >= n) this.ring.set(chunk.subarray(chunk.length - n));
    else {
      this.ring.copyWithin(0, chunk.length);
      this.ring.set(chunk, n - chunk.length);
    }
    this.filled = Math.min(n, this.filled + chunk.length);
    this.sinceHop += chunk.length;
    if (this.filled < n || this.sinceHop < this.hop) return this.switcher.count;
    this.sinceHop = 0;
    const level = rms(this.ring);
    this.levels.push(level);
    if (this.levels.length > 100) this.levels.shift();
    const loud = quantile(this.levels, 0.9);
    if (level < Math.max(0.002, loud * 0.12)) return this.switcher.push(null);
    const mag = magnitude(this.ring, 0, n, n);
    const h = decompose(logSpectrum(mag, this.sr, n), this.set, 60);
    return this.switcher.push(frameLabel(h, this.model, this.set));
  }
}

export function analyzeChange(x, sr, a, b, { profile = 'nylon' } = {}) {
  const set = noteTemplates(profile);
  const model = changeModel(a, b);
  const duration = x.length / sr;
  const n = nextPow2(sr * 0.17);
  const hop = Math.round(FRAME_HOP * sr);
  const levels = [];
  for (let s = 0; s + n <= x.length; s += hop) levels.push(rms(x, s, n));
  const loud = quantile(levels, 0.9);
  const switcher = new ChordSwitcher(2);
  const timeline = [];
  for (let s = 0, i = 0; s + n <= x.length; s += hop, i++) {
    const t = (s + n) / sr;
    let label = null;
    if (levels[i] >= Math.max(0.002, loud * 0.12)) {
      const mag = magnitude(x, s, n, n);
      label = frameLabel(decompose(logSpectrum(mag, sr, n), set, 80), model, set);
    }
    switcher.push(label, t);
    timeline.push({ t, current: switcher.current });
  }
  const chordAt = (t) => {
    let cur = null;
    for (const f of timeline) {
      if (f.t > t + 0.25) break;
      cur = f.current;
    }
    return cur === 'a' ? a : cur === 'b' ? b : null;
  };
  const segs = strumSegments(x, sr, detectOnsets(x, sr), duration);
  if (!segs.length) return { ...emptyResult('change', x, sr), count: switcher.count };
  const { results, tuningIssues } = evaluateStrums(x, sr, segs, chordAt, set);
  const judged = results.filter((r) => r.score !== null);
  return {
    kind: 'change', duration, count: switcher.count, switches: switcher.switches, chords: [a.name, b.name],
    segments: judged.map((r) => ({ t0: r.t0, t1: r.t1, score: r.score, chord: r.chord, issues: r.issues.map((i) => i.kind) })),
    issues: [...aggregate(judged, judged.length), ...tuningIssues],
    total: judged.length, clean: judged.filter((r) => r.score >= 0.85).length,
  };
}

// Strum: Anschläge gegen die Metronom-Schläge.
const SUB = { 1: [''], 2: ['', '+'], 3: ['', '+', 'a'], 4: ['', 'e', '+', 'a'] };
export const slotName = (i, per) => (i % per === 0 ? String(i / per + 1) : SUB[per]?.[i % per] ? `${Math.floor(i / per) + 1}${SUB[per][i % per]}` : String(i));

function nearestIndex(list, t) {
  let lo = 0;
  let hi = list.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < t) lo = mid; else hi = mid;
  }
  return Math.abs(list[lo] - t) <= Math.abs(list[hi] - t) ? lo : hi;
}

export function analyzeStrumPattern(x, sr, { startTime, latency = 0, ticks, slots, perBeat = 2, calibrated = false }) {
  const duration = x.length / sr;
  // Ein Strum über mehrere Saiten zählt als ein Anschlag, gemessen ab der ersten Saite.
  const onsets = strumClusters(detectOnsets(x, sr, { minGap: 0.06 }), 0.12);
  const valid = ticks.filter((k) => k.time >= startTime + 0.05 && k.time <= startTime + duration - 0.15).sort((p, q) => p.time - q.time);
  if (valid.length < slots.length) return emptyResult('strum', x, sr);
  const slotDur = median(valid.slice(1).map((k, i) => k.time - valid[i].time));
  const tol = Math.min(0.07, Math.max(0.035, slotDur * 0.3));
  const times = valid.map((k) => k.time);
  const matched = new Map();
  for (const o of onsets) {
    const t = startTime + o.t - latency;
    const j = nearestIndex(times, t);
    const dt = t - times[j];
    if (Math.abs(dt) > slotDur * 0.5) continue;
    if (!matched.has(j) || Math.abs(dt) < Math.abs(matched.get(j))) matched.set(j, dt);
  }
  const bars = new Map();
  const offsets = [];
  const misses = new Map();
  const extras = new Map();
  const barTicks = new Map();
  for (const k of valid) {
    const bar = Math.floor(k.index / slots.length);
    barTicks.set(bar, (barTicks.get(bar) || 0) + 1);
  }
  valid.forEach((k, j) => {
    const slot = k.index % slots.length;
    const bar = Math.floor(k.index / slots.length);
    if (barTicks.get(bar) !== slots.length) return;
    if (!bars.has(bar)) bars.set(bar, { bar, t0: k.time, expected: 0, good: 0, extra: 0, ticks: 0 });
    const b = bars.get(bar);
    b.ticks += 1;
    b.t1 = k.time + slotDur;
    const want = slots[slot] !== '-';
    const dt = matched.get(j);
    if (want) {
      b.expected += 1;
      if (dt === undefined) misses.set(slot, [...(misses.get(slot) || []), k.time]);
      else {
        offsets.push({ t: k.time, dt });
        b.good += Math.abs(dt) <= tol ? 1 : 0.5;
      }
    } else if (dt !== undefined) {
      b.extra += 1;
      extras.set(slot, [...(extras.get(slot) || []), k.time]);
    }
  });
  const full = [...bars.values()].filter((b) => b.ticks === slots.length);
  const toRec = (t) => t - startTime + latency;
  const segments = full.map((b) => ({
    t0: toRec(b.t0), t1: toRec(b.t1),
    score: b.expected ? Math.max(0, Math.min(1, (b.good - b.extra * 0.5) / b.expected)) : 1,
    bar: b.bar,
  }));
  const barCount = full.length || 1;
  const issues = [];
  for (const [slot, list] of misses) {
    if (list.length >= 2 && list.length >= barCount * 0.25) issues.push({ kind: 'miss', slot: slotName(slot, perBeat), count: list.length, of: barCount, times: list.map(toRec) });
  }
  for (const [slot, list] of extras) {
    if (list.length >= 2 && list.length >= barCount * 0.25) issues.push({ kind: 'extra-hit', slot: slotName(slot, perBeat), count: list.length, of: barCount, times: list.map(toRec) });
  }
  const dts = offsets.map((o) => o.dt);
  const mean = dts.length ? dts.reduce((a, b) => a + b, 0) / dts.length : 0;
  const spread = dts.length ? median(dts.map((d) => Math.abs(d - median(dts)))) : 0;
  if (calibrated && Math.abs(mean) >= 0.025) issues.push({ kind: mean < 0 ? 'early' : 'late', ms: Math.round(Math.abs(mean) * 1000) });
  if (offsets.length >= 8) {
    const half = Math.floor(offsets.length / 2);
    const first = median(offsets.slice(0, half).map((o) => o.dt));
    const second = median(offsets.slice(half).map((o) => o.dt));
    const drift = second - first;
    if (Math.abs(drift) >= 0.025) issues.push({ kind: drift < 0 ? 'rushing' : 'dragging', ms: Math.round(Math.abs(drift) * 1000) });
  }
  if (spread >= 0.035) issues.push({ kind: 'unsteady', ms: Math.round(spread * 1000) });
  issues.sort((p, q) => (q.count || 0) - (p.count || 0));
  const expected = full.reduce((n, b) => n + b.expected, 0);
  const inTime = offsets.filter((o) => Math.abs(o.dt) <= tol).length;
  return {
    kind: 'strum', duration, segments, issues, calibrated,
    expected, hit: offsets.length, inTime, meanMs: Math.round(mean * 1000), tolMs: Math.round(tol * 1000), bars: full.length,
  };
}

// Riffs und Songs: jede erwartete Note gegen das, was zu hören war. Timing relativ zum eigenen Durchschnitt.
export function analyzeScore(x, sr, { startTime, latency = 0, events, profile = 'nylon' }) {
  const set = noteTemplates(profile);
  const duration = x.length / sr;
  const onsets = detectOnsets(x, sr, { minGap: 0.05 }).map((o) => startTime + o.t - latency);
  const evs = events.filter((e) => e.time >= startTime && e.time <= startTime + duration - 0.05).sort((p, q) => p.time - q.time);
  if (!evs.length) return emptyResult('score', x, sr);
  if (!onsets.length) return emptyResult('score', x, sr);
  const near = (t, win) => {
    const j = nearestIndex(onsets, t);
    return Math.abs(onsets[j] - t) <= win ? onsets[j] : null;
  };
  const first = evs.map((e) => near(e.time, 0.25)).map((o, i) => (o === null ? null : o - evs[i].time)).filter((v) => v !== null);
  const shift = first.length >= 4 ? median(first) : 0;
  const results = evs.map((e, i) => {
    const prev = i > 0 ? evs[i - 1].time : -Infinity;
    const next = i + 1 < evs.length ? evs[i + 1].time : e.time + 0.5;
    const win = Math.max(0.06, Math.min(0.15, (Math.min(e.time - prev, next - e.time)) * 0.45));
    const o = near(e.time + shift, win);
    if (o === null) return { ...e, status: 'missed' };
    const off = o - e.time - shift;
    const rec = o - startTime + latency;
    const postLen = Math.max(0.06, Math.min(0.22, next + shift - o - 0.02));
    const post = notesAt(x, sr, rec + 0.03, postLen, set).h;
    const pre = notesAt(x, sr, Math.max(0, rec - 0.12), 0.1, set).h;
    const d = post.map((v, k) => Math.max(0, v - pre[k] * 0.8));
    const top = Math.max(...d) || 1e-9;
    const wanted = e.notes.filter((nt) => inRange(nt.midi));
    const absent = wanted.filter((nt) => d[noteIndex(nt.midi, set)] < 0.3 * top);
    let status = Math.abs(off) <= 0.06 ? 'ok' : 'timing';
    let heard = null;
    if (wanted.length && absent.length === wanted.length) {
      let best = 0;
      for (let k = 1; k < d.length; k++) if (d[k] > d[best]) best = k;
      heard = best + set.lo;
      const target = wanted[0].midi;
      if (heard % 12 === target % 12) { heard = null; } else status = 'wrong';
    }
    return { ...e, status, offMs: Math.round(off * 1000), heard };
  });
  const toRec = (t) => t - startTime + latency;
  const groups = [];
  results.forEach((r) => {
    const last = groups[groups.length - 1];
    if (!last || last.bar !== r.bar || r.time < last.tEnd - 0.01) groups.push({ bar: r.bar, t0: r.time, tEnd: r.time, items: [] });
    const g = groups[groups.length - 1];
    g.items.push(r);
    g.tEnd = r.time;
  });
  const val = { ok: 1, timing: 0.6, wrong: 0.15, missed: 0 };
  const segments = groups.map((g, i) => ({
    t0: toRec(g.t0) - 0.05, t1: i + 1 < groups.length ? toRec(groups[i + 1].t0) - 0.05 : toRec(g.tEnd) + 0.4,
    score: g.items.reduce((s, r) => s + val[r.status], 0) / g.items.length, bar: g.bar,
  }));
  const problems = results.filter((r) => r.status === 'wrong' || r.status === 'missed' || (r.status === 'timing' && Math.abs(r.offMs) >= 90));
  const issues = problems.slice(0, 14).map((r) => ({
    kind: `note-${r.status}`, bar: r.bar, idx: r.idx, notes: r.notes, heard: r.heard, offMs: r.offMs, times: [toRec(r.time)],
  }));
  return {
    kind: 'score', duration, segments, issues,
    expected: results.length, correct: results.filter((r) => r.status === 'ok' || r.status === 'timing').length,
    inTime: results.filter((r) => r.status === 'ok').length,
  };
}

// Timing-Abgleich: Abstand zwischen Klick und gehörtem Anschlag.
export function analyzeCalibration(x, sr, { startTime, clicks }) {
  const onsets = detectOnsets(x, sr, { minGap: 0.15 }).map((o) => startTime + o.t);
  const offs = [];
  for (const c of clicks) {
    const cand = onsets.filter((t) => t >= c - 0.05 && t <= c + 0.45);
    if (cand.length) offs.push(cand[0] - c);
  }
  if (offs.length < 5) return { ok: false, found: offs.length };
  const m = median(offs);
  const spread = median(offs.map((o) => Math.abs(o - m)));
  return { ok: spread < 0.06, latencyMs: Math.round(m * 1000), spreadMs: Math.round(spread * 1000), found: offs.length };
}

// Saiten-Check: Welche Saite wurde gezupft? Passt der Ton zu einer anderen Saite des Akkords
// (nochmal gezupft oder Reihenfolge vertauscht), zählt er für diese Saite.
export function assignPluck({ freq, clarity }, strings, current) {
  if (freq && clarity >= 0.75) {
    const m = hzToMidi(freq);
    // Genau passender Ton zählt für seine Saite. Oktav-Abweichungen (Messfehler) nur für die aktuelle Saite,
    // sonst würde C4 auf der B-Saite als C3 der A-Saite gelten.
    const match = strings.find((s) => Math.abs(m - s.midi) <= 0.4);
    if (match) return { string: match.string, result: { status: 'ok', cents: Math.round((m - match.midi - Math.round(m - match.midi)) * 100) } };
  }
  const target = strings[current];
  return { string: target.string, result: classifyPluck({ freq, clarity }, target.midi, target.openMidi) };
}

// Saiten-Check: ein einzeln gezupfter Ton gegen den erwarteten.
export function classifyPluck({ freq, clarity }, expected, openMidi) {
  if (!freq || clarity < 0.75) return { status: 'dead' };
  const midi = hzToMidi(freq);
  const d = midi - expected;
  if (Math.abs(d) <= 0.4) return { status: 'ok', cents: Math.round(d * 100) };
  if (Math.abs(d - 12) <= 0.4 || Math.abs(d + 12) <= 0.4) return { status: 'ok', cents: Math.round(((d % 12) + 12) % 12 > 6 ? (d % 12) * 100 : (d % 12) * 100) };
  if (expected !== openMidi && Math.abs(midi - openMidi) <= 0.4) return { status: 'open' };
  if (Math.abs(d) <= 2.4) return { status: 'fret', delta: Math.round(d) };
  return { status: 'other', heard: Math.round(midi) };
}
