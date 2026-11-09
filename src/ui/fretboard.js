// Das Griffbrett oben im Plan: jeder Schritt ist ein Bund, Bünde werden nach rechts enger wie auf der Gitarre.
import { html } from '../../vendor/htm-preact.js';
import { stepTitle, STEP_TYPES } from '../lib/state.js';

export function Fretboard({ steps, current = -1, onPick, tall }) {
  const widths = steps.map((_, i) => 2 ** (-i / 12) * (steps.length > 8 ? 0.8 : 1));
  return html`<div class=${`board-wrap ${tall ? 'board-tall' : ''}`}>
    <div class="board" role="list" aria-label="Schritte im Plan">
      <span class="board-nut" aria-hidden="true"></span>
      <div class="board-strings" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map((i) => html`<i style=${`--w:${0.9 + i * 0.36}px`}></i>`)}</div>
      ${steps.map((s, i) => {
        const state = i === current ? 'now' : i < current ? 'done' : 'todo';
        return html`<button type="button" role="listitem" class=${`fret ${state}`} style=${`flex-grow:${widths[i]}`}
          aria-current=${i === current ? 'step' : undefined}
          aria-label=${`Schritt ${i + 1}: ${STEP_TYPES[s.type].label}, ${stepTitle(s)}`}
          onClick=${() => onPick?.(i)}>
          <span class="inlay">${i + 1}</span>
        </button>`;
      })}
    </div>
    <div class="board-labels" aria-hidden="true">
      <span class="board-nut-gap"></span>
      ${steps.map((s, i) => html`<span class=${i === current ? 'now' : ''} style=${`flex-grow:${widths[i]}`}>${stepTitle(s)}</span>`)}
    </div>
  </div>`;
}
