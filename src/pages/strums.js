import { html, useEffect, useState } from '../../vendor/htm-preact.js';
import { useStore } from '../lib/core.js';
import { clearTakes } from '../lib/recorder.js';
import { settings, updateSettings } from '../lib/state.js';
import { StrumStep } from '../steps/strum.js';
import { Button, PageHead } from '../ui/common.js';
import { AddToPlanDialog } from './practice.js';

export function QuickStrumPage() {
  const quick = useStore(settings, (s) => s.quick.strum);
  const [dialog, setDialog] = useState(false);
  useEffect(() => { clearTakes(); return () => clearTakes(); }, []);
  const config = { chord: { name: 'Am', voicing: 0 }, ...(quick || {}) };
  const step = { id: 'quick-strum', type: 'strum', config };
  return html`<div class="page page-run">
    <${PageHead} title="Strums">
      <${Button} icon="plus" onClick=${() => setDialog(true)}>Zum Plan<//>
    <//>
    <${StrumStep} step=${step} onConfig=${(patch) => updateSettings({ quick: { strum: { ...config, ...patch } } })}/>
    ${dialog && html`<${AddToPlanDialog} step=${step} onClose=${() => setDialog(false)}/>`}
  </div>`;
}
