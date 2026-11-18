// Erzeugt Test-Audio für das künstliche Mikrofon im Browser.
import { writeFileSync } from 'node:fs';
import { noise, SR, strumChord, toWav } from './synth/guitar.mjs';
const out = process.argv[2];
const C = [48, 52, 55, 60, 64];
const Am = [45, 52, 57, 60, 64];
// C-Dur ohne A-Saite, alle 0,8 Sekunden
let x = new Float32Array(40 * SR);
for (let t = 0.3; t < 39; t += 0.8) strumChord(x, C.filter((m) => m !== 48), t, { seed: Math.round(t * 10) });
noise(x); writeFileSync(`${out}/c-no-a.wav`, toWav(x));
// Am und C im Wechsel, je zwei Anschläge
x = new Float32Array(40 * SR);
for (let k = 0; k < 28; k++) { const ch = k % 2 ? C : Am; strumChord(x, ch, 0.3 + k * 1.4, { seed: k * 2 + 1 }); strumChord(x, ch, 0.9 + k * 1.4, { seed: k * 2 + 2 }); }
noise(x); writeFileSync(`${out}/am-c.wav`, toWav(x));
// Saiten einzeln: C-Dur, D-Saite einen Bund zu hoch (F3 statt E3)
x = new Float32Array(20 * SR);
[48, 53, 55, 60, 64].forEach((m, i) => strumChord(x, [m], 1.5 + i * 1.1, { gain: 0.35, dur: 1.0, seed: i + 1 }));
noise(x); writeFileSync(`${out}/c-strings.wav`, toWav(x));
// Saiten nacheinander mit Wiederholung: A sauber, D zu hoch, G-Ton während D dran ist, D sauber, dann G, B, e
x = new Float32Array(20 * SR);
[48, 53, 55, 52, 55, 60, 64].forEach((m, i) => strumChord(x, [m], 1.5 + i * 1.1, { gain: 0.35, dur: 1.0, seed: i + 11 }));
noise(x); writeFileSync(`${out}/c-strings-retry.wav`, toWav(x));
// E und A im Wechsel: Die leere tiefe E-Saite klingt beim A nach
x = new Float32Array(40 * SR);
for (let k = 0; k < 28; k++) {
  const t = 0.3 + k * 1.3;
  if (k % 2 === 0) { strumChord(x, [40], t, { seed: 7, dur: 2.4 }); strumChord(x, [47, 52, 56, 59, 64], t + 0.004, { seed: k * 3 + 2, dur: 0.75 }); }
  else strumChord(x, [45, 52, 57, 61, 64], t, { seed: k * 3 + 3, dur: 0.75 });
}
noise(x); writeFileSync(`${out}/e-a-carry.wav`, toWav(x));
console.log('WAVs geschrieben');
