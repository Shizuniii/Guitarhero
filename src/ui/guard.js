// Fängt Fehler beim Anzeigen ab, damit nie die ganze App leer bleibt.
import { html, useErrorBoundary } from '../../vendor/htm-preact.js';
import { exportBackup } from '../lib/backup.js';
import { go } from '../lib/router.js';
import { Button } from './common.js';

export function Guard({ where, children }) {
  const [error, reset] = useErrorBoundary((e) => console.error(`[Guitarhero] Fehler (${where}):`, e));
  if (!error) return children;
  const message = `${error?.name || 'Fehler'}: ${error?.message || error}`;
  const where1 = (error?.stack || '').split('\n').find((l) => /\/src\//.test(l))?.trim() || '';
  return html`<section class="crash" role="alert">
    <h2>Hier ist etwas schiefgegangen</h2>
    <p>Deine Daten sind nicht betroffen. Du kannst sie hier sichern und zu einer anderen Seite wechseln.</p>
    <div class="row wrap">
      <${Button} variant="primary" icon="download" onClick=${() => exportBackup({ withRecordings: false })}>Sicherung herunterladen<//>
      <${Button} onClick=${() => { go('einstellungen'); reset(); }}>Zu den Einstellungen<//>
      <${Button} onClick=${reset}>Nochmal versuchen<//>
    </div>
    <p class="small muted">Für die Fehlersuche (${where}): ${message}${where1 ? ` · ${where1}` : ''}</p>
  </section>`;
}
