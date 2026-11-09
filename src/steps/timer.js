import { html } from '../../vendor/htm-preact.js';
import { useTimerRecording } from '../lib/take-control.js';
import { Field } from '../ui/common.js';
import { TimerFace } from '../ui/timer-face.js';
import { TakesList } from '../ui/wave.js';
import { useStepTimer } from './common.js';

export function TimerStep({ step, onConfig }) {
  const c = step.config;
  useStepTimer(c.seconds);
  useTimerRecording(() => ({ type: 'timer', title: c.label || 'Freies Üben' }));
  return html`<div class="step step-timer">
    <div class="step-main">
      <${TimerFace}/>
      <div class="step-side">
        <${Field} label="Name dieses Schritts">
          <input type="text" value=${c.label || ''} placeholder="Freies Üben" onChange=${(e) => onConfig({ label: e.currentTarget.value })}/>
        <//>
        ${c.note && html`<p>${c.note}</p>`}
      </div>
    </div>
    <${TakesList}/>
  </div>`;
}
