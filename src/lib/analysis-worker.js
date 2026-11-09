// Wertet Aufnahmen im Hintergrund aus, damit die Oberfläche flüssig bleibt.
import { analyzeCalibration, analyzeChange, analyzeChord, analyzeScore, analyzeStrumPattern } from './analysis.js';

self.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    const x = job.samples;
    const sr = job.sampleRate;
    let result;
    if (job.kind === 'chord') result = analyzeChord(x, sr, job.chord, job);
    else if (job.kind === 'change') result = analyzeChange(x, sr, job.a, job.b, job);
    else if (job.kind === 'strum') result = analyzeStrumPattern(x, sr, job);
    else if (job.kind === 'score') result = analyzeScore(x, sr, job);
    else if (job.kind === 'calibration') result = analyzeCalibration(x, sr, job);
    else throw new Error(`Unbekannte Auswertung: ${job.kind}`);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
