// Sprachsteuerung für den Timer: "Start" und "Stopp" ins Mikrofon sagen, ohne die Gitarre loszulassen.
// Nutzt die Spracherkennung des Browsers (Chrome, Edge). Sie hört über das in Guitarhero gewählte
// Mikrofon, sofern der Browser das erlaubt, sonst über das Standard-Mikrofon von Windows.
import { createStore } from './core.js';
import { acquireMic, releaseMic } from './mic.js';
import { pauseTimer, resetTimer, startTimer, timer } from './timer.js';

export const voice = createStore({ status: 'off', message: '', heard: '', heardAt: 0 });
// status: off | starting | listening | error | unsupported

const START = new Set(['start', 'starte', 'starten', 'startet', 'los', 'weiter']);
const STOP = new Set(['stopp', 'stop', 'stoppe', 'stoppen', 'stops', 'pause', 'halt', 'anhalten']);
const COOLDOWN_MS = 1200;

const Recognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const voiceSupported = () => typeof Recognition() === 'function';

// Letztes Befehlswort in einem erkannten Text, oder null
export function commandIn(text) {
  const words = String(text).toLowerCase().replace(/[^a-zäöüß ]+/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i -= 1) {
    if (START.has(words[i])) return 'start';
    if (STOP.has(words[i])) return 'stop';
  }
  return null;
}

export function runCommand(cmd) {
  const { phase } = timer.get();
  if (cmd === 'start') {
    if (phase === 'finished') timer.patch({ phase: 'idle', remaining: timer.get().duration });
    if (phase !== 'running' && phase !== 'countdown') startTimer();
  } else if (cmd === 'stop') {
    if (phase === 'running') pauseTimer();
    else if (phase === 'countdown') resetTimer();
  }
}

let users = 0;
let rec = null;
let track = null;
let holdingMic = false;
let restartTimer = 0;
let fired = new Map(); // Ergebnis-Nummer -> schon ausgelöster Befehl
let lastCmd = { cmd: null, at: 0 };
let session = 0;

function onResult(e, mySession) {
  if (mySession !== session) return;
  for (let i = e.resultIndex; i < e.results.length; i += 1) {
    const res = e.results[i];
    // Alle Varianten ansehen: "Stopp" wird manchmal als "Stop" oder "Shop" verstanden
    let cmd = null;
    for (let a = 0; a < res.length && !cmd; a += 1) cmd = commandIn(res[a].transcript);
    if (!cmd || fired.get(i) === cmd) continue;
    fired.set(i, cmd);
    const now = performance.now();
    if (lastCmd.cmd === cmd && now - lastCmd.at < COOLDOWN_MS) continue;
    lastCmd = { cmd, at: now };
    voice.patch({ heard: cmd === 'start' ? 'Start' : 'Stopp', heardAt: Date.now() });
    runCommand(cmd);
  }
}

const ERRORS = {
  'not-allowed': 'Der Browser hat die Spracherkennung blockiert. Erlaube das Mikrofon über das Schloss-Symbol in der Adressleiste.',
  'service-not-allowed': 'Die Spracherkennung ist in diesem Browser abgeschaltet. Nutze Chrome oder Edge.',
  'audio-capture': 'Die Spracherkennung bekommt keinen Ton vom Mikrofon.',
  network: 'Die Spracherkennung braucht eine Internetverbindung.',
  'language-not-supported': 'Deutsch wird von der Spracherkennung dieses Browsers nicht unterstützt.',
};

async function begin() {
  const Rec = Recognition();
  if (!Rec) {
    voice.patch({ status: 'unsupported', message: 'Dieser Browser kann keine Sprache erkennen. In Chrome oder Edge geht es.' });
    return;
  }
  session += 1;
  const mine = session;
  voice.patch({ status: 'starting', message: '' });
  // Dasselbe Mikrofon wie die Aufnahme. Ein eigener Abzweig, damit Stoppen der Erkennung die Aufnahme nicht beendet.
  if (!track) {
    try {
      const stream = await acquireMic();
      holdingMic = true;
      track = stream.getAudioTracks()[0]?.clone() || null;
    } catch {
      track = null;
    }
  }
  if (mine !== session || users === 0) return;
  rec = new Rec();
  rec.lang = 'de-DE';
  rec.continuous = true;
  rec.interimResults = true; // reagiert schon, bevor der Satz zu Ende erkannt ist
  rec.maxAlternatives = 3;
  fired = new Map();
  rec.onresult = (e) => onResult(e, mine);
  rec.onstart = () => mine === session && voice.patch({ status: 'listening', message: '' });
  rec.onerror = (e) => {
    if (mine !== session || e.error === 'no-speech' || e.error === 'aborted') return;
    voice.patch({ status: 'error', message: ERRORS[e.error] || `Die Spracherkennung meldet einen Fehler (${e.error}).` });
  };
  // Der Browser beendet die Erkennung nach einer Weile Stille. Solange sie gewünscht ist, neu starten.
  rec.onend = () => {
    if (mine !== session || users === 0 || voice.get().status === 'error') return;
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => mine === session && users > 0 && begin(), 250);
  };
  try {
    if (track && track.readyState === 'live') rec.start(track);
    else rec.start();
  } catch {
    // Ältere Browser kennen start(track) nicht
    try { rec.start(); } catch (err) {
      voice.patch({ status: 'error', message: `Die Spracherkennung startet nicht: ${err.message}` });
    }
  }
}

function end() {
  session += 1;
  clearTimeout(restartTimer);
  try { rec?.abort(); } catch { /* schon beendet */ }
  rec = null;
  track?.stop();
  track = null;
  if (holdingMic) releaseMic();
  holdingMic = false;
  voice.patch({ status: 'off', message: '' });
}

// Solange ein Timer zu sehen ist und die Sprachsteuerung an ist, wird zugehört.
export function holdVoice() {
  users += 1;
  if (users === 1) begin();
  return () => {
    users = Math.max(0, users - 1);
    if (users === 0) end();
  };
}

// Nach einem Fehler erneut versuchen
export function retryVoice() {
  if (users === 0) return;
  end();
  begin();
}
