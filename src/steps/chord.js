import { html } from '../../vendor/htm-preact.js';
import { chordFor } from '../lib/analyze.js';
import { useTimerRecording } from '../lib/take-control.js';
import { ChordCard, ChordInput } from '../ui/chord.js';
import { StringCheck } from '../ui/string-check.js';
import { TimerFace } from '../ui/timer-face.js';
import { TakesList } from '../ui/wave.js';
import { useStepTimer } from './common.js';

export function ChordStep({ step, onConfig }) {
  const c = step.config;
  const chord = c.chord || { name: 'Am', voicing: 0 };
  useStepTimer(c.seconds);
  useTimerRecording(() => {
    const model = chordFor(chord);
    return { type: 'chord', title: chord.name, chord: chord.name, analysis: model ? { kind: 'chord', chord: model, models: { _: model } } : null };
  });
  return html`<div class="step step-chord">
    <div class="step-main">
      <${ChordCard} chord=${chord} size=${300} onVoicing=${(v) => onConfig({ chord: { ...chord, voicing: v } })}/>
      <div class="step-side">
        <${TimerFace}/>
        <${ChordInput} value=${chord.name} label="Anderer Akkord" onChange=${(name) => onConfig({ chord: { name, voicing: 0 } })}/>
      </div>
    </div>
    <${TakesList}/>
    <${StringCheck} chord=${chord}/>
  </div>`;
}
