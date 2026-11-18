import { html, useEffect, useState } from '../../vendor/htm-preact.js';
import { fmtTime, useStore } from '../lib/core.js';
import { settings, updateSettings } from '../lib/state.js';
import { recStatus } from '../lib/take-control.js';
import { resetTimer, setTimerDuration, timer, toggleTimer } from '../lib/timer.js';
import { holdVoice, retryVoice, voice } from '../lib/voice.js';
import { Button, Stepper } from './common.js';
import { Icon } from './icons.js';

// Schalter und Anzeige der Sprachsteuerung unter dem Timer
function VoiceSwitch() {
  const on = useStore(settings, (s) => s.voiceCommands);
  const v = useStore(voice);
  const [, tick] = useState(0);
  useEffect(() => (on ? holdVoice() : undefined), [on]);
  // Erkannten Befehl kurz anzeigen
  const fresh = v.heard && Date.now() - v.heardAt < 2500;
  useEffect(() => {
    if (!fresh) return undefined;
    const id = setTimeout(() => tick((n) => n + 1), 2600);
    return () => clearTimeout(id);
  }, [v.heardAt]);
  const state = !on ? 'Aus' : v.status === 'listening' ? 'hört zu' : v.status === 'starting' ? 'startet …' : 'geht nicht';
  return html`<div class=${`voice-line ${on ? `v-${v.status}` : 'v-off'}`}>
    <button type="button" class="voice-toggle" aria-pressed=${on} onClick=${() => updateSettings({ voiceCommands: !on })}
      title="Timer mit „Start“ und „Stopp“ steuern">
      <${Icon} name="mic" size=${18}/><span>Sprachsteuerung: <b>${state}</b></span>
    </button>
    ${on && fresh && html`<span class="voice-heard" role="status">„${v.heard}“ erkannt</span>`}
    ${on && !fresh && v.status === 'listening' && html`<span class="voice-hint">Sag „Start“ oder „Stopp“</span>`}
    ${on && (v.status === 'error' || v.status === 'unsupported') && html`<p class="voice-error">${v.message}
      ${v.status === 'error' && html` <button type="button" class="link-btn" onClick=${retryVoice}>Nochmal versuchen</button>`}</p>`}
  </div>`;
}

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
    <${VoiceSwitch}/>
    ${rec.state !== 'off' && html`<p class="rec-line" role="status"><span class="rec-dot"></span>${rec.state === 'tail' ? 'Aufnahme läuft noch kurz nach' : 'Aufnahme läuft'}</p>`}
  </section>`;
}
