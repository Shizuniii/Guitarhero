import { html, useEffect } from '../../vendor/htm-preact.js';
import { useStore } from '../lib/core.js';
import { metronome, setMetronome, stopMetronome, toggleMetronome } from '../lib/metronome.js';
import { setHotkeys } from '../lib/ui-state.js';
import { MetronomeFace } from '../ui/metronome-face.js';

export function MetronomeStep({ step, onConfig }) {
  const c = step.config;
  const bpm = useStore(metronome, (m) => m.bpm);
  const beats = useStore(metronome, (m) => m.beatsPerBar);

  // Dieser Schritt hat sein eigenes Tempo. Danach gilt wieder das allgemeine Metronom.
  useEffect(() => {
    const before = metronome.get();
    setMetronome({ bpm: c.bpm || before.bpm, beatsPerBar: c.beatsPerBar || before.beatsPerBar }, { save: false });
    return () => {
      stopMetronome();
      setMetronome({ bpm: before.bpm, beatsPerBar: before.beatsPerBar }, { save: false });
    };
  }, []);

  useEffect(() => {
    if (bpm !== c.bpm || beats !== c.beatsPerBar) onConfig({ bpm, beatsPerBar: beats });
  }, [bpm, beats]);

  useEffect(() => {
    setHotkeys({ ' ': toggleMetronome });
    return () => setHotkeys({});
  });

  return html`<div class="step step-metronome"><${MetronomeFace}/></div>`;
}
