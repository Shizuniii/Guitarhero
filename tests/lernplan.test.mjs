// Lernplan-Logik ohne Browser: node tests/lernplan.test.mjs
import {
  bestPerMinute, buildSession, collectExercises, coverage, currentModule, estimateSeconds, exerciseList, exerciseStates, firstOpenModule,
  LP_DEFAULT, moduleState, nextLesson, unitIndex,
} from '../src/lib/lernplan.js';
import { moduleByN, MODULES } from '../src/lib/lernplan-data.js';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`);
  if (!cond) failed += 1;
};

// Ein Übungsplan wie ein typischer aus Modul 5: sieben Akkorde, alle 21 Wechsel, drei Strums, vier Riffs
const CHORDS = ['D', 'Dm', 'A', 'Am', 'E', 'Em', 'C'];
const chord = (name) => ({ name, voicing: 0 });
const steps = [{ id: 'fs', type: 'timer', config: { seconds: 120, label: 'Finger Stretch' } }];
for (const c of CHORDS) steps.push({ id: `c-${c}`, type: 'chord', config: { seconds: 60, chord: chord(c) } });
for (let i = 0; i < CHORDS.length; i++) {
  for (let j = i + 1; j < CHORDS.length; j++) {
    steps.push({ id: `w-${i}-${j}`, type: 'change', config: { seconds: (i + j) % 3 ? 60 : 55, a: chord(CHORDS[i]), b: chord(CHORDS[j]) } });
  }
}
const patterns = [
  { id: 'p1', name: 'D DUD D' }, { id: 'p2', name: 'D DUDUD' }, { id: 'p3', name: 'The Old Faithful' }, { id: 'p4', name: 'Pop mit Dämpfer' },
];
for (const p of patterns.slice(0, 3)) steps.push({ id: `s-${p.id}`, type: 'strum', config: { seconds: 60, patternId: p.id, bpm: 80 } });
const scores = [
  { id: 'r1', title: 'Peter Gunn Theme', kind: 'riff' }, { id: 'r2', title: 'Seven Nation Army', kind: 'riff' },
  { id: 'r3', title: 'Sunshine of Your Love', kind: 'riff' }, { id: 'r4', title: 'Come As You Are', kind: 'riff' },
];
for (const s of scores) steps.push({ id: `r-${s.id}`, type: 'riff', config: { scoreId: s.id } });
steps.push({ id: 'met', type: 'metronome', config: { bpm: 60, label: 'Langsam' } });
const plans = [{ id: 'mein', name: 'Übungsplan', steps }];

const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
deepFreeze(plans);

const lp = (patch = {}) => ({ ...LP_DEFAULT, ...patch, lessons: { ...LP_DEFAULT.lessons, ...(patch.lessons || {}) }, ex: { ...(patch.ex || {}) } });
const rec = (a, b, count, seconds = 60, at = 1000) => ({ id: `${a}|${b}|${seconds}`, a, b, seconds, best: count, history: [{ at, count, seconds }] });
const base = { lp: lp(), plans, patterns, scores, records: [] };
const withSongs = { ...base, lp: lp({ songList: ['Eleanor Rigby', 'Get Lucky'] }) };
const minutes = (s) => estimateSeconds(s.steps) / 60;

// 1. Übungen aus dem Plan
const ex = collectExercises(plans);
ok('Übungen gelesen', ex.chords.length === 7 && ex.pairs.length === 21 && ex.strums.length === 3 && ex.riffs.length === 4 && ex.stretch?.seconds === 120);
ok('Unbekannte Schritte bleiben sichtbar', ex.other.length === 1 && ex.other[0].step.type === 'metronome');

// 2. Modul 5, normale Einheit
const m5 = currentModule(base);
ok('Start in Modul 5', m5.n === 5);
const s0 = buildSession(withSongs, { n: 0 });
ok('Einheit passt in 20 Minuten', minutes(s0) > 18 && minutes(s0) <= 20.5, `(${minutes(s0).toFixed(1)} Min.)`);
ok('Finger Stretch zuerst', s0.steps[0].id === 'lp-stretch' && s0.steps[0].config.seconds === 120);
ok('Chord Perfect auf C', s0.steps.some((s) => s.id === 'lp-pc-C'));
const changes = s0.steps.filter((s) => s.type === 'change');
ok('Sechs Wechsel, zwei davon mit C', changes.length === 6 && changes.filter((s) => [s.config.a.name, s.config.b.name].includes('C')).length === 2);
ok('Wechsel behalten die Dauer aus deinem Plan', changes.every((c) => {
  const orig = steps.find((s) => s.type === 'change' && [s.config.a.name, s.config.b.name].sort().join() === [c.config.a.name, c.config.b.name].sort().join());
  return orig && orig.config.seconds === c.config.seconds;
}));
ok('Zwei Strums, ein Riff, Song-Arbeit', s0.steps.filter((s) => s.type === 'strum').length === 2 && s0.steps.filter((s) => s.type === 'riff').length === 1 && s0.steps.some((s) => s.id === 'lp-song' && s.config.seconds === 300));
ok('Song-Arbeit nennt deinen Song, reihum', s0.steps.find((s) => s.id === 'lp-song').config.label === 'Song: Eleanor Rigby' && buildSession(withSongs, { n: 1 }).steps.find((s) => s.id === 'lp-song').config.label === 'Song: Get Lucky');

// Ohne Song: die 5 Minuten gehen an 4 weitere Wechsel
const noSong = buildSession(base, { n: 0 });
ok('Ohne Song keine Song-Arbeit', !noSong.steps.some((s) => s.id === 'lp-song'));
ok('Ohne Song 4 Wechsel mehr', noSong.steps.filter((s) => s.type === 'change').length === 10);
ok('Ohne Song trotzdem um 20 Minuten', minutes(noSong) > 18 && minutes(noSong) <= 20.5, `(${minutes(noSong).toFixed(1)} Min.)`);
ok('Jede Einheit hat eindeutige Schritte', new Set(s0.steps.map((s) => s.id)).size === s0.steps.length);
ok('Jeder Schritt sagt, woher er kommt', s0.items.every((i) => i.src && i.why));

// 3. Kurz und Lektionstag
const kurz = buildSession(base, { n: 0, mode: 'kurz' });
ok('Kurz-Einheit um 5 Minuten', minutes(kurz) >= 4.5 && minutes(kurz) <= 6, `(${minutes(kurz).toFixed(1)} Min.)`);
const lek = buildSession(base, { n: 0, mode: 'lektion' });
const lessonStep = lek.steps.find((s) => s.id.startsWith('lp-lesson-'));
ok('Lektionstag zeigt die nächste Lektion', lessonStep?.id === 'lp-lesson-b1-502' && lessonStep.config.link.endsWith('guitar-strumming-tips-b1-502'));
ok('Lektionstag bleibt bei 20 Minuten', minutes(lek) <= 20.1 && lek.steps.length >= 2, `(${minutes(lek).toFixed(1)} Min.)`);

// 4. Verteilung über 21 Einheiten
const cov = coverage(withSongs, { count: 21, module: m5 });
const by = (g) => cov.rows.filter((r) => r.group === g);
ok('Keine deiner Übungen fällt heraus', cov.rows.every((r) => r.times > 0), cov.rows.filter((r) => !r.times).map((r) => r.label || r.id).join(','));
const cPairs = by('Wechsel').filter((r) => r.label.includes('C'));
const pool = by('Wechsel').filter((r) => !r.label.includes('C'));
ok('Wechsel mit C gleich oft', new Set(cPairs.map((r) => r.times)).size === 1, cPairs.map((r) => r.times).join(','));
ok('Andere Wechsel fast gleich oft', Math.max(...pool.map((r) => r.times)) - Math.min(...pool.map((r) => r.times)) <= 1);
ok('C jeden Tag, Finger Stretch jeden Tag', by('Akkorde').find((r) => r.label === 'C').times === 21 && by('Aufwärmen')[0].times === 21);
const caya = by('Riffs').find((r) => r.id === 'lp-riff-r4').times;
ok('Come As You Are jede zweite Einheit', caya === 11, `(${caya})`);
ok('Song-Arbeit kommt vom Lernplan', cov.added.some((a) => a.id === 'lp-song' && a.times === 21));
const covNo = coverage(base, { count: 21, module: m5 });
const poolNo = covNo.rows.filter((r) => r.group === 'Wechsel' && !r.label.includes('C'));
ok('Ohne Song: andere Wechsel öfter, weiter gleichmäßig', Math.min(...poolNo.map((r) => r.times)) > Math.max(...pool.map((r) => r.times)) - 1 && Math.max(...poolNo.map((r) => r.times)) - Math.min(...poolNo.map((r) => r.times)) <= 1, poolNo.map((r) => r.times).join(','));

// 5. Einheiten zählen, Tage nicht
ok('Einheit zählt erledigte Tage vor heute', unitIndex({ days: ['2026-11-20', '2026-11-22', '2026-11-23'] }, '2026-11-23') === 2);

// 6. Problem-Akkord jeden Tag
const prob = { ...base, lp: lp({ problemChord: 'Dm' }) };
ok('Problem-Akkord in jeder Einheit', [0, 1, 2, 3, 4].every((n) => buildSession(prob, { n }).steps.some((s) => s.id === 'lp-pc-Dm')));

// 7. Prüfpunkt Wechsel in Modul 5
const withRec = (records) => moduleState(moduleByN(5), { ...base, records }).checks.find((c) => c.id === 'm5-omc');
ok('Wechsel-Prüfpunkt offen ohne Messung', !withRec([]).pass);
ok('Wechsel-Prüfpunkt erfüllt ab 30 pro Minute', withRec([rec('Am', 'C', 31), rec('C', 'Em', 30)]).pass);
ok('Wechsel-Prüfpunkt rechnet auf eine Minute um', !withRec([rec('Am', 'C', 27, 55), rec('C', 'Em', 30)]).pass && withRec([rec('Am', 'C', 28, 55), rec('C', 'Em', 30)]).pass);
ok('Bester Wert pro Minute', Math.round(bestPerMinute([rec('A', 'Am', 20, 55)], 'Am', 'A')) === 22);
ok('Messung von heute zählt nicht für heute', bestPerMinute([rec('A', 'D', 40, 60, 5000)], 'A', 'D', 4000) === null);

// 8. Modul 1 bis 4: deine Übungen gehören zu Justins Modulen und werden mitgeprüft
const exs = exerciseList(base);
const modOf = (id) => exs.find((e) => e.id === id)?.module;
ok('Akkorde den Modulen zugeordnet', modOf('lp-pc-A') === 1 && modOf('lp-pc-D') === 1 && modOf('lp-pc-E') === 2 && modOf('lp-pc-Am') === 3 && modOf('lp-pc-Em') === 3 && modOf('lp-pc-Dm') === 4 && modOf('lp-pc-C') === 5);
ok('Wechsel gehören zum späteren Akkord', modOf('lp-omc-A|D') === 1 && modOf('lp-omc-A|E') === 2 && modOf('lp-omc-Am|E') === 3 && modOf('lp-omc-D|Dm') === 4 && modOf('lp-omc-Am|C') === 5);
ok('Strums, Riffs und Finger Stretch zugeordnet', modOf('lp-strum-p1') === 3 && modOf('lp-strum-p2') === 3 && modOf('lp-strum-p3') === 4
  && modOf('lp-riff-r1') === 2 && modOf('lp-riff-r2') === 3 && modOf('lp-riff-r3') === 4 && modOf('lp-riff-r4') === 5 && modOf('lp-stretch') === 4);
ok('Nichts ohne Modul', exs.every((e) => e.module !== null));
ok('Lektionen von Modul 1 bis 4 gelten als gesehen', [1, 2, 3, 4].every((n) => moduleState(moduleByN(n), base).lessonsDone === moduleByN(n).lessons.length));
ok('Erstes offenes Modul ist 1, die Einheit folgt Modul 5', firstOpenModule(base).n === 1 && currentModule(base).n === 5);
ok('Nächste Lektion ist Guitar Strumming Tips', nextLesson(currentModule(base), base.lp).id === 'b1-502');
ok('Wechsel sitzt ab 30 pro Minute', exerciseStates({ ...base, records: [rec('A', 'D', 30)] }).find((e) => e.id === 'lp-omc-A|D').pass);
ok('Akkord sitzt nach Abhaken', exerciseStates({ ...base, lp: lp({ ex: { 'lp-pc-A': true } }) }).find((e) => e.id === 'lp-pc-A').pass);

// Was sitzt, kommt seltener
const someSit = { ...base, lp: lp({ ex: { 'lp-pc-A': true, 'lp-pc-D': true } }), records: [rec('D', 'E', 31)] };
const covSit = coverage(someSit, { count: 30, module: moduleByN(5) });
const t = (id) => covSit.rows.find((r) => r.id === id).times;
ok('Sitzende Akkorde seltener als offene', t('lp-pc-A') > 0 && t('lp-pc-A') * 2 <= t('lp-pc-Am'), `(A ${t('lp-pc-A')}, Am ${t('lp-pc-Am')})`);
ok('Sitzender Wechsel seltener, bleibt aber dabei', t('lp-omc-D|E') > 0 && t('lp-omc-D|E') * 2 <= t('lp-omc-A|E'), `(D–E ${t('lp-omc-D|E')}, A–E ${t('lp-omc-A|E')})`);
ok('Einheit nennt den Stand', buildSession(someSit, { n: 0 }).items.some((i) => /sitzt, zur Wiederholung|noch offen/.test(i.why)));

// 9. Weiter zu Modul 6 erst, wenn Modul 1 bis 5 erfüllt sind
const CH7 = ['A', 'D', 'E', 'Am', 'Dm', 'Em', 'C', 'G'];
const allRecs = [];
for (let i = 0; i < CH7.length; i++) for (let j = i + 1; j < CH7.length; j++) allRecs.push(rec(CH7[i], CH7[j], 35));
const lessonsUpTo = (n) => Object.fromEntries(MODULES.filter((m) => m.n <= n).flatMap((m) => m.lessons.map((l) => [l.id, true])));
const checksUpTo = (n) => Object.fromEntries(MODULES.filter((m) => m.n <= n).flatMap((m) => m.checks.map((c) => [c.id, true])));
const exAll = Object.fromEntries(exs.map((e) => [e.id, true]));
const done5 = { ...base, records: allRecs, lp: lp({ lessons: lessonsUpTo(5), checks: checksUpTo(5), ex: exAll, songList: ['Eleanor Rigby'] }) };
ok('Modul 6, wenn Modul 1 bis 5 erfüllt sind', currentModule(done5).n === 6 && firstOpenModule(done5).n === 6);
const missing = { ...done5, lp: { ...done5.lp, ex: { ...exAll, 'lp-riff-r2': false } } };
ok('Eine offene Übung aus Modul 3 hält Modul 6 zurück', currentModule(missing).n === 5 && firstOpenModule(missing).n === 3);
const missingGoal = { ...done5, lp: { ...done5.lp, checks: { ...checksUpTo(5), 'm2-anchor': false } } };
ok('Ein offenes Ziel aus Modul 2 hält Modul 6 zurück', currentModule(missingGoal).n === 5 && firstOpenModule(missingGoal).n === 2);
const noRec = { ...done5, records: [], lp: { ...done5.lp, ex: Object.fromEntries(exs.filter((e) => e.kind !== 'pair').map((e) => [e.id, true])) } };
ok('Ohne gemessene Wechsel bleibt Modul 1 offen', firstOpenModule(noRec).n === 1);

const ctx6 = { ...done5, records: allRecs.filter((r) => r.a !== 'G' && r.b !== 'G') };
const s6 = buildSession(ctx6, { n: 0 });
ok('Vor der G-Lektion bleibt C der neueste Akkord', s6.module.n === 6 && s6.newest === 'C' && !s6.steps.some((s) => s.id === 'lp-pc-G'));
ok('Ohne Wechselschlag-Lektion ein Wechsel mehr', s6.steps.filter((s) => s.type === 'change').length === 5 && !s6.steps.some((s) => s.id === 'lp-pick'));
ok('Ohne 6/8-Lektion zwei Strums', s6.steps.filter((s) => s.type === 'strum').length === 2 && !s6.steps.some((s) => s.id === 'lp-68'));
const ctx6g = { ...ctx6, lp: { ...ctx6.lp, lessons: { ...lessonsUpTo(5), 'b1-601': true, 'b1-602': true, 'b1-604': true } } };
const s6g = buildSession(ctx6g, { n: 1 });
ok('Nach der G-Lektion: G und Wechsel mit G', s6g.newest === 'G' && s6g.steps.some((s) => s.id === 'lp-pc-G') && s6g.steps.filter((s) => s.type === 'change' && [s.config.a.name, s.config.b.name].includes('G')).length === 2);
ok('Wechselschlag und 6/8 nach ihren Lektionen', s6g.steps.some((s) => s.id === 'lp-pick' && s.config.seconds === 60) && s6g.steps.some((s) => s.id === 'lp-68') && s6g.steps.filter((s) => s.type === 'strum').length === 1);
const g6 = (recs) => moduleState(moduleByN(6), { ...ctx6g, records: recs }).checks.find((c) => c.id === 'm6-omc');
ok('Modul-6-Prüfpunkt misst G–C und G–D', !g6([]).pass && g6([rec('G', 'C', 30), rec('D', 'G', 31)]).pass, `(${g6([]).auto.evidence})`);
ok('Modul 6 passt in 20 Minuten', minutes(s6g) <= 20.5 && minutes(buildSession(ctx6g, { n: 0 })) <= 20.5, `(${minutes(s6g).toFixed(1)} Min.)`);
ok('Alte Übungen bleiben in Modul 6 dabei', coverage(ctx6g, { count: 21 }).rows.every((r) => r.times > 0));

// 10. Modul 7: die zwei schwächsten Wechsel
const weakRecs = allRecs.map((r) => (r.id === 'D|E|60' ? rec('D', 'E', 18) : r.id === 'A|Dm|60' ? rec('A', 'Dm', 25) : r.id === 'E|Em|60' ? rec('E', 'Em', 29) : r));
const ctx7 = { ...done5, records: weakRecs, lp: { ...done5.lp, lessons: lessonsUpTo(6), checks: checksUpTo(6), ex: { ...exAll, 'lp-omc-D|E': true, 'lp-omc-A|Dm': true, 'lp-omc-E|Em': true } } };
ok('Modul 7 nach Modul 6', currentModule(ctx7).n === 7);
const s7 = buildSession(ctx7, { n: 0 });
const weak = s7.items.filter((i) => i.why.startsWith('Schwach')).map((i) => i.step.id);
ok('Die zwei schwächsten unter 30', weak.length === 2 && weak.includes('lp-omc-D|E') && weak.includes('lp-omc-A|Dm'), weak.join(','));
ok('Old Faithful immer dabei', [0, 1, 2].every((n) => buildSession(ctx7, { n }).steps.some((s) => s.id === 'lp-strum-p3' && s.config.bpm >= 80)));
const g1 = moduleState(moduleByN(7), ctx7).checks.find((c) => c.id === 'g1-omc');
ok('Grade-1-Prüfpunkt zählt alle 28 Paare', !g1.pass && g1.auto.evidence.startsWith('25 von 28'), `(${g1.auto.evidence})`);
const songs = moduleState(moduleByN(7), { ...ctx7, lp: { ...ctx7.lp, songs: 5 } }).checks.find((c) => c.id === 'g1-songs');
ok('Fünf Songs zählen', songs.pass);

// 11. Einstellungen im Lauf bleiben erhalten
const over = buildSession({ ...base, lp: lp({ overrides: { 'lp-strum-p1': { bpm: 90 } } }) }, { n: 0 });
ok('Geändertes Tempo bleibt', over.steps.find((s) => s.id === 'lp-strum-p1')?.config.bpm === 90);

if (failed) {
  console.log(`${failed} Prüfungen fehlgeschlagen`);
  process.exit(1);
}
console.log('Lernplan: alle Prüfungen bestanden');
