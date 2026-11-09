import { html, render, useEffect, useState } from '../vendor/htm-preact.js';
import { useStore } from './lib/core.js';
import { loadChords } from './lib/chords.js';
import { loadFolder } from './lib/folder.js';
import { loadMetronomeSettings } from './lib/metronome.js';
import { useRoute } from './lib/router.js';
import { bootState, settings } from './lib/state.js';
import { setTimerDuration } from './lib/timer.js';
import { panel, toast } from './lib/ui-state.js';
import { ChordsPage } from './pages/chords.js';
import { DonePage, PracticePage, QuickPage, RunPage } from './pages/practice.js';
import { ProgressPage } from './pages/progress.js';
import { RecordingsPage } from './pages/recordings.js';
import { ScoreEditPage, ScoreListPage, ScoreTabsPage } from './pages/scores.js';
import { SettingsPage } from './pages/settings.js';
import { QuickStrumPage } from './pages/strums.js';
import { ConfirmHost } from './ui/common.js';
import { Dock, Panels, Rail, Toasts, useGlobalKeys } from './ui/shell.js';

function Page({ setDockSlot, install }) {
  const { parts } = useRoute();
  const [a, b, c] = parts;
  useEffect(() => {
    document.getElementById('main')?.scrollTo(0, 0);
  }, [a, b, c]);
  switch (a) {
    case undefined: return html`<${PracticePage}/>`;
    case 'plan': return html`<${RunPage} key=${`${b}-${c}`} planId=${b} index=${c} setDockSlot=${setDockSlot}/>`;
    case 'frei': return html`<${QuickPage} key=${b} type=${b}/>`;
    case 'fertig': return html`<${DonePage}/>`;
    case 'akkorde': return html`<${ChordsPage}/>`;
    case 'strums': return html`<${QuickStrumPage}/>`;
    case 'riffs': return html`<${ScoreListPage} key="riff" kind="riff"/>`;
    case 'songs': return html`<${ScoreListPage} key="song" kind="song"/>`;
    case 'score': return c === 'tabs' ? html`<${ScoreTabsPage} key=${b} id=${b}/>` : html`<${ScoreEditPage} key=${b} id=${b}/>`;
    case 'aufnahmen': return html`<${RecordingsPage}/>`;
    case 'fortschritt': return html`<${ProgressPage}/>`;
    case 'einstellungen': return html`<${SettingsPage} install=${install}/>`;
    default: return html`<${PracticePage}/>`;
  }
}

function App() {
  const [slot, setSlot] = useState(null);
  const [installEvent, setInstallEvent] = useState(null);
  const theme = useStore(settings, (s) => s.theme);
  const drawerOpen = useStore(panel);
  useGlobalKeys();

  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = installEvent ? () => { installEvent.prompt(); setInstallEvent(null); } : null;

  return html`<div class=${`shell ${drawerOpen ? 'drawer-open' : ''}`}>
    <${Rail}/>
    <main class="main" id="main"><${Page} setDockSlot=${setSlot} install=${install}/></main>
    <${Dock} slot=${slot}/>
    <${Panels}/>
    <${Toasts}/>
    <${ConfirmHost}/>
  </div>`;
}

function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const next = reg.installing;
      next?.addEventListener('statechange', () => {
        if (next.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Neue Version geladen. Sie gilt beim nächsten Öffnen.', 'info', 7000);
        }
      });
    });
  }).catch(() => {});
}

async function boot() {
  try {
    await Promise.all([bootState(), loadChords()]);
    loadMetronomeSettings();
    setTimerDuration(settings.get().timerSeconds);
    await loadFolder();
    render(html`<${App}/>`, document.getElementById('app'));
    registerWorker();
  } catch (err) {
    document.getElementById('app').textContent = `Guitarhero konnte nicht starten: ${err.message}`;
    throw err;
  }
}

boot();
