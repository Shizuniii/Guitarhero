// Lernplan: verteilt deine Übungen auf Einheiten von 20 Minuten und folgt dabei Justins Grade-1-Modulen.
// Reine Funktionen ohne Speicherzugriff. Die Seite reicht Pläne, Rekorde, Muster und Songs herein.
//
// Regeln, kurz:
// - Was geübt wird, kommt aus deinen eigenen Plänen (Akkorde, Wechsel, Strums, Riffs, Finger Stretch).
// - Justins Module bestimmen den Schwerpunkt: den neuesten Akkord, neue Übungen, die Prüfpunkte.
// - Alles andere läuft reihum. Gezählt wird in Einheiten: Eine ausgelassene Woche verschiebt nichts.
import { GRADE1_CHORDS, HINTS, MODULES, SONG_NOTES, TEMPLATES } from './lernplan-data.js';

export const LP_DEFAULT = {
  lessons: { 'b1-501': true },
  checks: {},
  songs: 0,
  days: [],
  problemChord: '',
  songList: [],
  mode: null,
  overrides: {},
};

export const OMC_GOAL = 30;
export const DAY_SECONDS = 20 * 60;
const RIFF_SECONDS = 120;

export const pairKey = (a, b) => [a, b].sort().join('|');
const pairLabel = (p) => `${p.a}–${p.b}`;

function uniqBy(list, key) {
  const seen = new Set();
  return list.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Alle Übungen aus deinen Plänen, ohne Doppelte, in der Reihenfolge deiner Pläne
export function collectExercises(planList) {
  const out = { stretch: null, chords: [], pairs: [], strums: [], riffs: [], songs: [], other: [] };
  for (const plan of planList) {
    for (const step of plan.steps || []) {
      const c = step.config || {};
      if (step.type === 'timer' && /finger|stretch|dehn/i.test(c.label || '')) {
        if (!out.stretch) out.stretch = { label: c.label, seconds: c.seconds || 120 };
      } else if (step.type === 'chord' && c.chord?.name) {
        out.chords.push({ name: c.chord.name, voicing: c.chord.voicing || 0, seconds: c.seconds || 60 });
      } else if (step.type === 'change' && c.a?.name && c.b?.name && c.a.name !== c.b.name) {
        out.pairs.push({ a: c.a.name, b: c.b.name, va: c.a.voicing || 0, vb: c.b.voicing || 0, seconds: c.seconds || 60 });
      } else if (step.type === 'strum' && c.patternId) {
        out.strums.push({ patternId: c.patternId, bpm: c.bpm || 80, chord: c.chord, seconds: c.seconds || 60 });
      } else if (step.type === 'riff' && c.scoreId) {
        out.riffs.push({ scoreId: c.scoreId });
      } else if (step.type === 'song' && c.scoreId) {
        out.songs.push({ scoreId: c.scoreId });
      } else {
        out.other.push({ plan: plan.name, step });
      }
    }
  }
  out.chords = uniqBy(out.chords, (c) => c.name);
  out.pairs = uniqBy(out.pairs, (p) => pairKey(p.a, p.b));
  out.strums = uniqBy(out.strums, (s) => s.patternId);
  out.riffs = uniqBy(out.riffs, (r) => r.scoreId);
  out.songs = uniqBy(out.songs, (r) => r.scoreId);
  return out;
}

// Bester Wert pro Minute für ein Paar, nur Messungen vor `before`
export function bestPerMinute(recordList, a, b, before = Infinity) {
  const key = pairKey(a, b);
  let best = null;
  for (const r of recordList) {
    if (pairKey(r.a, r.b) !== key) continue;
    for (const h of r.history || []) {
      if (!(h.at < before)) continue;
      const v = (h.count * 60) / (h.seconds || r.seconds || 60);
      if (best === null || v > best) best = v;
    }
  }
  return best;
}

export const unitIndex = (lp, today) => (lp.days || []).filter((d) => d < today).length;

function lessonList(m) { return m.lessons.map((l) => l.id); }

export function newestChord(n, lp) {
  if (n <= 5) return 'C';
  if (n === 6) return lp.lessons?.['b1-602'] ? 'G' : 'C';
  return 'G';
}

// Prüfpunkte mit automatischer Auswertung, wo es Messwerte gibt
export function evaluateChecks(m, ctx) {
  const { lp, records } = ctx;
  const upTo = ctx.checkBefore ?? Infinity;
  return m.checks.map((c) => {
    let auto = null;
    if (c.auto === 'routine') {
      const vals = c.pairs.map(([a, b]) => ({ label: `${a}–${b}`, v: bestPerMinute(records, a, b, upTo) }));
      auto = {
        pass: vals.every((x) => x.v !== null && x.v >= OMC_GOAL),
        evidence: vals.map((x) => `${x.label}: ${x.v === null ? 'noch nicht gemessen' : `${Math.round(x.v)} pro Minute`}`).join(', '),
      };
    }
    if (c.auto === 'g1omc') {
      const pairs = [];
      for (let i = 0; i < GRADE1_CHORDS.length; i++) {
        for (let j = i + 1; j < GRADE1_CHORDS.length; j++) {
          const a = GRADE1_CHORDS[i];
          const b = GRADE1_CHORDS[j];
          pairs.push({ a, b, v: bestPerMinute(records, a, b, upTo) });
        }
      }
      const ok = pairs.filter((p) => p.v !== null && p.v >= OMC_GOAL).length;
      const open = pairs.filter((p) => p.v === null).length;
      const weak = pairs.filter((p) => p.v !== null && p.v < OMC_GOAL).sort((x, y) => x.v - y.v).slice(0, 3);
      auto = {
        pass: ok === pairs.length,
        evidence: `${ok} von ${pairs.length} Paaren ab ${OMC_GOAL} pro Minute, ${open} noch nicht gemessen${weak.length ? `. Am schwächsten: ${weak.map((p) => `${pairLabel(p)} ${Math.round(p.v)}`).join(', ')}` : ''}`,
      };
    }
    const counted = c.count ? (lp.songs || 0) >= c.count : false;
    const manual = Boolean(lp.checks?.[c.id]);
    return { ...c, auto, manual, pass: Boolean(auto?.pass) || manual || counted };
  });
}

export function moduleState(m, ctx) {
  const lessons = lessonList(m);
  const lessonsDone = lessons.filter((id) => ctx.lp.lessons?.[id]).length;
  const checks = evaluateChecks(m, ctx);
  const required = checks.filter((c) => !c.optional);
  const checksDone = required.filter((c) => c.pass).length;
  return {
    module: m,
    lessonsDone,
    lessonsTotal: lessons.length,
    checks,
    checksDone,
    checksTotal: required.length,
    done: lessonsDone === lessons.length && checksDone === required.length,
  };
}

export function currentModule(ctx) {
  return MODULES.find((m) => !moduleState(m, ctx).done) || MODULES[MODULES.length - 1];
}

export function nextLesson(m, lp) {
  return m.lessons.find((l) => !lp.lessons?.[l.id]) || null;
}

// Nimmt k Einträge aus der Liste, Einheit für Einheit weiter. Über alle Einheiten kommt jeder gleich oft dran.
export function rotate(list, k, n) {
  if (list.length <= k) return list.slice();
  const out = [];
  for (let j = 0; j < k; j++) out.push(list[(k * n + j) % list.length]);
  return out;
}

const durSeconds = (dur) => {
  if (!dur) return null;
  const [m, s] = dur.split(':').map(Number);
  return m * 60 + s;
};

// Eine Einheit. n ist die Nummer der Einheit (0 = erste), mode normal, kurz oder lektion.
export function buildSession(ctx, { n = 0, mode = 'normal', module: m = currentModule({ ...ctx, checkBefore: ctx.before }) } = {}) {
  const { lp, plans, patterns = [], scores = [], records = [], before = Infinity, countdownSeconds = 5 } = ctx;
  const ex = collectExercises(plans);
  const newest = newestChord(m.n, lp);

  // Akkorde: deine, dazu der neueste Akkord und in Modul 7 alle acht aus Grade 1
  const chordNames = ex.chords.map((c) => c.name);
  const extra = m.n >= 7 ? GRADE1_CHORDS : [newest];
  for (const c of extra) if (!chordNames.includes(c)) chordNames.push(c);
  const chordCfg = (name) => ex.chords.find((c) => c.name === name) || { name, voicing: 0, seconds: 60 };

  // Wechsel: deine, ergänzt um fehlende Paare mit dem neuesten Akkord (und in Modul 7 um alle Grade-1-Paare)
  const pairs = ex.pairs.slice();
  const have = new Set(pairs.map((p) => pairKey(p.a, p.b)));
  const addPair = (a, b) => {
    if (a === b || have.has(pairKey(a, b))) return;
    have.add(pairKey(a, b));
    pairs.push({ a, b, va: 0, vb: 0, seconds: 60, added: true });
  };
  for (const c of chordNames) addPair(newest, c);
  if (m.n >= 7) for (const a of GRADE1_CHORDS) for (const b of GRADE1_CHORDS) addPair(a, b);
  const involves = (p, c) => p.a === c || p.b === c;
  const newPairs = m.n >= 7 ? [] : pairs.filter((p) => involves(p, newest));
  const poolPairs = m.n >= 7 ? pairs : pairs.filter((p) => !involves(p, newest));

  const items = [];
  const used = new Set();
  const add = (step, why, src) => {
    if (used.has(step.id)) return;
    used.add(step.id);
    const over = lp.overrides?.[step.id];
    items.push({ step: over ? { ...step, config: { ...step.config, ...over } } : step, why, src });
  };

  const perfectStep = (name, hint) => {
    const c = chordCfg(name);
    return { id: `lp-pc-${name}`, type: 'chord', config: { chord: { name, voicing: c.voicing }, seconds: c.seconds, hint } };
  };
  const omcStep = (p, hint) => ({
    id: `lp-omc-${pairKey(p.a, p.b)}`,
    type: 'change',
    config: { a: { name: p.a, voicing: p.va }, b: { name: p.b, voicing: p.vb }, seconds: p.seconds, hint },
  });
  const timerStep = (id, label, seconds, extraCfg = {}) => ({ id, type: 'timer', config: { label, seconds, ...extraCfg } });
  const patternName = (id) => patterns.find((p) => p.id === id)?.name || '';
  const scoreTitle = (id) => scores.find((s) => s.id === id)?.title || '';

  const lessonOn = (id) => Boolean(lp.lessons?.[id]);
  const tpl = TEMPLATES[m.n] || TEMPLATES[7];
  const parts = mode === 'normal' ? tpl.normal : tpl.kurz;

  const songList = (lp.songList || []).filter((x) => x && x.trim());

  // Teile, die noch gesperrt sind, werden ersetzt (instead). Ohne Song gilt der Ersatz für die Song-Arbeit (fallback).
  const expand = (part) => {
    if (part.unlock && !lessonOn(part.unlock)) return part.instead ? [part.instead] : [];
    if (part.kind === 'song' && !songList.length) return part.fallback || [];
    return [part];
  };
  // Ersatzteile rücken an ihren Platz: Wechsel zu den Wechseln, Strums zu den Strums
  const ORDER = ['stretch', 'perfect', 'omc', 'picking', 'strum', 'sixeight', 'riff', 'song'];
  const plan = parts.flatMap(expand).map((p, i) => ({ p, i })).sort((x, y) => (ORDER.indexOf(x.p.kind) - ORDER.indexOf(y.p.kind)) || x.i - y.i).map((x) => x.p);

  // Weitere Wechsel laufen wie ein Lesezeichen durch deine Liste: Jede Einheit nimmt die nächsten.
  // Wie viele pro Einheit, hängt nur vom Ablauf ab, nicht vom Tag. So kommt jedes Paar gleich oft dran.
  const perUnit = plan.filter((p) => p.kind === 'omc' && p.from === 'pool').reduce((sum, p) => sum + (p.n || 1), 0);
  let cursor = n * perUnit;
  const drawPool = (k) => {
    const out = [];
    for (let guard = 0; out.length < k && guard < poolPairs.length; guard++) {
      const p = poolPairs[cursor % poolPairs.length];
      cursor += 1;
      if (!used.has(`lp-omc-${pairKey(p.a, p.b)}`)) out.push(p);
    }
    return out;
  };

  const run = (part) => {
    switch (part.kind) {
      case 'stretch':
        if (ex.stretch) add(timerStep('lp-stretch', ex.stretch.label, ex.stretch.seconds), 'Aufwärmen', 'Dein Plan');
        break;
      case 'perfect': {
        if (part.from === 'new') {
          add(perfectStep(newest, HINTS.perfectNew(newest)), `Neuester Akkord`, `Justin, Modul ${m.n}`);
          break;
        }
        const rot = chordNames.filter((c) => (m.n >= 7 ? true : c !== newest));
        const k = part.n || 1;
        const picks = [];
        if (lp.problemChord && rot.includes(lp.problemChord)) picks.push(lp.problemChord);
        const rest = rot.filter((c) => !picks.includes(c));
        // Mehrere Perfect-Blöcke in einer Einheit teilen sich die Reihe
        picks.push(...rotate(rest, k - picks.length, n));
        for (const c of picks) {
          add(perfectStep(c, HINTS.perfect), c === lp.problemChord ? 'Dein Problem-Akkord' : 'Reihum', c === lp.problemChord ? 'Justin, Routine' : 'Dein Plan');
        }
        break;
      }
      case 'omc': {
        const k = part.n || 1;
        if (part.from === 'new') {
          for (const p of rotate(newPairs, k, n)) add(omcStep(p, HINTS.omcNew(newest)), `Wechsel mit ${newest}`, p.added ? `Justin, Modul ${m.n}` : 'Dein Plan');
        } else if (part.from === 'weak') {
          const weak = pairs
            .map((p) => ({ p, v: bestPerMinute(records, p.a, p.b, before) }))
            .filter((x) => x.v !== null && x.v < OMC_GOAL)
            .sort((x, y) => x.v - y.v)
            .slice(0, k);
          for (const { p, v } of weak) add(omcStep(p, HINTS.omcWeak), `Schwach: ${Math.round(v)} pro Minute`, 'Justin, Modul 7');
          // Gibt es keine zwei Wechsel unter 30, kommen weitere aus der Reihe
          const missing = k - weak.length;
          if (missing > 0) run({ kind: 'omc', from: 'pool', n: missing });
        } else {
          for (const p of drawPool(k)) add(omcStep(p, HINTS.omcPool), 'Reihum', p.added ? 'Grade 1' : 'Dein Plan');
        }
        break;
      }
      case 'strum': {
        if (part.alt && lessonOn(part.alt.unlock) && n % 2 === 1) {
          run(part.alt);
          break;
        }
        let list = ex.strums.slice();
        const k = part.n || 1;
        if (part.first) {
          const re = new RegExp(part.first, 'i');
          let first = list.find((s) => re.test(patternName(s.patternId)));
          if (!first) {
            const pat = patterns.find((p) => re.test(p.name));
            if (pat) first = { patternId: pat.id, bpm: 80, seconds: 60 };
          }
          if (first) {
            add({ id: `lp-strum-${first.patternId}`, type: 'strum', config: { ...first, bpm: Math.max(first.bpm || 80, 80), hint: HINTS.oldFaithful } }, 'Grade-1-Ziel', 'Grade 1');
            list = list.filter((s) => s.patternId !== first.patternId);
          }
          for (const s of rotate(list, k - 1, n)) {
            add({ id: `lp-strum-${s.patternId}`, type: 'strum', config: { ...s, hint: HINTS.strum } }, 'Reihum', 'Dein Plan');
          }
          break;
        }
        for (const s of rotate(list, k, n)) {
          add({ id: `lp-strum-${s.patternId}`, type: 'strum', config: { ...s, hint: m.n === 5 ? HINTS.strum5 : HINTS.strum } }, 'Reihum', 'Dein Plan');
        }
        break;
      }
      case 'sixeight':
        add(timerStep('lp-68', '6/8-Strumming', 120, { hint: HINTS.sixEight, link: MODULES[1].lessons[3].url, linkLabel: 'Lektion öffnen' }), m.n === 6 ? 'Neu in Modul 6' : 'Aus Modul 6', `Justin, Modul ${m.n}`);
        break;
      case 'picking':
        add(timerStep('lp-pick', 'Wechselschlag', 60, { hint: HINTS.picking }), 'Neu in Modul 6', 'Justin, Modul 6');
        break;
      case 'riff': {
        const riffs = ex.riffs;
        if (!riffs.length) break;
        const focus = part.focus ? riffs.find((r) => scoreTitle(r.scoreId).toLowerCase().includes(part.focus.toLowerCase())) : null;
        let pick;
        let why = 'Reihum';
        if (focus && n % 2 === 0) {
          pick = focus;
          why = `Riff aus Modul ${m.n}, jede zweite Einheit`;
        } else {
          const others = focus ? riffs.filter((r) => r !== focus) : riffs;
          pick = rotate(others, 1, focus ? Math.floor(n / 2) : n)[0] || focus;
        }
        const isFocus = pick === focus;
        add({ id: `lp-riff-${pick.scoreId}`, type: 'riff', config: { scoreId: pick.scoreId, hint: isFocus ? HINTS.caya : HINTS.riff } }, why, isFocus ? `Justin, Modul ${m.n}` : 'Dein Plan');
        break;
      }
      case 'song': {
        const note = [SONG_NOTES[m.n], m.n === 6 && lessonOn('b1-606') ? HINTS.forcing : ''].filter(Boolean).join(' ');
        const songLink = m.n === 5 ? MODULES[0].lessons[6].url : m.n === 6 ? MODULES[1].lessons[6].url : MODULES[2].lessons[6].url;
        const song = rotate(songList, 1, n)[0];
        add(timerStep('lp-song', `Song: ${song}`, (part.min || 5) * 60, { hint: note, link: songLink, linkLabel: m.n === 7 ? 'Lektion öffnen' : 'Songliste öffnen' }),
          songList.length > 1 ? 'Deine Songs reihum' : 'Dein Song', `Justin, Modul ${m.n}`);
        break;
      }
      default:
        break;
    }
  };

  plan.forEach(run);

  // Lektionstag: die Lektion plus so viel aus der Kurz-Einheit, wie in 20 Minuten passt
  let lesson = null;
  if (mode === 'lektion') {
    lesson = nextLesson(m, lp);
    if (lesson) {
      const lessonSeconds = durSeconds(lesson.dur) || 15 * 60;
      let total = lessonSeconds + countdownSeconds;
      const keep = [];
      for (const it of items) {
        const sec = stepSeconds(it.step) + countdownSeconds;
        if (keep.length && total + sec > DAY_SECONDS) break;
        total += sec;
        keep.push(it);
      }
      items.splice(0, items.length, ...keep);
      add(timerStep(`lp-lesson-${lesson.id}`, `Lektion: ${lesson.title}`, lessonSeconds, {
        hint: 'Lektion ansehen. Danach im Lernplan unter Kurs abhaken.',
        link: lesson.url,
        linkLabel: 'Lektion öffnen',
      }), 'Nächste Lektion', `Justin, Modul ${m.n}`);
    }
  }

  return { module: m, n, mode, newest, items, steps: items.map((i) => i.step), lesson };
}

// Geschätzte Dauer in Sekunden: Timer, Countdown vor jedem Timer, Riffs mit etwa zwei Minuten
export function estimateSeconds(steps, countdownSeconds = 5) {
  let total = 0;
  for (const s of steps) {
    if (s.type === 'riff' || s.type === 'song') total += RIFF_SECONDS;
    else total += (s.config.seconds || 60) + countdownSeconds;
  }
  return total;
}

export function stepSeconds(step) {
  return step.type === 'riff' || step.type === 'song' ? RIFF_SECONDS : step.config.seconds || 60;
}

// Wie oft jede deiner Übungen in den nächsten `count` Einheiten drankommt
export function coverage(ctx, { from = 0, count = 30, module: m = currentModule(ctx) } = {}) {
  const ex = collectExercises(ctx.plans);
  const tally = new Map();
  const labels = new Map();
  for (let i = 0; i < count; i++) {
    for (const s of buildSession(ctx, { n: from + i, module: m }).steps) {
      tally.set(s.id, (tally.get(s.id) || 0) + 1);
      labels.set(s.id, s);
    }
  }
  const rows = [];
  const row = (group, id, label) => rows.push({ group, id, label, times: tally.get(id) || 0 });
  if (ex.stretch) row('Aufwärmen', 'lp-stretch', ex.stretch.label);
  for (const c of ex.chords) row('Akkorde', `lp-pc-${c.name}`, c.name);
  for (const p of ex.pairs) row('Wechsel', `lp-omc-${pairKey(p.a, p.b)}`, pairLabel(p));
  for (const st of ex.strums) row('Strums', `lp-strum-${st.patternId}`, null);
  for (const r of ex.riffs) row('Riffs', `lp-riff-${r.scoreId}`, null);
  const mine = new Set(rows.map((r) => r.id));
  const added = [...tally.entries()].filter(([id]) => !mine.has(id)).map(([id, times]) => ({ id, times, step: labels.get(id) }));
  const other = [...ex.other, ...ex.songs.map((s) => ({ step: { type: 'song', config: s } }))];
  return { rows, added, other, count };
}
