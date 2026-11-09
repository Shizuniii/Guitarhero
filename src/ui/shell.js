import { html, useEffect } from '../../vendor/htm-preact.js';
import { fmtTime, useStore } from '../lib/core.js';
import { metronome, metronomeBridge, toggleMetronome } from '../lib/metronome.js';
import { useRoute } from '../lib/router.js';
import { recStatus } from '../lib/take-control.js';
import { timer, toggleTimer } from '../lib/timer.js';
import { hotkeys, panel, togglePanel, toasts } from '../lib/ui-state.js';
import { Button } from './common.js';
import { Icon } from './icons.js';
import { MetronomeFace } from './metronome-face.js';
import { TimerFace } from './timer-face.js';
import { TunerFace } from './tuner.js';

const NAV = [
  { path: '', match: ['', 'plan', 'frei'], label: 'Üben', icon: 'practice' },
  { path: 'akkorde', match: ['akkorde'], label: 'Akkorde', icon: 'chord' },
  { path: 'strums', match: ['strums'], label: 'Strums', icon: 'strum' },
  { path: 'riffs', match: ['riffs'], label: 'Riffs', icon: 'riff' },
  { path: 'songs', match: ['songs', 'score'], label: 'Songs', icon: 'song' },
  { path: 'aufnahmen', match: ['aufnahmen'], label: 'Aufnahmen', icon: 'recordings' },
  { path: 'fortschritt', match: ['fortschritt'], label: 'Fortschritt', icon: 'progress' },
  { path: 'einstellungen', match: ['einstellungen'], label: 'Einstellungen', icon: 'settings' },
];

export function Rail() {
  const route = useRoute();
  const head = route.parts[0] || '';
  return html`<nav class="rail" aria-label="Hauptmenü">
    <a class="brand" href="#/"><span class="brand-inlay" aria-hidden="true"></span>Guitarhero</a>
    <ul>
      ${NAV.map((n) => html`<li><a href=${`#/${n.path}`} aria-current=${n.match.includes(head) ? 'page' : undefined}>
        <${Icon} name=${n.icon}/><span>${n.label}</span>
      </a></li>`)}
    </ul>
  </nav>`;
}

function Pedal({ name, icon, label, value, lit, rec }) {
  const open = useStore(panel) === name;
  return html`<button type="button" class=${`pedal ${open ? 'open' : ''}`} aria-expanded=${open} onClick=${() => togglePanel(name)}>
    <span class=${`led ${lit ? 'on' : ''} ${rec ? 'rec' : ''}`} aria-hidden="true"></span>
    <${Icon} name=${icon} size=${20}/>
    <span class="pedal-text"><small>${label}</small><b>${value}</b></span>
  </button>`;
}

export function Dock({ slot }) {
  const t = useStore(timer);
  const m = useStore(metronome);
  const bridge = useStore(metronomeBridge);
  const rec = useStore(recStatus);
  const timerValue = t.phase === 'countdown' ? t.count : fmtTime(t.remaining);
  const lit = ['countdown', 'running'].includes(t.phase);
  return html`<footer class="dock">
    <div class="pedals" role="group" aria-label="Werkzeuge">
      <${Pedal} name="timer" icon="timer" label="Timer" value=${timerValue} lit=${lit} rec=${rec.state !== 'off'}/>
      <${Pedal} name="metronome" icon="metronome" label="Metronom" value=${`${bridge ? bridge.bpm : m.bpm} BPM`} lit=${bridge ? bridge.on : m.running}/>
      <${Pedal} name="tuner" icon="tuner" label="Stimmgerät" value="E A D G B e" lit=${false}/>
    </div>
    <div class="dock-slot">${slot}</div>
  </footer>`;
}

export function Panels() {
  const open = useStore(panel);
  if (!open) return null;
  const titles = { timer: 'Timer', metronome: 'Metronom', tuner: 'Stimmgerät' };
  return html`<aside class="drawer" aria-label=${titles[open]}>
    <header class="drawer-head">
      <h2>${titles[open]}</h2>
      <${Button} icon="close" aria-label="Schließen" onClick=${() => panel.set(null)}/>
    </header>
    <div class="drawer-body">
      ${open === 'timer' && html`<${TimerFace}/>`}
      ${open === 'metronome' && html`<${MetronomeFace}/>`}
      ${open === 'tuner' && html`<${TunerFace}/>`}
    </div>
  </aside>`;
}

export function Toasts() {
  const list = useStore(toasts);
  return html`<div class="toasts" role="status" aria-live="polite">
    ${list.map((t) => html`<div class=${`toast ${t.tone}`} key=${t.id}>${t.text}</div>`)}
  </div>`;
}

export function useGlobalKeys() {
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (el?.closest?.('dialog, .tabed-grid')) return;
      // Wer mit der Tastatur auf einem Knopf steht, löst weiter genau diesen aus.
      if ((e.key === ' ' || e.key === 'Enter') && el?.matches?.('button:focus-visible, a:focus-visible')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const map = hotkeys.get();
      const act = map[key] || map[e.key];
      if (act) {
        e.preventDefault();
        act(e);
        return;
      }
      if (key === 'Escape') panel.set(null);
      else if (key === ' ') { e.preventDefault(); toggleTimer(); }
      else if (key === 'm') toggleMetronome();
      else if (key === 't') togglePanel('timer');
      else if (key === 'g') togglePanel('tuner');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
