// Lernplan: Heute, Plan und Kurs. Schlägt jeden Tag eine Einheit vor, gebaut aus deinen Übungen
// und Justins Grade-1-Modulen. Deine eigenen Pläne bleiben unberührt.
import { html, useEffect, useState } from '../../vendor/htm-preact.js';
import { dayKey, fmtTime, useStore } from '../lib/core.js';
import { COURSE, MODULES, SONG_IDEAS, TEMPLATES, WEEK } from '../lib/lernplan-data.js';
import {
  buildSession, coverage, currentModule, estimateSeconds, moduleState, newestChord, nextLesson, stepSeconds, unitIndex,
} from '../lib/lernplan.js';
import { go } from '../lib/router.js';
import { patterns, plans, records, scores, settings, STEP_TYPES, stepTitle, updateSettings } from '../lib/state.js';
import { toast } from '../lib/ui-state.js';
import { Button, Empty, Stepper } from '../ui/common.js';
import { Icon } from '../ui/icons.js';
import { StepRunner } from './practice.js';

const TABS = [
  { id: '', label: 'Heute' },
  { id: 'plan', label: 'Plan' },
  { id: 'kurs', label: 'Kurs' },
];

const updateLp = (patch) => updateSettings({ lernplan: patch });

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function useLernCtx() {
  const lp = useStore(settings, (s) => s.lernplan);
  const countdownSeconds = useStore(settings, (s) => s.countdownSeconds);
  const planList = useStore(plans.store);
  const patternList = useStore(patterns.store);
  const scoreList = useStore(scores.store);
  const recordList = useStore(records.store);
  return {
    lp,
    plans: planList,
    patterns: patternList,
    scores: scoreList,
    records: recordList,
    countdownSeconds,
    today: dayKey(),
    before: startOfToday(),
  };
}

function todayMode(ctx) {
  const m = ctx.lp.mode;
  return m && m.day === ctx.today ? m.value : 'normal';
}

function todaySession(ctx) {
  const module = currentModule({ ...ctx, checkBefore: ctx.before });
  const n = unitIndex(ctx.lp, ctx.today);
  let mode = todayMode(ctx);
  if (mode === 'lektion' && !nextLesson(module, ctx.lp)) mode = 'normal';
  return buildSession(ctx, { n, mode, module });
}

const minutes = (sec) => `${Math.round(sec / 60)} Min.`;

function Tabs({ tab }) {
  return html`<nav class="lp-tabs" aria-label="Lernplan">
    ${TABS.map((t) => html`<a href=${`#/lernplan${t.id ? `/${t.id}` : ''}`} aria-current=${tab === t.id ? 'page' : undefined}>${t.label}</a>`)}
  </nav>`;
}

export function LernplanPage({ tab = '' }) {
  const ctx = useLernCtx();
  const module = currentModule({ ...ctx, checkBefore: ctx.before });
  return html`<div class="page lp-page">
    <header class="lp-head">
      <div>
        <h1>Lernplan</h1>
        <p class="muted">${COURSE.title}, Modul ${module.n}: ${module.title}</p>
      </div>
      <${Tabs} tab=${tab}/>
    </header>
    ${tab === 'plan' ? html`<${PlanTab} ctx=${ctx} current=${module}/>`
      : tab === 'kurs' ? html`<${KursTab} ctx=${ctx} current=${module}/>`
        : html`<${HeuteTab} ctx=${ctx}/>`}
  </div>`;
}

// ---------- Heute ----------

function itemTitle(step) {
  if (step.type === 'chord') return `Chord Perfect ${step.config.chord.name}`;
  if (step.type === 'change') return `Wechsel ${step.config.a.name}–${step.config.b.name}`;
  return stepTitle(step);
}

function HeuteTab({ ctx }) {
  const session = todaySession(ctx);
  const mode = session.mode;
  const done = (ctx.lp.days || []).includes(ctx.today);
  const total = estimateSeconds(session.steps, ctx.countdownSeconds);
  const lesson = nextLesson(session.module, ctx.lp);
  const date = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const setMode = (value) => updateLp({ mode: { day: ctx.today, value } });
  const toggleDone = () => {
    const days = (ctx.lp.days || []).filter((d) => d !== ctx.today);
    updateLp({ days: done ? days : [...days, ctx.today].sort() });
    toast(done ? 'Wieder offen' : 'Einheit eingetragen', done ? 'info' : 'good');
  };
  const options = [
    { value: 'normal', label: `Normal, ${WEEK.minutes} Min.` },
    { value: 'kurz', label: `Kurz, ${WEEK.minimum} Min.` },
    ...(lesson ? [{ value: 'lektion', label: 'Lektionstag' }] : []),
  ];

  return html`
    <section class="lp-hero">
      <div class="stack">
        <div class="lp-panel lp-today">
          <p class="lp-date">${date}</p>
          <h2>Einheit ${session.n + 1}</h2>
          <p class="lp-big">${minutes(total)}</p>
          <p class="muted small">${mode === 'kurz' ? 'Das Minimum aus deinem Wochenplan, für Tage mit wenig Zeit.'
            : mode === 'lektion' ? `Neue Lektion und so viel Übung, wie in ${WEEK.minutes} Minuten passt.`
              : `Dein Gitarren-Slot aus dem Wochenplan: ${WEEK.minutes} Minuten.`}</p>
          <div class="segmented" role="group" aria-label="Art der Einheit">
            ${options.map((o) => html`<button type="button" class=${mode === o.value ? 'on' : ''} aria-pressed=${mode === o.value} onClick=${() => setMode(o.value)}>${o.label}</button>`)}
          </div>
          <div class="row wrap">
            <${Button} variant="primary" size="lg" icon="play" onClick=${() => go('lernplan/lauf/0')}>Einheit starten<//>
            <${Button} icon=${done ? 'check' : undefined} class=${done ? 'btn-on' : ''} onClick=${toggleDone}>${done ? 'Heute erledigt' : 'Ohne App geübt'}<//>
          </div>
          ${done && html`<p class="small muted">Erledigt. Morgen kommt die nächste Einheit. Zurücknehmen mit einem Klick auf „Heute erledigt“.</p>`}
        </div>
        ${lesson && html`<section class="lp-panel lp-lesson">
          <div>
            <p class="lp-kicker">Nächste Lektion, ${session.module.n}.${session.module.lessons.indexOf(lesson) + 1}</p>
            <h3>${lesson.title}</h3>
            ${lesson.sum && html`<p class="muted">${lesson.sum}</p>`}
          </div>
          <div class="row wrap">
            ${lesson.dur && html`<span class="muted">${lesson.dur} Min.</span>`}
            <a class="btn" href=${lesson.url} target="_blank" rel="noopener"><${Icon} name="link" size=${18}/>Ansehen</a>
            <${Button} icon="check" onClick=${() => { updateLp({ lessons: { [lesson.id]: true } }); toast(`${lesson.title} abgehakt`, 'good'); }}>Gesehen<//>
          </div>
        </section>`}
        ${!(ctx.lp.songList || []).length && html`<${SongCard} module=${session.module}/>`}
      </div>
      <div class="lp-panel">
        <h3>Ablauf</h3>
        <div class="lp-segbar" aria-hidden="true">
          ${session.steps.map((s) => html`<i class=${`k-${s.type}`} style=${`flex-grow:${stepSeconds(s)}`}></i>`)}
        </div>
        <ol class="lp-seglist">
          ${session.items.map((it, i) => html`<li>
            <span class="lp-min">${it.step.type === 'riff' ? 'ca. 2:00' : fmtTime(stepSeconds(it.step))}</span>
            <span class="lp-what">
              <a href=${`#/lernplan/lauf/${i}`}><b>${itemTitle(it.step)}</b></a>
              <small>${it.why}</small>
            </span>
            <span class=${`lp-src ${it.src === 'Dein Plan' ? 'own' : ''}`}>${it.src}</span>
          </li>`)}
        </ol>
        <p class="small muted">Vor jedem Timer läuft dein Countdown von ${ctx.countdownSeconds} Sekunden. Er ist in der Zeit oben enthalten.</p>
      </div>
    </section>


    <${Upcoming} ctx=${ctx} session=${session}/>
  `;
}

function Upcoming({ ctx, session }) {
  const days = [];
  for (let k = 1; k <= 6; k++) {
    const d = new Date();
    d.setDate(d.getDate() + k);
    const s = buildSession(ctx, { n: session.n + k, module: session.module });
    const label = k === 1 ? 'Morgen' : d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
    const pick = (type) => s.steps.filter((x) => x.type === type);
    days.push({
      label,
      perfect: pick('chord').map((x) => x.config.chord.name).join(', '),
      changes: pick('change').map((x) => `${x.config.a.name}–${x.config.b.name}`).join(', '),
      strums: pick('strum').map((x) => stepTitle(x)).join(', '),
      riff: pick('riff').map((x) => stepTitle(x)).join(', '),
      extra: s.steps.filter((x) => ['lp-68', 'lp-pick'].includes(x.id)).map((x) => x.config.label).join(', '),
    });
  }
  return html`<section class="stack">
    <div>
      <h3>Die nächsten Einheiten</h3>
      <p class="small muted">Gezählt wird in Einheiten, nicht in Tagen. Lässt du einen Tag aus, kommt die Einheit einfach am nächsten.</p>
    </div>
    <div class="lp-week">
      ${days.map((d) => html`<div>
        <b>${d.label}</b>
        <span>Perfect: ${d.perfect}</span>
        <span>Wechsel: ${d.changes}</span>
        <span>Strums: ${d.strums}</span>
        ${d.extra && html`<span>${d.extra}</span>`}
        ${d.riff && html`<span>Riff: ${d.riff}</span>`}
      </div>`)}
    </div>
  </section>`;
}

function addSong(lp, name) {
  const clean = name.trim();
  if (!clean) return false;
  const list = (lp.songList || []).filter((x) => x.toLowerCase() !== clean.toLowerCase());
  updateLp({ songList: [...list, clean] });
  toast(`${clean} kommt ab jetzt in die Song-Arbeit`, 'good');
  return true;
}

function SongInput({ lp }) {
  const [name, setName] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (addSong(lp, name)) setName('');
  };
  return html`<form class="row wrap lp-songform" onSubmit=${submit}>
    <input type="text" placeholder="Songname, z. B. Eleanor Rigby" value=${name} onInput=${(e) => setName(e.currentTarget.value)} aria-label="Song hinzufügen"/>
    <${Button} type="submit" icon="plus" disabled=${!name.trim()}>Song hinzufügen<//>
  </form>`;
}

function SongCard({ module: m }) {
  const lp = useStore(settings, (s) => s.lernplan);
  const idea = SONG_IDEAS[m.n];
  const lesson = m.lessons.find((l) => l.id === idea.lesson);
  return html`<section class="lp-panel lp-songcard stack">
    <p class="lp-kicker">Noch kein Song</p>
    <p>Justin plant in jeder Einheit Zeit für Songs ein. Solange du keinen hast, gehen diese 5 Minuten an 4 weitere Wechsel.</p>
    <p class="small muted">${idea.text}</p>
    ${lesson && html`<a class="small" href=${lesson.url} target="_blank" rel="noopener">${lesson.title} öffnen</a>`}
    <${SongInput} lp=${lp}/>
  </section>`;
}

function SongList({ ctx, module: m }) {
  const list = ctx.lp.songList || [];
  const remove = (name) => updateLp({ songList: list.filter((x) => x !== name) });
  return html`<section class="lp-panel stack">
    <h3>Deine Songs</h3>
    <p class="small muted">Songs, die du gerade übst. Sie kommen reihum in die Song-Arbeit, jede Einheit einer. Ohne Song gehen die 5 Minuten an 4 weitere Wechsel. ${SONG_IDEAS[m.n].text}</p>
    ${list.length > 0 && html`<ul class="lp-songs">${list.map((name) => html`<li>
      <span>${name}</span>
      <${Button} size="sm" icon="trash" aria-label=${`${name} entfernen`} onClick=${() => remove(name)}>Entfernen<//>
    </li>`)}</ul>`}
    <${SongInput} lp=${ctx.lp}/>
  </section>`;
}

// ---------- Plan ----------

function describePart(part, m, lp) {
  const newest = newestChord(m.n, lp);
  const lesson = (id) => {
    const l = m.lessons.findIndex((x) => x.id === id);
    return l >= 0 ? `${m.n}.${l + 1}` : id;
  };
  const base = (p) => {
    switch (p.kind) {
      case 'stretch': return ['2′', 'Finger Stretch', 'Dein Plan'];
      case 'perfect':
        return p.from === 'new'
          ? ['1′', `Chord Perfect auf dem neuesten Akkord (${newest})`, `Justin, Modul ${m.n}`]
          : [`${p.n || 1} × 1′`, 'Chord Perfect, deine anderen Akkorde reihum oder dein Problem-Akkord', 'Dein Plan'];
      case 'omc':
        if (p.from === 'new') return [`${p.n} × 1′`, `Wechsel mit ${newest}, reihum`, `Justin, Modul ${m.n}`];
        if (p.from === 'weak') return [`${p.n} × 1′`, 'Deine schwächsten Wechsel unter 30 pro Minute', 'Justin, Modul 7'];
        return [`${p.n} × 1′`, m.n >= 7 ? 'Weitere Wechsel aller acht Akkorde, reihum' : 'Weitere Wechsel aus deinem Plan, reihum', 'Dein Plan'];
      case 'strum':
        return [`${p.n} × 1′`, p.first ? `Strumming: ${p.first} immer, dazu deine Muster reihum` : 'Strumming, deine Muster reihum', 'Dein Plan'];
      case 'picking': return ['1′', 'Wechselschlag auf einer Saite', `Justin, Modul ${m.n}`];
      case 'sixeight': return ['2′', '6/8-Strumming mit Metronom', `Justin, Modul ${m.n}`];
      case 'riff': return ['ca. 2′', p.focus ? `Riff: ${p.focus} jede zweite Einheit, sonst deine anderen Riffs reihum` : 'Riff, deine Riffs reihum', p.focus ? `Justin, Modul ${m.n}` : 'Dein Plan'];
      case 'song': return [`${p.min}′`, 'Song-Arbeit, deine Songs reihum', `Justin, Modul ${m.n}`];
      default: return ['', p.kind, ''];
    }
  };
  const [min, text, src] = base(part);
  const extra = [];
  if (part.unlock) {
    const before = part.instead ? base(part.instead) : null;
    extra.push(`ab Lektion ${lesson(part.unlock)}${before ? `, vorher ${before[0]} ${before[1].split(',')[0]}` : ''}`);
  }
  if (part.fallback) {
    const fb = base(part.fallback[0]);
    extra.push(`ohne Song ${fb[0]} ${fb[1].split(',')[0]}`);
  }
  return [min, extra.length ? `${text} (${extra.join('; ')})` : text, src];
}

function CheckItem({ c, lp }) {
  const toggle = (e) => updateLp({ checks: { [c.id]: e.currentTarget.checked } });
  return html`<li class=${c.pass ? 'pass' : ''}>
    <label>
      <input type="checkbox" checked=${c.manual || Boolean(c.auto?.pass)} disabled=${Boolean(c.auto?.pass)} onChange=${toggle}/>
      <span>
        ${c.text}${c.optional ? html` <span class="lp-src">empfohlen</span>` : ''}
        ${c.how && html`<small>${c.how}</small>`}
        ${c.auto && html`<small class=${c.auto.pass ? 'lp-good' : ''}>${c.auto.pass ? 'Laut Messung erfüllt. ' : 'Stand: '}${c.auto.evidence}</small>`}
        ${c.link && html`<small><a href=${c.link} target="_blank" rel="noopener">Lektion öffnen</a></small>`}
      </span>
    </label>
    ${c.count && html`<div class="row lp-count">
      <${Stepper} label="Songs auswendig" value=${lp.songs || 0} min=${0} max=${20} onChange=${(v) => updateLp({ songs: v })}/>
      <span class="small muted">von ${c.count} Songs</span>
    </div>`}
  </li>`;
}

function Stage({ m, ctx, current }) {
  const st = moduleState(m, ctx);
  const isCurrent = m.n === current.n;
  const state = st.done ? 'erledigt' : isCurrent ? 'aktuell' : 'später';
  const tpl = TEMPLATES[m.n];
  return html`<details class=${`lp-stage ${isCurrent ? 'cur' : ''}`} open=${isCurrent}>
    <summary>
      <span class="lp-num">${m.n}</span>
      <span class="lp-stage-t">
        <b>Modul ${m.n}: ${m.title}</b>
        <small>${m.de}</small>
      </span>
      <span class="lp-pills">
        <span class=${`lp-pill ${st.done ? 'g' : isCurrent ? 'a' : ''}`}>${state}</span>
        <span class="lp-pill">Lektionen ${st.lessonsDone}/${st.lessonsTotal}</span>
        <span class="lp-pill">Prüfpunkte ${st.checksDone}/${st.checksTotal}</span>
      </span>
    </summary>
    <div class="lp-stage-body">
      <div>
        <h4>Prüfpunkte</h4>
        <p class="small muted">${m.n === 7 ? 'Justins Kriterien aus „How to PASS Grade 1“.' : `Justins Ziele für Modul ${m.n}.`} Weiter geht es, wenn alle erfüllt und alle Lektionen gesehen sind. Wo es Messwerte gibt, prüft Guitarhero selbst.</p>
        <ul class="lp-checks">${st.checks.map((c) => html`<${CheckItem} c=${c} lp=${ctx.lp}/>`)}</ul>
        ${m.note && html`<p class="small">${m.note}</p>`}
      </div>
      <div>
        <h4>Ablauf einer Einheit</h4>
        <ul class="lp-parts">
          ${tpl.normal.map((p) => {
            const [min, text, src] = describePart(p, m, ctx.lp);
            return html`<li><span class="lp-min">${min}</span><span>${text}</span><span class=${`lp-src ${src === 'Dein Plan' ? 'own' : ''}`}>${src}</span></li>`;
          })}
        </ul>
        <h4>Justins Routine zum Vergleich</h4>
        ${m.routine.items
          ? html`<ul class="lp-ref">${m.routine.items.map((t) => html`<li>${t}</li>`)}</ul>`
          : html`<p class="small muted">Die Seite „Module ${m.n} Practice“ ließ sich nicht auslesen. Der Ablauf oben folgt deshalb den Lektionen von Modul ${m.n}.</p>`}
        <a class="small" href=${m.routine.url} target="_blank" rel="noopener">Module ${m.n} Practice öffnen</a>
      </div>
    </div>
  </details>`;
}

function chordChoices(ctx) {
  const set = [];
  for (const p of ctx.plans) for (const s of p.steps || []) if (s.type === 'chord' && s.config?.chord?.name && !set.includes(s.config.chord.name)) set.push(s.config.chord.name);
  for (const c of ['A', 'D', 'E', 'Am', 'Dm', 'Em', 'C', 'G']) if (!set.includes(c)) set.push(c);
  return set;
}

function PlanTab({ ctx, current }) {
  const n = unitIndex(ctx.lp, ctx.today);
  const cov = coverage({ ...ctx, before: ctx.before }, { from: n, count: 21, module: current });
  const name = (row) => {
    if (row.label) return row.label;
    if (row.group === 'Strums') return patterns.find(row.id.slice('lp-strum-'.length))?.name || 'Muster';
    if (row.group === 'Riffs') return scores.find(row.id.slice('lp-riff-'.length))?.title || 'Riff';
    return row.id;
  };
  const groups = [...new Set(cov.rows.map((r) => r.group))];
  return html`
    <section class="stack">${MODULES.map((m) => html`<${Stage} key=${m.n} m=${m} ctx=${ctx} current=${current}/>`)}</section>

    <${SongList} ctx=${ctx} module=${current}/>

    <section class="lp-panel stack">
      <h3>Dein Problem-Akkord</h3>
      <p class="small muted">Justin lässt Chord Perfect auf dem Akkord üben, der am schwersten fällt. Wählst du einen, kommt er jeden Tag dran. Sonst laufen deine Akkorde reihum.</p>
      <select class="lp-select" value=${ctx.lp.problemChord || ''} onChange=${(e) => updateLp({ problemChord: e.currentTarget.value })} aria-label="Problem-Akkord">
        <option value="">Keiner, reihum</option>
        ${chordChoices(ctx).map((c) => html`<option value=${c}>${c}</option>`)}
      </select>
    </section>

    <section class="lp-panel stack">
      <h3>Wie oft deine Übungen drankommen</h3>
      <p class="small muted">In den nächsten ${cov.count} Einheiten von Modul ${current.n}, ausgerechnet mit derselben Regel wie die Einheit für heute. Die Übungen kommen aus deinen Plänen. Nimmst du dort etwas dazu, ist es hier auch dabei.</p>
      <div class="lp-cov">
        ${groups.map((g) => html`<div>
          <h4>${g}</h4>
          <ul>${cov.rows.filter((r) => r.group === g).map((r) => html`<li class=${r.times ? '' : 'zero'}><span>${name(r)}</span><b>${r.times} ×</b></li>`)}</ul>
        </div>`)}
        ${cov.added.length > 0 && html`<div>
          <h4>Vom Lernplan ergänzt</h4>
          <ul>${cov.added.map((a) => html`<li><span>${a.step ? itemTitle(a.step) : a.id}</span><b>${a.times} ×</b></li>`)}</ul>
        </div>`}
      </div>
      ${cov.other.length > 0 && html`<p class="small muted">Nicht im Lernplan: ${cov.other.map((o) => `${STEP_TYPES[o.step.type]?.label || o.step.type} „${stepTitle(o.step)}“`).join(', ')}. Diese Schritte übst du weiter in deinem eigenen Plan.</p>`}
    </section>

    <section class="lp-panel stack">
      <h3>So ist der Plan gebaut</h3>
      <ol class="lp-rules">
        <li><b>Zeit:</b> ${WEEK.minutes} Minuten am Tag, im Notfall ${WEEK.minimum}. So steht es in deinem Wochenplan (${WEEK.slots}).</li>
        <li><b>Inhalt:</b> Geübt wird, was in deinen Plänen steht. Deine eigenen Pläne ändert der Lernplan nicht.</li>
        <li><b>Schwerpunkt:</b> Justins Module geben vor, welcher Akkord neu ist, was neu dazukommt und wann es weitergeht. Seine Routinen dienen als Vorlage, nicht als Vorschrift.</li>
        <li><b>Song-Arbeit:</b> Justin plant 10 von 20 Minuten für Songs ein. Hier sind es 5, weil deine Pläne mehr Technik enthalten. Ohne Song gehen sie an 4 weitere Wechsel, weil dort dein Abstand zum Ziel gemessen ist. Für die Prüfpunkte in Modul 5 und 6 brauchst du je einen Song, für Grade 1 fünf.</li>
        <li><b>Reihenfolge:</b> Alles, was nicht täglich drankommt, läuft reihum. Ein Lesezeichen wandert pro Einheit weiter, damit jede Übung gleich oft kommt.</li>
        <li><b>Weiterkommen:</b> Ein Modul ist fertig, wenn alle Lektionen abgehakt und alle Prüfpunkte erfüllt sind. Akkordwechsel prüft Guitarhero mit deinen gemessenen Rekorden.</li>
        <li><b>Lektionen:</b> Wann du die nächste Lektion schaust, entscheidest du. Am Lektionstag ersetzt sie den größten Teil der Übungszeit. Justin sagt dazu: keine Eile, in einem Tempo, das sich gut anfühlt.</li>
      </ol>
      <p class="small muted">Quellen: <a href=${COURSE.url} target="_blank" rel="noopener">Beginner Grade 1</a>, die Lektionsseiten im Kurs-Reiter und dein Wochenplan. Stand der Kursdaten: November 2026.</p>
    </section>
  `;
}

// ---------- Kurs ----------

function KursTab({ ctx, current }) {
  const lp = ctx.lp;
  const toggle = (id, on) => updateLp({ lessons: { [id]: on } });
  return html`
    <p class="muted">${COURSE.doneBefore} hast du laut dir abgeschlossen. Hier geht es ab Modul 5 weiter.</p>
    ${MODULES.map((m) => {
      const next = nextLesson(m, lp);
      return html`<section class="lp-kurs">
        <header class="lp-kurs-h">
          <span class="lp-num">${m.n}</span>
          <div>
            <h3>${m.title}</h3>
            <p class="small muted">${m.de} · <a href=${m.url} target="_blank" rel="noopener">Modul bei JustinGuitar</a></p>
          </div>
        </header>
        <ol class="lp-lessons">
          ${m.lessons.map((l, i) => {
            const done = Boolean(lp.lessons?.[l.id]);
            const isNext = m.n === current.n && next?.id === l.id;
            return html`<li class=${`${done ? 'done' : ''} ${isNext ? 'next' : ''}`}>
              <input type="checkbox" checked=${done} aria-label=${`${l.title} gesehen`} onChange=${(e) => toggle(l.id, e.currentTarget.checked)}/>
              <span class="lp-n">${m.n}.${i + 1}</span>
              <span class="lp-ti"><b>${l.title}</b>${l.sum && html`<small>${l.sum}</small>`}${isNext && html`<small class="lp-good">Als Nächstes dran</small>`}</span>
              <span class="lp-dur">${l.dur || ''}</span>
              <a href=${l.url} target="_blank" rel="noopener">Ansehen</a>
            </li>`;
          })}
        </ol>
      </section>`;
    })}
  `;
}

// ---------- Üben und fertig ----------

export function LernRunPage({ index, setDockSlot }) {
  const ctx = useLernCtx();
  const session = todaySession(ctx);
  const plan = { id: `lernplan-${ctx.today}-${session.mode}`, name: 'Lernplan', steps: session.steps };
  if (!plan.steps.length) {
    return html`<div class="page"><${Empty} title="Heute ist nichts geplant"><${Button} onClick=${() => go('lernplan')}>Zum Lernplan<//><//></div>`;
  }
  const onConfig = (step, patch) => {
    const keep = { ...patch };
    delete keep.hint;
    delete keep.link;
    delete keep.label;
    updateLp({ overrides: { [step.id]: keep } });
  };
  return html`<${StepRunner} plan=${plan} index=${index} setDockSlot=${setDockSlot}
    path="lernplan/lauf" donePath="lernplan/fertig" backPath="lernplan" onConfig=${onConfig}/>`;
}

export function LernDonePage() {
  const ctx = useLernCtx();
  const [marked] = useState(() => (ctx.lp.days || []).includes(ctx.today));
  useEffect(() => {
    if (!marked) updateLp({ days: [...(ctx.lp.days || []).filter((d) => d !== ctx.today), ctx.today].sort() });
  }, []);
  return html`<div class="page done-page">
    <h1>Einheit geschafft</h1>
    <p>Gut gemacht. Die Einheit ist eingetragen, morgen geht es mit der nächsten weiter.</p>
    <div class="row">
      <${Button} variant="primary" onClick=${() => go('lernplan')}>Zum Lernplan<//>
      <${Button} onClick=${() => go('fortschritt')}>Fortschritt ansehen<//>
    </div>
  </div>`;
}
