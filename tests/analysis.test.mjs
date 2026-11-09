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
