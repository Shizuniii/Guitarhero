import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { fmtTime, uid, useStore } from '../lib/core.js';
import { normalizeChordName } from '../lib/chords.js';
import { clearTakes } from '../lib/recorder.js';
import { getRoute, go, useRoute } from '../lib/router.js';
import { patterns, plans, scores, settings, STEP_TYPES, stepTitle, updateSettings } from '../lib/state.js';
import { setHotkeys, toast } from '../lib/ui-state.js';
import { ChangeStep } from '../steps/change.js';
import { ChordStep } from '../steps/chord.js';
import { RecordStep } from '../steps/record.js';
import { ScoreStep } from '../steps/score.js';
import { StrumStep } from '../steps/strum.js';
import { MetronomeStep } from '../steps/metronome.js';
import { TimerStep } from '../steps/timer.js';
import { ChordInput } from '../ui/chord.js';
import { Button, confirmDialog, Empty, Field, Modal, PageHead, Stepper } from '../ui/common.js';
import { Fretboard } from '../ui/fretboard.js';
import { Icon } from '../ui/icons.js';

const ICONS = { chord: 'chord', timer: 'timer', metronome: 'metronome', change: 'chord', strum: 'strum', riff: 'riff', song: 'song', record: 'mic' };
const HOSTS = { chord: ChordStep, timer: TimerStep, metronome: MetronomeStep, change: ChangeStep, strum: StrumStep, riff: ScoreStep, song: ScoreStep, record: RecordStep };
const TIMED = ['chord', 'change', 'strum', 'timer'];

function runLabel(step) {
  const artist = step.config.scoreId ? scores.find(step.config.scoreId)?.artist : '';
  return [STEP_TYPES[step.type].label, artist].filter(Boolean).join(', ');
}

export function newStep(type, config = {}) {
  return { id: uid(), type, config };
}

function StepForm({ draft, setDraft }) {
  const scoreList = useStore(scores.store);
  const patternList = useStore(patterns.store);
  const c = draft.config;
  const set = (patch) => setDraft({ ...draft, config: { ...c, ...patch } });
  const type = draft.type;
  const usesTimer = TIMED.includes(type);
  return html`<div class="stack">
    ${type === 'chord' && html`<${ChordInput} value=${c.chord?.name} onChange=${(name) => set({ chord: { name, voicing: 0 } })}/>`}
    ${type === 'change' && html`<div class="row wrap">
      <${ChordInput} id="fa" label="Erster Akkord" value=${c.a?.name} onChange=${(name) => set({ a: { name, voicing: 0 } })}/>
      <${ChordInput} id="fb" label="Zweiter Akkord" value=${c.b?.name} onChange=${(name) => set({ b: { name, voicing: 0 } })}/>
    </div>`}
    ${type === 'strum' && html`<${Field} label="Muster">
      <select value=${c.patternId || ''} onChange=${(e) => set({ patternId: e.currentTarget.value })}>
        ${patternList.map((p) => html`<option value=${p.id}>${p.name}</option>`)}
      </select>
    <//>`}
    ${(type === 'riff' || type === 'song') && html`<${Field} label=${STEP_TYPES[type].label}>
      <select value=${c.scoreId || ''} onChange=${(e) => set({ scoreId: e.currentTarget.value })}>
        <option value="" disabled>Bitte wählen</option>
        ${scoreList.filter((s) => s.kind === type).map((s) => html`<option value=${s.id}>${s.title}</option>`)}
      </select>
    <//>`}
    ${(type === 'timer' || type === 'metronome') && html`<${Field} label="Name des Schritts">
      <input type="text" value=${c.label || ''} onInput=${(e) => set({ label: e.currentTarget.value })} placeholder=${type === 'timer' ? 'zum Beispiel Freies Üben' : 'zum Beispiel Tonleiter langsam'}/>
    <//>`}
    ${type === 'metronome' && html`<div class="row wrap">
      <${Field} label="Tempo in BPM"><${Stepper} label="Tempo" value=${c.bpm ?? 80} min=${20} max=${320} step=${5} onChange=${(v) => set({ bpm: v })}/><//>
      <${Field} label="Schläge pro Takt"><${Stepper} label="Schläge pro Takt" value=${c.beatsPerBar ?? 4} min=${2} max=${7} onChange=${(v) => set({ beatsPerBar: v })}/><//>
    </div>`}
    ${type === 'record' && html`<${Field} label="Titel der Aufnahme">
      <input type="text" value=${c.label || ''} onInput=${(e) => set({ label: e.currentTarget.value })} placeholder="Aufnahme"/>
    <//>`}
    ${usesTimer && html`<${Field} label="Dauer in Sekunden" hint="Startet immer mit dem Countdown zum Finger-Positionieren.">
      <${Stepper} label="Dauer" value=${c.seconds ?? settings.get().timerSeconds} min=${5} max=${3600} step=${5} onChange=${(v) => set({ seconds: v })}/>
    <//>`}
  </div>`;
}

const canSave = (d) => {
  const c = d.config;
  if (d.type === 'chord') return Boolean(c.chord?.name);
  if (d.type === 'change') return Boolean(c.a?.name && c.b?.name);
  if (d.type === 'riff' || d.type === 'song') return Boolean(c.scoreId);
  return true;
};

function StepDialog({ initial, onSave, onClose }) {
  const [draft, setDraft] = useState(initial);
  const creating = !initial.type;
  const choose = (type) => {
    const base = { seconds: settings.get().timerSeconds };
    const config = type === 'strum' ? { ...base, patternId: settings.get().lastPatternId, bpm: 80 }
      : type === 'metronome' ? { bpm: 80, beatsPerBar: 4 }
        : ['riff', 'song', 'record'].includes(type) ? {} : base;
    setDraft({ ...draft, type, config });
  };
  return html`<${Modal} title=${creating ? 'Schritt hinzufügen' : 'Schritt ändern'} onClose=${onClose}>
    ${!draft.type
      ? html`<div class="type-grid">
          ${Object.entries(STEP_TYPES).map(([type, t]) => html`<button type="button" class="type-tile" onClick=${() => choose(type)}>
            <${Icon} name=${ICONS[type]} size=${28}/><span>${t.label}</span>
          </button>`)}
        </div>`
      : html`<${StepForm} draft=${draft} setDraft=${setDraft}/>
        <div class="row end">
          <${Button} onClick=${onClose}>Abbrechen<//>
          <${Button} variant="primary" disabled=${!canSave(draft)} onClick=${() => onSave(draft)}>${creating ? 'Hinzufügen' : 'Speichern'}<//>
        </div>`}
  <//>`;
}

export function AddToPlanDialog({ step, onClose }) {
  const list = useStore(plans.store);
  const [planId, setPlanId] = useState(settings.get().lastPlanId || list[0]?.id);
  const save = async () => {
    const plan = plans.find(planId);
    await plans.put({ ...plan, steps: [...plan.steps, { ...step, id: uid() }] });
    toast(`Zu „${plan.name}“ hinzugefügt`);
    onClose();
  };
  return html`<${Modal} title="Zum Plan hinzufügen" onClose=${onClose}>
    <${Field} label="Plan">
      <select value=${planId} onChange=${(e) => setPlanId(e.currentTarget.value)}>
        ${list.map((p) => html`<option value=${p.id}>${p.name}</option>`)}
      </select>
    <//>
    <div class="row end">
      <${Button} onClick=${onClose}>Abbrechen<//>
      <${Button} variant="primary" onClick=${save}>Hinzufügen<//>
    </div>
  <//>`;
}

export function PracticePage() {
  const list = useStore(plans.store);
  const lastId = useStore(settings, (s) => s.lastPlanId);
  const plan = list.find((p) => p.id === lastId) || list[0];
  const [dialog, setDialog] = useState(null);
  const [naming, setNaming] = useState(null);

  async function createPlan(name) {
    const made = await plans.put({ id: uid(), name, steps: [] });
    updateSettings({ lastPlanId: made.id });
    setNaming(null);
  }

  const saveSteps = (steps) => plans.put({ ...plan, steps });
  const move = (i, d) => {
    const steps = [...plan.steps];
    const [s] = steps.splice(i, 1);
    steps.splice(i + d, 0, s);
    saveSteps(steps);
  };

  async function removePlan() {
    const ok = await confirmDialog({ title: 'Plan löschen', text: `„${plan.name}“ wird gelöscht. Deine Akkorde, Riffs, Songs und Aufnahmen bleiben erhalten.` });
    if (!ok) return;
    await plans.remove(plan.id);
    updateSettings({ lastPlanId: plans.all()[0]?.id || null });
  }

  if (!plan) {
    return html`<div class="page">
      <${PageHead} title="Üben"/>
      <${Empty} title="Lege deinen ersten Übungsplan an">
        <p>Ein Plan ist eine Reihe von Schritten, die du nacheinander abarbeitest.</p>
        <${Button} variant="primary" icon="plus" onClick=${() => setNaming({ name: '' })}>Neuer Plan<//>
      <//>
      ${naming && html`<${PlanNameDialog} naming=${naming} setNaming=${setNaming} onSave=${createPlan}/>`}
    </div>`;
  }

  const total = plan.steps.reduce((n, s) => n + (TIMED.includes(s.type) ? (s.config.seconds ?? settings.get().timerSeconds) : 0), 0);

  return html`<div class="page">
    <${PageHead} title=${plan.name}>
      ${list.length > 1 && html`<select class="plan-select" aria-label="Plan wählen" value=${plan.id} onChange=${(e) => updateSettings({ lastPlanId: e.currentTarget.value })}>
        ${list.map((p) => html`<option value=${p.id}>${p.name}</option>`)}
      </select>`}
      <${Button} onClick=${() => setNaming({ name: plan.name, rename: true })}>Umbenennen<//>
      <${Button} icon="plus" onClick=${() => setNaming({ name: '' })}>Neuer Plan<//>
      <${Button} icon="trash" aria-label="Plan löschen" onClick=${removePlan}/>
    <//>

    ${plan.steps.length > 0 && html`
      <${Fretboard} tall steps=${plan.steps} onPick=${(i) => go(`plan/${plan.id}/${i}`)}/>
      <div class="row start-row">
        <${Button} variant="primary" size="lg" icon="play" onClick=${() => go(`plan/${plan.id}/0`)}>Plan starten<//>
        ${total > 0 && html`<span class="muted">${plan.steps.length} Schritte, davon ${fmtTime(total)} mit Timer</span>`}
      </div>`}

    <ol class="step-list">
      ${plan.steps.map((s, i) => html`<li key=${s.id}>
        <span class="step-index">${i + 1}</span>
        <a class="step-title" href=${`#/plan/${plan.id}/${i}`}>
          <strong>${stepTitle(s)}</strong>
          <small>${STEP_TYPES[s.type].label}${s.config.seconds ? `, ${fmtTime(s.config.seconds)}` : ''}</small>
        </a>
        <div class="row step-actions">
          <${Button} icon="up" aria-label="Nach oben" disabled=${i === 0} onClick=${() => move(i, -1)}/>
          <${Button} icon="down" aria-label="Nach unten" disabled=${i === plan.steps.length - 1} onClick=${() => move(i, 1)}/>
          <${Button} icon="edit" aria-label="Schritt ändern" onClick=${() => setDialog({ edit: i, initial: s })}/>
          <${Button} icon="trash" aria-label="Schritt entfernen" onClick=${() => saveSteps(plan.steps.filter((x) => x.id !== s.id))}/>
        </div>
      </li>`)}
    </ol>
    ${!plan.steps.length && html`<p class="muted">Dieser Plan ist noch leer.</p>`}
    <${Button} icon="plus" onClick=${() => setDialog({ initial: { id: uid(), type: null, config: {} } })}>Schritt hinzufügen<//>

    ${dialog && html`<${StepDialog} initial=${dialog.initial} onClose=${() => setDialog(null)} onSave=${(draft) => {
      const steps = dialog.edit !== undefined ? plan.steps.map((s, i) => (i === dialog.edit ? draft : s)) : [...plan.steps, draft];
      saveSteps(steps);
      setDialog(null);
    }}/>`}
    ${naming && html`<${PlanNameDialog} naming=${naming} setNaming=${setNaming} onSave=${(name) => {
      if (naming.rename) { plans.put({ ...plan, name }); setNaming(null); } else createPlan(name);
    }}/>`}
  </div>`;
}

function PlanNameDialog({ naming, setNaming, onSave }) {
  return html`<${Modal} title=${naming.rename ? 'Plan umbenennen' : 'Neuer Plan'} onClose=${() => setNaming(null)}>
    <${Field} label="Name">
      <input type="text" value=${naming.name} onInput=${(e) => setNaming({ ...naming, name: e.currentTarget.value })}/>
    <//>
    <div class="row end">
      <${Button} onClick=${() => setNaming(null)}>Abbrechen<//>
      <${Button} variant="primary" disabled=${!naming.name.trim()} onClick=${() => onSave(naming.name.trim())}>Speichern<//>
    </div>
  <//>`;
}

export function RunPage({ planId, index, setDockSlot }) {
  const plan = useStore(plans.store, (l) => l.find((p) => p.id === planId));
  const i = Number(index) || 0;
  useEffect(() => { clearTakes(); }, [planId, i]);
  useEffect(() => {
    if (plan) updateSettings({ lastPlanId: planId });
  }, [planId]);

  const count = plan?.steps.length || 0;
  const goTo = (n) => {
    if (n >= count) go('fertig');
    else if (n >= 0) go(`plan/${planId}/${n}`);
  };

  const dock = html`<div class="row step-nav">
    <${Button} icon="prev" disabled=${i === 0} onClick=${() => goTo(i - 1)}>Zurück<//>
    <${Button} variant="primary" onClick=${() => goTo(i + 1)}>${i + 1 >= count ? 'Abschließen' : 'Nächster Schritt'}<//>
  </div>`;
  useEffect(() => {
    setDockSlot(dock);
    return () => setDockSlot(null);
  }, [i, count]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.closest?.('dialog')) return;
      if (e.key === 'n' || e.key === 'PageDown') { e.preventDefault(); goTo(i + 1); }
      if (e.key === 'p' || e.key === 'PageUp') { e.preventDefault(); goTo(i - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, count]);

  if (!plan) return html`<div class="page"><${Empty} title="Diesen Plan gibt es nicht mehr"><${Button} onClick=${() => go('')}>Zu den Plänen<//><//></div>`;
  const step = plan.steps[i];
  if (!step) return html`<div class="page"><${Empty} title="Dieser Schritt existiert nicht mehr"><${Button} onClick=${() => go('')}>Zurück zum Plan<//><//></div>`;

  const onConfig = (patch) => {
    const fresh = plans.find(planId);
    plans.put({
      ...fresh,
      steps: fresh.steps.map((s) => (s.id === step.id ? { ...s, config: { ...s.config, ...patch } } : s)),
    });
  };
  const Host = HOSTS[step.type];
  return html`<div class="page page-run">
    <${Fretboard} steps=${plan.steps} current=${i} onPick=${goTo}/>
    <header class="run-head">
      <span class="run-index">Schritt ${i + 1} von ${count}, ${runLabel(step)}</span>
      ${step.type !== 'chord' && html`<h1>${stepTitle(step)}</h1>`}
    </header>
    ${step.config.hint && html`<p class="step-hint">${step.config.hint}</p>`}
    <${Host} key=${step.id} step=${step} onConfig=${onConfig}/>
  </div>`;
}

const QUICK_DEFAULTS = {
  chord: { chord: { name: 'Am', voicing: 0 } },
  change: { a: { name: 'Am', voicing: 0 }, b: { name: 'C', voicing: 0 } },
  strum: {},
  riff: {},
  song: {},
  record: {},
  timer: {},
  metronome: {},
};

export function QuickPage({ type }) {
  const route = useRoute();
  const quick = useStore(settings, (s) => s.quick[type]);
  const [dialog, setDialog] = useState(false);
  const q = route.query;
  const initial = useRef(false);
  if (!initial.current) {
    initial.current = true;
    const patch = {};
    if (q.chord) patch.chord = { name: normalizeChordName(q.chord), voicing: Number(q.v) || 0 };
    if (q.a) patch.a = { name: normalizeChordName(q.a), voicing: 0 };
    if (q.b) patch.b = { name: normalizeChordName(q.b), voicing: 0 };
    if (q.score) patch.scoreId = q.score;
    if (Object.keys(patch).length) queueMicrotask(() => updateSettings({ quick: { [type]: { ...(quick || {}), ...patch } } }));
  }
  const config = { ...QUICK_DEFAULTS[type], ...(quick || {}), ...(q.score ? { scoreId: q.score } : {}), ...(q.chord ? { chord: { name: normalizeChordName(q.chord), voicing: Number(q.v) || 0 } } : {}) };
  useEffect(() => { clearTakes(); return () => clearTakes(); }, []);
  const step = { id: `quick-${type}`, type, config };
  const Host = HOSTS[type];
  const onConfig = (patch) => {
    if (patch.chord && getRoute().query.chord) location.replace(`#/frei/${type}`);
    updateSettings({ quick: { [type]: { ...config, ...patch } } });
  };
  return html`<div class="page page-run">
    <header class="run-head between">
      <div>
        <span class="run-index">${runLabel(step)}</span>
        ${type !== 'chord' && html`<h1>${stepTitle(step)}</h1>`}
      </div>
      <${Button} size="sm" icon="plus" onClick=${() => setDialog(true)}>Zum Plan<//>
    </header>
    <${Host} key=${`${type}-${config.scoreId || ''}`} step=${step} onConfig=${onConfig}/>
    ${dialog && html`<${AddToPlanDialog} step=${step} onClose=${() => setDialog(false)}/>`}
  </div>`;
}

export function DonePage() {
  useEffect(() => { clearTakes(); setHotkeys({}); }, []);
  return html`<div class="page done-page">
    <h1>Plan geschafft</h1>
    <p>Gut gemacht. Deine Übungszeit ist unter Fortschritt eingetragen.</p>
    <div class="row">
      <${Button} variant="primary" onClick=${() => go('')}>Zurück zum Plan<//>
      <${Button} onClick=${() => go('fortschritt')}>Fortschritt ansehen<//>
    </div>
  </div>`;
}
