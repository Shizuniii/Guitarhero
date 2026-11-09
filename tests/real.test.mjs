// node tests/real.test.mjs <ordner-mit-testaufnahmen>
// Prüft die Erkennung an echten Aufnahmen aus dem Plan „Testaufnahmen“. Braucht ffmpeg.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeChange, analyzeChord, chordModel } from '../src/lib/analysis.js';

const dir = process.argv[2];
if (!dir) { console.log('Ordner mit Testaufnahmen angeben.'); process.exit(0); }
const SR = 48000;
const files = readdirSync(dir);
const load = (part) => {
  const f = files.find((n) => n.includes(part));
  if (!f) return null;
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', join(dir, f), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
};
const C = chordModel('C', [-1, 3, 2, 0, 1, 0]);
const Am = chordModel('Am', [-1, 0, 2, 2, 1, 0]);
const has = (r, kind, string, delta) => r.issues.some((i) => i.kind === kind && i.string === string && (delta === undefined || i.delta === delta));
const cases = [
  ['C mit gedämpfter A-Saite', (r) => has(r, 'missing', 1) && r.issues.length === 1],
  ['C mit tiefer E-Saite', (r) => has(r, 'muted-rings', 0)],
  ['C mit falschem Bund', (r) => has(r, 'fret', 2, 1)],
  ['C sauber', (r) => !has(r, 'muted-rings', 0) && !r.issues.some((i) => i.kind === 'fret')],
];
let failed = 0;
for (const [name, ok] of cases) {
  const x = load(name);
  if (!x) { console.log(`--   ${name}: Datei fehlt`); continue; }
  const r = analyzeChord(x, SR, C);
  const pass = ok(r);
  failed += pass ? 0 : 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${name}: ${r.issues.map((i) => `${i.kind}@${i.string}${i.delta ? `(${i.delta})` : ''}×${i.count}`).join(', ') || 'keine Fehler'}`);
}
const w = load('Am und C');
if (w) {
  const r = analyzeChange(w, SR, Am, C);
  const pass = r.count >= 10;
  failed += pass ? 0 : 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} Am und C: ${r.count} Wechsel gezählt`);
}
assert.equal(failed, 0, `${failed} Fälle falsch`);
