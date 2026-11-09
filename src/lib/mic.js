// Mikrofon: Auswahl, gemeinsamer Stream, Pegel.
import { audioCtx, resumeAudio } from './audio.js';
import { createStore } from './core.js';
import { settings, updateSettings } from './state.js';

export const micState = createStore({
  devices: [],
  status: 'idle', // idle | ready | denied | missing | error
  message: '',
});

let stream = null;
let streamDevice = null;
let users = 0;
let analyser = null;
let source = null;

const audioConstraints = (deviceId) => ({
  deviceId: deviceId ? { exact: deviceId } : undefined,
  // Für Musik: keine Sprach-Filter, die Töne wegschneiden würden.
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
});

// Virtuelle Geräte (z. B. SteelSeries Sonar, VB-Cable) filtern oft Rauschen weg und damit auch Gitarrentöne.
export const VIRTUAL_MIC = /sonar|virtual|cable|voicemeeter|broadcast|krisp|nvidia/i;

export function deviceLabel(deviceId) {
  const list = micState.get().devices;
  const d = list.find((x) => x.deviceId === (deviceId || 'default')) || list.find((x) => x.deviceId === 'default');
  return d?.label || '';
}

// Ohne eigene Wahl wird ein Fifine-Mikrofon bevorzugt, sonst bleibt das Standard-Mikrofon.
function autoPick(devices) {
  if (settings.get().micDeviceId) return null;
  const fifine = devices.find((d) => /fifine/i.test(d.label) && d.deviceId !== 'default' && d.deviceId !== 'communications');
  if (!fifine) return null;
  updateSettings({ micDeviceId: fifine.deviceId });
  return fifine.deviceId;
}

export async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  const devices = all.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'communications');
  micState.patch({ devices });
  return devices;
}

export async function acquireMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    micState.patch({ status: 'error', message: 'Dieser Browser erlaubt hier keinen Mikrofonzugriff. Öffne die App über https in Chrome oder Edge.' });
    throw new Error('no-media-devices');
  }
  const wanted = settings.get().micDeviceId;
  if (stream && streamDevice === wanted && stream.getAudioTracks().some((t) => t.readyState === 'live')) {
    users += 1;
    return stream;
  }
  closeStream();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(wanted) });
  } catch (err) {
    if (err.name === 'OverconstrainedError' || err.name === 'NotFoundError') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints('') });
      } catch (second) {
        return failMic(second);
      }
    } else {
      return failMic(err);
    }
  }
  streamDevice = wanted;
  micState.patch({ status: 'ready', message: '' });
  const picked = autoPick(await refreshDevices());
  if (picked) {
    try {
      const better = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(picked) });
      closeStream();
      stream = better;
      streamDevice = picked;
    } catch {
      // Bleibt beim bisherigen Mikrofon.
    }
  }
  users += 1;
  return stream;
}

function failMic(err) {
  if (err.name === 'NotAllowedError') {
    micState.patch({ status: 'denied', message: 'Der Mikrofonzugriff ist gesperrt. Erlaube ihn über das Schloss-Symbol in der Adressleiste und lade die Seite neu.' });
  } else if (err.name === 'NotFoundError') {
    micState.patch({ status: 'missing', message: 'Kein Mikrofon gefunden. Schließe eins an und wähle es in den Einstellungen aus.' });
  } else {
    micState.patch({ status: 'error', message: `Das Mikrofon lässt sich nicht öffnen: ${err.message}` });
  }
  throw err;
}

function closeStream() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  streamDevice = null;
  source?.disconnect();
  source = null;
  analyser = null;
}

export function releaseMic() {
  users = Math.max(0, users - 1);
  if (users === 0) closeStream();
}

export async function selectMic(deviceId) {
  updateSettings({ micDeviceId: deviceId });
  if (stream) {
    const keep = users;
    closeStream();
    users = 0;
    await acquireMic();
    users = keep;
  }
}

export async function micAnalyser() {
  const c = await resumeAudio();
  const s = stream;
  if (!s) throw new Error('mic-not-open');
  if (analyser && source) return analyser;
  source = c.createMediaStreamSource(s);
  analyser = c.createAnalyser();
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  return analyser;
}

export function currentStream() {
  return stream;
}

export function micSampleRate() {
  return audioCtx().sampleRate;
}

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => refreshDevices());
}
