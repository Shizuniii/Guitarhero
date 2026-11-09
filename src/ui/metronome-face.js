import { html } from '../../vendor/htm-preact.js';
import { useStore } from '../lib/core.js';
import { metronome, metronomeBridge, setMetronome, tapTempo, toggleMetronome } from '../lib/metronome.js';
import { Button, Field, Segmented, Stepper, Toggle } from './common.js';

function Beats({ count, active, running }) {
  return html`<div class="beats" aria-hidden="true">
    ${Array.from({ length: count }, (_, i) => html`<i class=${running && i === active ? 'on' : ''}></i>`)}
  </div>`;
}

export function MetronomeFace({ compact }) {
  const m = useStore(metronome);
  const bridge = useStore(metronomeBridge);
  if (bridge) {
    return html`<section class="metro-face" aria-label="Metronom">
      <p class="muted">Läuft im Takt der Wiedergabe von ${bridge.title}.</p>
      <div class="metro-bpm"><b>${bridge.bpm}</b><span>BPM</span></div>
      <${Stepper} big label="Tempo" unit="BPM" value=${bridge.bpm} min=${10} max=${400} onChange=${bridge.setBpm}/>
      <div class="row metro-actions">
        <${Button} variant="primary" size="lg" onClick=${bridge.toggle}>${bridge.on ? 'Klick ausschalten' : 'Klick einschalten'}<//>
      </div>
    </section>`;
  }
  return html`<section class=${`metro-face ${compact ? 'compact' : ''}`} aria-label="Metronom">
    <div class="metro-bpm"><b>${m.bpm}</b><span>BPM</span></div>
    <${Beats} count=${m.beatsPerBar} active=${m.pos.beat} running=${m.running}/>
    <div class="row metro-adjust">
      <${Button} onClick=${() => setMetronome({ bpm: m.bpm - 5 })} aria-label="5 BPM langsamer">−5<//>
      <${Button} onClick=${() => setMetronome({ bpm: m.bpm - 1 })} aria-label="1 BPM langsamer">−1<//>
      <input class="metro-slider" type="range" min="30" max="240" value=${m.bpm} aria-label="Tempo" onInput=${(e) => setMetronome({ bpm: Number(e.currentTarget.value) })}/>
      <${Button} onClick=${() => setMetronome({ bpm: m.bpm + 1 })} aria-label="1 BPM schneller">+1<//>
      <${Button} onClick=${() => setMetronome({ bpm: m.bpm + 5 })} aria-label="5 BPM schneller">+5<//>
    </div>
    <div class="row metro-actions">
      <${Button} variant="primary" size="lg" icon=${m.running ? 'stop' : 'play'} onClick=${toggleMetronome}>${m.running ? 'Stoppen' : 'Start'}<//>
      <${Button} size="lg" onClick=${tapTempo}>Tippen<//>
    </div>
    ${!compact && html`<div class="metro-options">
      <${Field} label="Schläge pro Takt">
        <${Segmented} label="Schläge pro Takt" value=${m.beatsPerBar} onChange=${(v) => setMetronome({ beatsPerBar: v })}
          options=${[2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}/>
      <//>
      <${Field} label="Klick auf">
        <${Segmented} label="Klick auf" value=${m.clickDiv} onChange=${(v) => setMetronome({ clickDiv: v })}
          options=${[{ value: 1, label: 'Viertel' }, { value: 2, label: 'Achtel' }, { value: 3, label: 'Triolen' }, { value: 4, label: '16tel' }]}/>
      <//>
      <${Field} label="Lautstärke">
        <input type="range" min="0" max="1" step="0.05" value=${m.volume} onInput=${(e) => setMetronome({ volume: Number(e.currentTarget.value) })}/>
      <//>
      <${Toggle} checked=${m.accent} onChange=${(v) => setMetronome({ accent: v })}>Erste Zählzeit betonen<//>
      <${Toggle} checked=${m.silent} onChange=${(v) => setMetronome({ silent: v })}>Nur blinken, ohne Klick<//>
    </div>`}
  </section>`;
}
