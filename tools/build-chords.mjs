// Erzeugt data/chords.json aus @tombatossals/chords-db (MIT).
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2];
const g = JSON.parse(readFileSync(src, 'utf8'));
const out = { keys: g.keys, suffixes: g.suffixes, chords: {} };
for (const key of Object.keys(g.chords)) {
  for (const entry of g.chords[key]) {
    const k = `${entry.key}|${entry.suffix}`;
    out.chords[k] = entry.positions.map((p) => ({
      f: p.frets, g: p.fingers, b: p.baseFret, r: p.barres || [],
    }));
  }
}
writeFileSync(new URL('../data/chords.json', import.meta.url), JSON.stringify(out));
console.log(Object.keys(out.chords).length, 'Akkorde');
