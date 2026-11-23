// node tests/analysis.test.mjs: prüft die Bewertung mit künstlichen Gitarrenaufnahmen.
import assert from 'node:assert/strict';
import { analyzeCalibration, analyzeChange, analyzeChord, analyzeScore, analyzeStrumPattern, chordModel, LiveChangeCounter } from '../src/lib/analysis.js';
import { buzz, noise, SR, strumChord } from './synth/guitar.mjs';

const C = chordModel('C', [-1, 3, 2, 0, 1, 0]);
const Am = chordModel('Am', [-1, 0, 2, 2, 1, 0]);
const D = chordModel('D', [-1, -1, 0, 2, 3, 2]);
const mid = (m) => m.notes.map((n) => n.midi);
let failures = 0;
const check = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${info}`); if (!cond) failures++; };

function take(build, seconds = 9) {
  const x = new Float32Array(seconds * SR);
  build(x);
  noise(x);
  return x;
}
const eight = (fn) => { for (let i = 0; i < 8; i++) fn(0.5 + i * 1.0, i); };
const kinds = (r) => r.issues.map((i) => `${i.kind}${i.string !== undefined ? `@${i.string}` : ''}${i.delta ? `(${i.delta})` : ''}`).join(', ');

// 1. Sauberer Akkord
let r = analyzeChord(take((x) => eight((t, i) => strumChord(x, mid(C), t, { seed: i + 1 }))), SR, C);
check('C sauber: 8 Anschläge erkannt', r.total === 8, `total=${r.total}`);
check('C sauber: keine Fehler', r.issues.length === 0, kinds(r));
check('C sauber: alles grün', r.clean >= 7, `clean=${r.clean}`);

// 2. A-Saite gedämpft (C3 fehlt)
r = analyzeChord(take((x) => eight((t, i) => strumChord(x, mid(C).filter((m) => m !== 48), t, { seed: i + 3 }))), SR, C);
check('C ohne A-Saite: fehlt erkannt', r.issues.some((i) => i.kind === 'missing' && i.string === 1), kinds(r));

// 3. Tiefe E-Saite mitgespielt
r = analyzeChord(take((x) => eight((t, i) => strumChord(x, [40, ...mid(C)], t, { seed: i + 5 }))), SR, C);
check('C mit tiefer E: erkannt', r.issues.some((i) => i.kind === 'muted-rings' && i.string === 0), kinds(r));

// 4. Falscher Bund auf der D-Saite (F3 statt E3)
r = analyzeChord(take((x) => eight((t, i) => strumChord(x, mid(C).map((m) => (m === 52 ? 53 : m)), t, { seed: i + 7 }))), SR, C);
check('C falscher Bund: erkannt', r.issues.some((i) => i.kind === 'fret' && i.string === 2 && i.delta === 1), kinds(r));

// 5. A-Saite klingt leer (Finger drückt nicht)
r = analyzeChord(take((x) => eight((t, i) => strumChord(x, mid(C).map((m) => (m === 48 ? 45 : m)), t, { seed: i + 9 }))), SR, C);
check('C mit leerer A-Saite: erkannt', r.issues.some((i) => i.kind === 'open' && i.string === 1), kinds(r));

// 6. D-Dur mit A-Saite (die nicht mitklingen soll)
r = analyzeChord(take((x) => eight((t, i) => strumChord(x, [45, ...mid(D)], t, { seed: i + 11 }))), SR, D);
check('D mit A-Saite: erkannt', r.issues.some((i) => i.kind === 'muted-rings' && i.string === 1), kinds(r));

// 7. G-Saite verstimmt (30 Cent tief), offen gespielt in C
r = analyzeChord(take((x) => eight((t, i) => strumChord(x, mid(C), t, { seed: i + 13, cents: [0, 0, -30, 0, 0] }))), SR, C);
check('Verstimmung wird im Akkord nicht gemeldet (dafür gibt es das Stimmgerät)', !r.issues.some((i) => i.kind === 'detuned'), kinds(r));

// 8. Schnarren bei der Hälfte der Anschläge
r = analyzeChord(take((x) => eight((t, i) => { strumChord(x, mid(C), t, { seed: i + 15 }); if (i % 2) buzz(x, t + 0.02); })), SR, C);
check('Schnarren wird nicht geraten', !r.issues.some((i) => i.kind === 'buzz'), kinds(r));

// 9. Stille
r = analyzeChord(new Float32Array(SR * 3), SR, C);
check('Stille gemeldet', r.empty && r.reason === 'silent');

// 10. Wechsel Am/C: 10 Wechsel, je 2 Anschläge
const sw = take((x) => {
  for (let k = 0; k <= 10; k++) {
    const ch = k % 2 ? C : Am;
    strumChord(x, mid(ch), 0.4 + k * 1.4, { seed: k * 2 + 1, dur: 0.6 });
    strumChord(x, mid(ch), 0.4 + k * 1.4 + 0.6, { seed: k * 2 + 2, dur: 0.75 });
  }
}, 17);
r = analyzeChange(sw, SR, Am, C);
check('Wechsel: 10 gezählt', r.count === 10, `count=${r.count}`);
check('Wechsel: keine Fehler', r.issues.length === 0, kinds(r));
// 10a. Zählung bei schnellen Wechseln: Der Akkord klingt nur kurz, weil sofort umgegriffen wird.
const quick = (A, B, ring) => take((x) => {
  for (let k = 0; k <= 20; k++) strumChord(x, mid(k % 2 ? B : A), 0.5 + k * 0.5, { seed: k + 1, dur: ring, gain: 0.25 });
}, 12);
for (const [A, B] of [[chordModel('G', [3, 2, 0, 0, 0, 3]), chordModel('D', [-1, -1, 0, 2, 3, 2])], [chordModel('E', [0, 2, 2, 1, 0, 0]), chordModel('A', [-1, 0, 2, 2, 2, 0])]]) {
  r = analyzeChange(quick(A, B, 0.12), SR, A, B);
  check(`Schnelle Wechsel ${A.name}/${B.name} (120 pro Minute, Akkord klingt 0,12 s): mindestens 18 von 20`, r.count >= 18, `count=${r.count}`);
}
// 10a'. Der Korpus der Konzertgitarre schwingt bei jedem Anschlag um 90–125 Hz mit. Das darf ein C nicht zu Am machen.
const bodyC = take((x) => {
  for (let k = 0; k < 12; k++) {
    const t = 0.4 + k * 0.8;
    strumChord(x, mid(C), t, { seed: k + 3, dur: 0.7 });
    for (let i = 0; i < 0.4 * SR; i++) x[Math.round(t * SR) + i] += 0.12 * Math.exp(-i / (0.08 * SR)) * Math.sin((2 * Math.PI * 108 * i) / SR);
  }
}, 10);
r = analyzeChange(bodyC, SR, Am, C);
check('Nur C mit Korpus-Mitschwingen: kein Wechsel zu Am', r.count === 0, `count=${r.count}`);
const liveBody = new LiveChangeCounter(Am, C, SR);
let liveN = 0;
for (let i = 0; i < bodyC.length; i += 2048) liveN = liveBody.push(bodyC.subarray(i, Math.min(bodyC.length, i + 2048)));
check('Nur C mit Korpus-Mitschwingen: live kein Wechsel', liveN === 0, `live=${liveN}`);

// 10b. Wechsel E/A: Die leere tiefe E-Saite des E-Akkords klingt beim A nach. Das ist kein Fehler, nur ein Hinweis.
const E = chordModel('E', [0, 2, 2, 1, 0, 0]);
const A = chordModel('A', [-1, 0, 2, 2, 2, 0]);
const eaTake = (strikeLowE) => take((x) => {
  for (let k = 0; k < 10; k++) {
    const t = 0.4 + k * 1.3;
    if (k % 2 === 0) {
      // E: tiefe E-Saite klingt lange, die gegriffenen Saiten verstummen beim Umgreifen
      // Wird sie beim A neu angeschlagen, endet die alte Schwingung dort
      strumChord(x, [40], t, { seed: 7, dur: strikeLowE ? 1.3 : 2.4 });
      strumChord(x, mid(E).filter((m) => m !== 40), t + 0.004, { seed: k * 3 + 2, dur: 0.75 });
    } else {
      if (strikeLowE) strumChord(x, [40], t, { seed: 7, dur: 0.75 });
      strumChord(x, mid(A), t + (strikeLowE ? 0.012 : 0), { seed: k * 3 + 3, dur: 0.75 });
    }
  }
}, 14);
r = analyzeChange(eaTake(false), SR, E, A);
check('E→A Nachklang: kein Fehler „klingt mit“', !r.issues.some((i) => i.kind === 'muted-rings'), kinds(r));
check('E→A Nachklang: Hinweis auf tiefe E-Saite vom E-Akkord, sicher', r.hints.some((h) => h.kind === 'carry' && h.string === 0 && h.from === 'E' && h.chord === 'A' && !h.maybeStruck), JSON.stringify(r.hints.map((h) => `${h.kind}@${h.string} ${h.from}→${h.chord} ${h.maybeStruck}`)));
check('E→A Nachklang: nur Hinweise zu Saiten, die beim A nicht dazugehören', r.hints.every((h) => A.muted.some((m) => m.string === h.string)));
r = analyzeChange(eaTake(true), SR, E, A);
// Noch laut klingende Saite neu angeschlagen: wird kaum lauter, lässt sich nicht sicher von Nachklang trennen.
// Dann kein Fehler, aber ein Hinweis, der beide Möglichkeiten nennt.
check('E→A noch klingend mitgeschlagen: als unklar gemeldet', r.issues.some((i) => i.kind === 'muted-rings' && i.string === 0) || r.hints.some((h) => h.string === 0 && h.maybeStruck), `${kinds(r)} | ${JSON.stringify(r.hints.map((h) => `${h.string} ${h.maybeStruck}`))}`);
// Frisch angeschlagen (vorher still): sicher ein Fehler
const ecTake = take((x) => {
  for (let k = 0; k < 10; k++) {
    const t = 0.4 + k * 1.3;
    if (k % 2 === 0) strumChord(x, mid(E).filter((m) => m !== 40), t, { seed: k * 3 + 2, dur: 0.75 });
    else strumChord(x, [40, ...mid(A)], t, { seed: k * 3 + 3, dur: 0.75 });
  }
}, 14);
r = analyzeChange(ecTake, SR, E, A);
check('Tiefe E-Saite beim A frisch mitgeschlagen: Fehler', r.issues.some((i) => i.kind === 'muted-rings' && i.string === 0 && i.chord === 'A'), kinds(r));
check('Tiefe E-Saite beim A frisch mitgeschlagen: kein Nachklang-Hinweis', !r.hints.some((h) => h.string === 0), JSON.stringify(r.hints));

const live = new LiveChangeCounter(Am, C, SR);
for (let i = 0; i < sw.length; i += 2048) live.push(sw.subarray(i, i + 2048));
check('Live-Zähler: 10', live.switcher.count === 10, `live=${live.switcher.count}`);

// 11. Strum: Folk-Muster D - D U - U D U bei 80 BPM, Achtel
const slots = ['D', '-', 'D', 'U', '-', 'U', 'D', 'U'];
const bpm = 80;
const slotDur = 60 / bpm / 2;
const startTime = 10.0;
const latency = 0.08;
function strumTake(skipSlot = -1, shift = () => 0) {
  const ticks = [];
  const x = take((buf) => {
    for (let i = 0; i < 64; i++) {
      const tick = { index: i, time: startTime - 0.5 + i * slotDur };
      ticks.push(tick);
      const slot = i % 8;
      if (slots[slot] === '-' || slot === skipSlot) continue;
      const recT = tick.time - startTime + latency + shift(i);
      if (recT > 0.05) strumChord(buf, mid(Am), recT, { up: slots[slot] === 'U', gain: 0.18, dur: 0.6, seed: i });
    }
  }, 23);
  return { x, ticks };
}
let s = strumTake();
r = analyzeStrumPattern(s.x, SR, { startTime, latency, ticks: s.ticks, slots, perBeat: 2, calibrated: true });
check('Strum sauber: fast alles im Takt', r.inTime >= r.expected * 0.9, `inTime=${r.inTime}/${r.expected}`);
check('Strum sauber: keine Fehler', r.issues.length === 0, JSON.stringify(r.issues));
s = strumTake(6);
r = analyzeStrumPattern(s.x, SR, { startTime, latency, ticks: s.ticks, slots, perBeat: 2, calibrated: true });
check('Strum ohne 4: fehlt erkannt', r.issues.some((i) => i.kind === 'miss' && i.slot === '4'), JSON.stringify(r.issues.map((i) => [i.kind, i.slot])));
s = strumTake(-1, (i) => (i > 32 ? -0.05 : 0));
r = analyzeStrumPattern(s.x, SR, { startTime, latency, ticks: s.ticks, slots, perBeat: 2, calibrated: true });
check('Strum: schneller werden erkannt', r.issues.some((i) => i.kind === 'rushing'), JSON.stringify(r.issues.map((i) => [i.kind, i.ms])));

// 12. Riff: Einzeltöne, ein falscher Bund, eine fehlende Note
const riff = [45, 48, 50, 52, 55, 57, 60, 62, 64, 62, 60, 57];
const evs = riff.map((m, i) => ({ time: 20 + i * 0.375, bar: Math.floor(i / 4) + 1, idx: i % 4, notes: [{ midi: m, string: 1, fret: m - 45 }] }));
const rx = take((x) => evs.forEach((e, i) => {
  if (i === 7) return;
  const m = i === 4 ? 56 : e.notes[0].midi;
  strumChord(x, [m], e.time - 20 + 0.03 + 0.06, { gain: 0.3, dur: 0.6, seed: i + 1 });
}), 6);
r = analyzeScore(rx, SR, { startTime: 20 - 0.03, latency: 0.06, events: evs });
const st = r.issues.map((i) => `${i.kind}@${i.bar}.${i.idx}${i.heard ? `:${i.heard}` : ''}`);
check('Riff: falscher Ton erkannt', st.includes('note-wrong@2.0:56'), st.join(' '));
check('Riff: fehlende Note erkannt', st.includes('note-missed@2.3'), st.join(' '));
check('Riff: Rest richtig', r.correct >= 10, `correct=${r.correct}/${r.expected}`);

// 13. Abgleich
const clicks = Array.from({ length: 8 }, (_, i) => 5 + 1 + i * 0.75);
const cx = take((x) => clicks.forEach((c, i) => strumChord(x, [45], c - 5 + 0.11 + (i % 2 ? 0.01 : -0.01), { gain: 0.3, dur: 0.5, seed: i })), 9);
const cal = analyzeCalibration(cx, SR, { startTime: 5, clicks });
check('Abgleich ~110 ms', cal.ok && Math.abs(cal.latencyMs - 110) <= 20, JSON.stringify(cal));

console.log(failures ? `${failures} Prüfungen fehlgeschlagen` : 'Analyse: alle Prüfungen bestanden');
process.exitCode = failures ? 1 : 0;
