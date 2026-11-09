// Startinhalte beim allerersten Öffnen. Alles lässt sich löschen oder ändern.
import { uid } from './core.js';

const beat = (d, ...notes) => ({ d, notes: notes.map(([f, s]) => ({ f, s })) });
const q = (f, s) => beat(4, [f, s]);
const e = (f, s) => beat(8, [f, s]);
const h = (f, s) => beat(2, [f, s]);
const w = (f, s) => beat(1, [f, s]);

const NOTE = { c: [1, 2], d: [3, 2], e: [0, 1], f: [1, 1], g: [3, 1], a: [5, 1] };

function melody(text) {
  // "c4 d4 | g2" wird zu Takten: Buchstabe = Ton, Zahl = Notenwert, Punkt = punktiert
  return text.split('|').map((bar) => ({
    beats: bar.trim().split(/\s+/).map((tok) => {
      const n = NOTE[tok[0]];
      return { d: Number(tok.slice(1).replace('.', '')), dot: tok.endsWith('.'), notes: [{ f: n[0], s: n[1] }] };
    }),
  }));
}

function model(bars, tempo) {
  return { tempo, ts: [4, 4], capo: 0, tuningId: 'standard', bars };
}

export function seedData() {
  const pats = [
    { id: uid(), name: 'Alle Abschläge', beats: 4, perBeat: 2, slots: ['D', '-', 'D', '-', 'D', '-', 'D', '-'] },
    { id: uid(), name: 'Ab und auf', beats: 4, perBeat: 2, slots: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'] },
    { id: uid(), name: 'Folk-Standard', beats: 4, perBeat: 2, slots: ['D', '-', 'D', 'U', '-', 'U', 'D', 'U'] },
    { id: uid(), name: 'Pop mit Dämpfer', beats: 4, perBeat: 2, slots: ['D', '-', 'X', 'U', '-', 'U', 'X', 'U'] },
  ];

  const spider = model([
    { beats: [e(1, 6), e(2, 6), e(3, 6), e(4, 6), e(1, 5), e(2, 5), e(3, 5), e(4, 5)] },
    { beats: [e(1, 4), e(2, 4), e(3, 4), e(4, 4), e(1, 3), e(2, 3), e(3, 3), e(4, 3)] },
    { beats: [e(1, 2), e(2, 2), e(3, 2), e(4, 2), e(1, 1), e(2, 1), e(3, 1), e(4, 1)] },
  ], 70);

  const pentatonic = model([
    { beats: [e(5, 6), e(8, 6), e(5, 5), e(7, 5), e(5, 4), e(7, 4), e(5, 3), e(7, 3)] },
    { beats: [e(5, 2), e(8, 2), e(5, 1), e(8, 1), e(5, 1), e(8, 2), e(5, 2), e(7, 3)] },
    { beats: [e(5, 3), e(7, 4), e(5, 4), e(7, 5), e(5, 5), e(8, 6), q(5, 6)] },
  ], 80);

  const ode = model(melody(
    'e4 e4 f4 g4 | g4 f4 e4 d4 | c4 c4 d4 e4 | e4. d8 d2 | e4 e4 f4 g4 | g4 f4 e4 d4 | c4 c4 d4 e4 | d4. c8 c2',
  ), 92);

  const entchen = model(melody(
    'c4 d4 e4 f4 | g2 g2 | a4 a4 a4 a4 | g1 | a4 a4 a4 a4 | g1 | f4 f4 f4 f4 | e2 e2 | d4 d4 d4 d4 | c1',
  ), 100);

  const scoreItems = [
    { id: uid(), kind: 'riff', title: 'Chromatik-Spinne', artist: 'Fingerübung', score: { format: 'model', data: spider }, attachments: [], notes: 'Pro Bund ein Finger. Langsam anfangen und jeden Ton sauber klingen lassen.' },
    { id: uid(), kind: 'riff', title: 'Am-Pentatonik', artist: 'Tonleiter', score: { format: 'model', data: pentatonic }, attachments: [], notes: '' },
    { id: uid(), kind: 'song', title: 'Ode an die Freude', artist: 'Ludwig van Beethoven', score: { format: 'model', data: ode }, attachments: [], notes: '' },
    { id: uid(), kind: 'song', title: 'Alle meine Entchen', artist: 'Volkslied', score: { format: 'model', data: entchen }, attachments: [], notes: '' },
  ];

  const plan = {
    id: uid(),
    name: 'Grundlagen',
    steps: [
      { id: uid(), type: 'chord', config: { chord: { name: 'Am', voicing: 0 }, seconds: 60 } },
      { id: uid(), type: 'change', config: { a: { name: 'Am', voicing: 0 }, b: { name: 'C', voicing: 0 }, seconds: 60 } },
      { id: uid(), type: 'strum', config: { patternId: pats[2].id, bpm: 70, chord: { name: 'Am', voicing: 0 }, seconds: 60 } },
      { id: uid(), type: 'riff', config: { scoreId: scoreItems[0].id } },
      { id: uid(), type: 'song', config: { scoreId: scoreItems[3].id } },
    ],
  };

  return { patterns: pats, scores: scoreItems, plans: [plan] };
}

// Geführte Aufnahmen mit absichtlichen Fehlern. Damit lässt sich die Bewertung an deiner Gitarre einstellen.
export function testPlan(patternList, scoreList) {
  const folk = patternList.find((p) => p.name === 'Folk-Standard') || patternList[0];
  const spider = scoreList.find((x) => x.title === 'Chromatik-Spinne');
  const C = { name: 'C', voicing: 0 };
  const rec = (label, hint, chord) => ({ id: uid(), type: 'record', config: { label, hint, ...(chord ? { chord } : {}) } });
  const steps = [
    rec('Leere Saiten', 'Mach vorher unter Einstellungen den Timing-Abgleich und wähle einen Aufnahme-Ordner. Stimme dann mit dem Stimmgerät. Zupfe jede leere Saite einzeln, von der tiefen E- bis zur hohen e-Saite, und lass jede etwa 2 Sekunden klingen.'),
    rec('C sauber', 'Greife C-Dur so sauber du kannst und schlage 8 Mal langsam an. Die tiefe E-Saite schlägst du nicht an.', C),
    rec('C mit gedämpfter A-Saite', 'Wie eben, aber lege den Ringfinger auf der A-Saite nur auf, ohne zu drücken. 8 Anschläge.', C),
    rec('C mit tiefer E-Saite', 'C-Dur normal greifen, aber bei jedem Anschlag die tiefe E-Saite mit anschlagen. 8 Anschläge.', C),
    rec('C mit falschem Bund', 'Setze den Mittelfinger auf der D-Saite in den 3. statt in den 2. Bund. 8 Anschläge.', C),
    rec('C mit Schnarren', 'Drücke den Zeigefinger auf der B-Saite nur so leicht, dass es schnarrt. 8 Anschläge.', C),
    rec('Am und C, 10 Wechsel', 'Spiele Am und C im Wechsel, jeden Akkord 2 Mal anschlagen, genau 10 Wechsel. Zähle leise mit.'),
    { id: uid(), type: 'strum', config: { patternId: folk?.id, bpm: 70, chord: { name: 'Am', voicing: 0 }, seconds: 30, hint: 'Spiele das Muster mit Am, so gut es geht. Drücke danach bei der Aufnahme auf Behalten.' } },
    { id: uid(), type: 'strum', config: { patternId: folk?.id, bpm: 70, chord: { name: 'Am', voicing: 0 }, seconds: 30, hint: 'Lass diesmal absichtlich jeden Anschlag auf 4 weg. Drücke danach auf Behalten.' } },
  ];
  if (spider) steps.push({ id: uid(), type: 'riff', config: { scoreId: spider.id, hint: 'Stelle 70 % ein, schalte Mitschneiden ein und spiele einmal mit. Drücke danach auf Behalten.' } });
  return [{ id: uid(), name: 'Testaufnahmen', steps }];
}
