// Macht aus den Auswertungsdaten verständliche Sätze. Jede Ursache passt zum konkreten Fehler.
import { noteLabel } from './pitch.js';
import { settings } from './state.js';

const NAMES = {
  intl: ['tiefe E-Saite', 'A-Saite', 'D-Saite', 'G-Saite', 'B-Saite', 'hohe e-Saite'],
  de: ['tiefe E-Saite', 'A-Saite', 'D-Saite', 'G-Saite', 'H-Saite', 'hohe e-Saite'],
};
const style = () => settings.get().noteNames;
const sName = (i) => NAMES[style() === 'de' ? 'de' : 'intl'][i] || `Saite ${i + 1}`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const note = (m) => noteLabel(m, style());
const frets = (n) => (Math.abs(n) === 1 ? 'einen Bund' : `${Math.abs(n)} Bünde`);
const of = (i, total) => (total ? `bei ${i.count} von ${total} Anschlägen` : '');

function firstPlayed(model) {
  if (!model?.notes?.length) return null;
  return Math.min(...model.notes.map((n) => n.string));
}

export function chordIssue(i, total, models = {}) {
  const chord = i.chord ? `Bei ${i.chord}: ` : '';
  const model = models[i.chord] || models._;
  switch (i.kind) {
    case 'missing':
      return {
        title: `${chord}${cap(sName(i.string))} klingt nicht mit`,
        causes: i.fret > 0
          ? [`Der Finger im ${i.fret}. Bund drückt nicht fest genug`, 'Ein Nachbarfinger berührt die Saite', 'Die Saite wurde beim Anschlag nicht getroffen']
          : ['Ein Finger berührt die leere Saite', 'Die Saite wurde beim Anschlag nicht getroffen'],
        count: of(i, total),
      };
    case 'open':
      return { title: `${chord}${cap(sName(i.string))} klingt leer statt im ${i.fret}. Bund`, causes: ['Der Finger liegt nicht auf der Saite oder drückt nicht'], count: of(i, total) };
    case 'fret':
      return {
        title: `${chord}${cap(sName(i.string))} klingt ${frets(i.delta)} zu ${i.delta > 0 ? 'hoch' : 'tief'}`,
        causes: [`Der Finger sitzt im ${i.fret + i.delta}. statt im ${i.fret}. Bund`],
        count: of(i, total),
      };
    case 'muted-rings': {
      const first = firstPlayed(model);
      return {
        title: `${chord}${cap(sName(i.string))} klingt mit, gehört aber nicht dazu`,
        causes: [first !== null ? `Beim Anschlag mitgenommen. Schlage ${i.chord ? `bei ${i.chord} ` : ''}erst ab der ${sName(first)} an` : 'Beim Anschlag mitgenommen'],
        count: of(i, total),
      };
    }
    case 'extra':
      return { title: `${chord}Ein fremder Ton klingt mit (${note(i.midi)})`, causes: ['Ein Finger greift eine Saite im falschen Bund'], count: of(i, total) };
    case 'buzz':
      return { title: `${chord}Es schnarrt`, causes: ['Ein Finger sitzt zu weit vom Bundstäbchen entfernt', 'Ein Finger drückt nicht fest genug'], count: of(i, total) };
    case 'detuned':
      return { title: `${cap(sName(i.string))} ist um etwa ${Math.abs(i.cents)} Cent zu ${i.cents < 0 ? 'tief' : 'hoch'} gestimmt`, causes: ['Mit dem Stimmgerät nachstimmen'], count: '' };
    case 'pressure':
      return { title: `${cap(sName(i.string))} klingt im ${i.fret}. Bund ${i.cents} Cent zu hoch`, causes: ['Der Finger drückt zu fest oder schiebt die Saite zur Seite'], count: '' };
    default:
      return { title: i.kind, causes: [], count: '' };
  }
}

export function strumIssue(i) {
  switch (i.kind) {
    case 'miss': return { title: `Auf „${i.slot}“ fehlte der Anschlag`, causes: [], count: `in ${i.count} von ${i.of} Takten` };
    case 'extra-hit': return { title: `Auf „${i.slot}“ kam ein Anschlag, obwohl dort leer ist`, causes: [], count: `in ${i.count} von ${i.of} Takten` };
    case 'early': return { title: `Im Schnitt ${i.ms} ms zu früh`, causes: [], count: '' };
    case 'late': return { title: `Im Schnitt ${i.ms} ms zu spät`, causes: [], count: '' };
    case 'rushing': return { title: 'Du wirst im Lauf schneller', causes: [`In der zweiten Hälfte kommen die Anschläge im Schnitt ${i.ms} ms früher als am Anfang`], count: '' };
    case 'dragging': return { title: 'Du wirst im Lauf langsamer', causes: [`In der zweiten Hälfte kommen die Anschläge im Schnitt ${i.ms} ms später als am Anfang`], count: '' };
    case 'unsteady': return { title: `Deine Anschläge schwanken um etwa ${i.ms} ms`, causes: [], count: '' };
    default: return { title: i.kind, causes: [], count: '' };
  }
}

function expectedText(notes) {
  return notes.map((n) => `${note(n.midi)} (${sName(n.string)}, Bund ${n.fret})`).join(' + ');
}

export function scoreIssue(i) {
  const where = `Takt ${i.bar}, Note ${i.idx + 1}`;
  if (i.kind === 'note-missed') return { title: `${where}: nicht gehört`, causes: [`Erwartet: ${expectedText(i.notes)}`], count: '' };
  if (i.kind === 'note-wrong') {
    const target = i.notes[0];
    const d = i.heard - target.midi;
    const detail = Math.abs(d) <= 2 ? `${frets(d)} zu ${d > 0 ? 'hoch' : 'tief'}` : 'falscher Ton oder falsche Saite';
    return { title: `${where}: ${note(i.heard)} statt ${note(target.midi)}`, causes: [`${cap(detail)}. Erwartet: ${expectedText(i.notes)}`], count: '' };
  }
  return { title: `${where}: ${Math.abs(i.offMs)} ms zu ${i.offMs < 0 ? 'früh' : 'spät'}`, causes: ['Gemessen an deinem eigenen Durchschnitt'], count: '' };
}

export function summary(a) {
  if (!a) return '';
  if (a.empty) {
    if (a.reason === 'silent') return 'Nichts gehört. Prüfe unter Einstellungen, ob das Fifine-Mikrofon gewählt ist.';
    return 'Keine Anschläge erkannt.';
  }
  if (a.kind === 'chord') return `${a.clean} von ${a.total} Anschlägen klangen sauber.`;
  if (a.kind === 'change') return `${a.count} Wechsel gezählt. ${a.clean} von ${a.total} Anschlägen klangen sauber.`;
  if (a.kind === 'strum') return `${a.inTime} von ${a.expected} Anschlägen im Takt (bis ${a.tolMs} ms Abweichung).${a.calibrated ? '' : ' Ob du insgesamt zu früh oder zu spät bist, zeigt die App erst nach dem Timing-Abgleich in den Einstellungen.'}`;
  if (a.kind === 'score') return `${a.correct} von ${a.expected} Tönen richtig, ${a.inTime} davon im Takt.`;
  return '';
}

export function issueText(a, i, models) {
  if (a.kind === 'strum') return strumIssue(i);
  if (a.kind === 'score') return scoreIssue(i);
  return chordIssue(i, a.total, models);
}
