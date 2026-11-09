import { html, useState } from '../../vendor/htm-preact.js';
import { fmtTime, useStore } from '../lib/core.js';
import { recStatus } from '../lib/take-control.js';
import { resetTimer, setTimerDuration, timer, toggleTimer } from '../lib/timer.js';
import { Button, Stepper } from './common.js';

const PRESETS = [30, 60, 120, 300];

export function TimerFace({ compact }) {
  const t = useStore(timer);
  const rec = useStore(recStatus);
  const [editing, setEditing] = useState(false);
  const active = ['countdown', 'running', 'paused'].includes(t.phase);
  const label = t.phase === 'running' ? 'Pausieren' : t.phase === 'countdown' ? 'Abbrechen' : t.phase === 'paused' ? 'Weiter' : t.phase === 'finished' ? 'Nochmal' : 'Start';
  const share = t.duration ? 1 - t.remaining / t.duration : 0;
  return html`<section class=${`timer-face ${compact ? 'compact' : ''} ${t.phase}`} aria-label="Timer">
    ${t.phase === 'countdown'
      ? html`<div class="timer-count" aria-live="assertive"><b>${t.count}</b><span>Finger positionieren</span></div>`
      : html`<button type="button" class="timer-digits" title="Dauer ändern" disabled=${active} onClick=${() => setEditing(!editing)}>${fmtTime(t.remaining)}</button>`}
    <div class="timer-line" aria-hidden="true"><i style=${`transform:scaleX(${t.phase === 'countdown' ? 0 : share})`}></i></div>
    ${editing && !active && html`<div class="timer-edit">
      <${Stepper} label="Sekunden" unit="Sek." value=${t.duration} min=${5} max=${3600} step=${5} onChange=${setTimerDuration}/>
      <div class="row wrap">${PRESETS.map((s) => html`<${Button} size="sm" onClick=${() => { setTimerDuration(s); setEditing(false); }}>${fmtTime(s)}<//>`)}</div>
    </div>`}
    <div class="row timer-actions">
      <${Button} variant="primary" size="lg" icon=${t.phase === 'running' ? 'pause' : 'play'} onClick=${toggleTimer}>${label}<//>
      ${(active || t.phase === 'finished') && html`<${Button} size="lg" onClick=${resetTimer}>Zurücksetzen<//>`}
    </div>
    ${rec.state !== 'off' && html`<p class="rec-line" role="status"><span class="rec-dot"></span>${rec.state === 'tail' ? 'Aufnahme läuft noch kurz nach' : 'Aufnahme läuft'}</p>`}
  </section>`;
}
