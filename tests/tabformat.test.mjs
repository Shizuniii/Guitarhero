// node tests/tabformat.test.mjs
import assert from 'node:assert/strict';
import { parseTextTab, findTabBlocks, toAlphaTex, barFill, parseHelperJson, durationTicks, badBars, barList, HELPER_FORMAT } from '../src/lib/tabformat.js';

const riff = `
Riff:
e|-----------------|-----------------|
B|-----------------|-----------------|
G|-----------------|-----------------|
D|-----2---2---2---|-----2-----------|
A|-0-3---3---3---3-|-0-3---5h7-------|
E|-----------------|-----------------|
`;

assert.equal(findTabBlocks(riff).length, 1);
const m = parseTextTab(riff);
assert.equal(m.bars.length, 2);
const notes = m.bars[0].beats.filter((b) => b.notes.length);
assert.equal(notes[0].notes[0].f, 0);
assert.equal(notes[0].notes[0].s, 5);
assert.ok(m.bars.every((b) => barFill(b, [4, 4]).ok), 'Takte müssen voll sein');
const h = m.bars[1].beats.flatMap((b) => b.notes).find((n) => n.f === 5);
assert.ok(h.fx?.h, 'Hammer-on erkannt');

const chords = `
e|--0--3--|
B|--1--0--|
G|--0--0--|
D|--2--0--|
A|--3--2--|
E|-----3--|
`;
const c = parseTextTab(chords);
assert.equal(c.bars[0].beats.filter((b) => b.notes.length)[0].notes.length, 5);
assert.equal(c.bars[0].beats.filter((b) => b.notes.length)[1].notes.length, 6);

const two = `
e|--10--12--|
B|----------|
G|----------|
D|----------|
A|----------|
E|----------|
`;
const t = parseTextTab(two);
assert.deepEqual(t.bars[0].beats.flatMap((b) => b.notes).map((n) => n.f), [10, 12]);

const noPipes = `
e-------------------------
B-------------------------
G-------------------------
D-------------------------
A--0--2--3--5--7--8--10--12
E-------------------------
`;
assert.ok(parseTextTab(noPipes)?.bars.length >= 1);

assert.equal(parseTextTab('Das ist nur Text\nohne Tabs'), null);

const tex = toAlphaTex(m, { title: 'Test "A"' });
assert.ok(tex.includes('\\title "Test \\"A\\""'));
assert.ok(tex.includes('.\n'));

const helper = parseHelperJson(JSON.stringify({ title: 'X', tempo: 100, ts: [4, 4], bars: [{ beats: [{ d: 4, notes: [{ s: 1, f: 3 }] }, { d: 99, notes: [{ s: 9, f: 3 }] }] }] }));
assert.equal(helper.model.bars[0].beats[1].d, 8);
assert.equal(helper.model.bars[0].beats[1].notes.length, 0);
assert.equal(parseHelperJson('kein json'), null);
// Triolen
assert.equal(durationTicks({ d: 4, t: 3 }), 640);
assert.equal(durationTicks({ d: 8, dot: true, t: 3 }), 480);
assert.equal(durationTicks({ d: 16, t: 6 }), 160);
assert.equal(durationTicks({ d: 4, t: 4 }), 960, 'unbekannte N-tole zählt normal');
const tri = { beats: [{ d: 4, notes: [] }, { d: 4, notes: [] }, { d: 4, t: 3, notes: [{ s: 1, f: 10 }] }, { d: 4, t: 3, notes: [{ s: 1, f: 7 }] }, { d: 4, t: 3, notes: [{ s: 1, f: 5 }] }] };
assert.ok(barFill(tri, [4, 4]).ok, 'Takt mit Viertel-Triole ist voll');
const triTex = toAlphaTex({ tempo: 90, ts: [4, 4], bars: [tri, { beats: [{ d: 8, dot: true, t: 3, notes: [] }, { d: 2, notes: [] }] }] });
assert.ok(triTex.includes('(10.1).4{tu 3}'), triTex);
assert.ok(triTex.includes('r.8{d tu 3}'), triTex);
const hj = parseHelperJson(JSON.stringify({ bars: [{ beats: [{ d: 4, t: 3, notes: [] }, { d: 4, t: 4, notes: [] }, { d: 4, t: 'x', notes: [] }] }] }));
assert.deepEqual(hj.model.bars[0].beats.map((b) => b.t), [3, undefined, undefined]);
// Zu lange Takte und Formatversion
const overfull = { ts: [4, 4], bars: [tri, { beats: [{ d: 4, notes: [] }, { d: 4, notes: [] }, { d: 4, notes: [] }, { d: 4, notes: [] }, { d: 4, notes: [] }] }, { beats: [{ d: 2, notes: [] }] }] };
assert.deepEqual(badBars(overfull).map((b) => b.bar), [2, 3]);
assert.equal(barList(badBars(overfull)), 'Takte 2 und 3');
assert.equal(barList([{ bar: 4 }]), 'Takt 4');
assert.deepEqual(parseHelperJson(JSON.stringify({ format: HELPER_FORMAT + 1, bars: [{ beats: [{ d: 4, notes: [] }] }] })), { tooNew: true });
assert.ok(parseHelperJson(JSON.stringify({ format: HELPER_FORMAT, bars: [{ beats: [{ d: 4, notes: [] }] }] })).model);
console.log('tabformat: alle Prüfungen bestanden');
