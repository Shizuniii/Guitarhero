// node tests/e2e-voice.cjs [bildordner]: Timer per Sprache. Die Spracherkennung des Browsers wird simuliert.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const OUT = process.argv[2];
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

const FAKE = () => {
  window.__recs = [];
  class FakeRec {
    constructor() { this.track = null; window.__recs.push(this); }
    start(track) { this.track = track || null; this.running = true; setTimeout(() => this.onstart?.(), 10); }
    stop() { this.running = false; this.onend?.(); }
    abort() { this.running = false; }
  }
  window.SpeechRecognition = FakeRec;
  // Simuliert ein Ergebnis. `final` false heißt Zwischenstand.
  window.__say = (text, { index = 0, final = true, alts = [] } = {}) => {
    const rec = window.__recs.filter((r) => r.running).pop();
    const res = [{ transcript: text }, ...alts.map((t) => ({ transcript: t }))];
    res.isFinal = final;
    const results = [];
    results[index] = res;
    results.length = index + 1;
    rec.onresult({ resultIndex: index, results });
  };
  window.__end = () => window.__recs.filter((r) => r.running).pop().stop();
};

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone'], colorScheme: 'dark' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(FAKE);
  await p.goto(`${BASE}#/frei/chord?chord=C`);
  await p.waitForSelector('.voice-toggle');
  const phase = () => p.evaluate(() => document.querySelector('.timer-face').className);
  ok('Sprachsteuerung ist anfangs aus', /Aus/.test(await p.textContent('.voice-toggle')));
  await p.click('.voice-toggle');
  await p.waitForFunction(() => /hört zu/.test(document.querySelector('.voice-toggle').textContent));
  ok('Eingeschaltet: hört zu', true);
  ok('Hört über das gewählte Mikrofon', await p.evaluate(() => window.__recs.at(-1).track?.kind === 'audio'));
  ok('Deutsch eingestellt', await p.evaluate(() => window.__recs.at(-1).lang === 'de-DE'));

  await p.evaluate(() => window.__say('start', { final: false }));
  await p.waitForTimeout(150);
  ok('„Start“ startet den Timer (Countdown)', /countdown/.test(await phase()), await phase());
  ok('Erkannter Befehl wird angezeigt', /„Start“ erkannt/.test(await p.textContent('.voice-line')));
  // Dasselbe Ergebnis als Endfassung darf nicht nochmal auslösen
  await p.evaluate(() => window.__say('start', { final: true }));
  await p.waitForTimeout(100);
  ok('Endfassung löst nicht doppelt aus', /countdown/.test(await phase()));
  await p.waitForFunction(() => document.querySelector('.timer-face').classList.contains('running'), null, { timeout: 8000 });
  await p.evaluate(() => window.__say('okay stopp', { index: 1 }));
  await p.waitForTimeout(150);
  ok('„Stopp“ hält den Timer an', /paused/.test(await phase()), await phase());
  await p.evaluate(() => window.__say('und weiter', { index: 2 }));
  await p.waitForTimeout(150);
  ok('„Weiter“ läuft weiter', /running/.test(await phase()), await phase());
  await p.evaluate(() => window.__say('shop', { index: 3, alts: ['stop'] }));
  await p.waitForTimeout(150);
  ok('Alternative Erkennung „stop“ zählt', /paused/.test(await phase()), await phase());
  await p.evaluate(() => window.__say('das klingt gut', { index: 4 }));
  await p.waitForTimeout(150);
  ok('Andere Wörter tun nichts', /paused/.test(await phase()));

  // Der Browser beendet die Erkennung nach Stille: sie startet von selbst neu
  const before = await p.evaluate(() => window.__recs.length);
  await p.evaluate(() => window.__end());
  await p.waitForTimeout(600);
  ok('Startet nach Ende von selbst neu', (await p.evaluate(() => window.__recs.length)) === before + 1 && /hört zu/.test(await p.textContent('.voice-toggle')));
  if (OUT) await p.locator('.step-side').screenshot({ path: `${OUT}/voice.png` });

  // Fehler wird verständlich angezeigt
  await p.evaluate(() => window.__recs.at(-1).onerror({ error: 'network' }));
  await p.waitForTimeout(100);
  ok('Fehler wird angezeigt', /Internetverbindung/.test(await p.textContent('.voice-line')));

  // Ausschalten und Einstellung bleibt nach Neuladen erhalten
  await p.click('.voice-toggle');
  ok('Ausschalten', /Aus/.test(await p.textContent('.voice-toggle')));
  await p.click('.voice-toggle');
  await p.waitForTimeout(400); // Speichern abwarten, sonst bricht das Neuladen den Schreibvorgang ab
  await p.reload();
  await p.waitForSelector('.voice-toggle');
  await p.waitForFunction(() => /hört zu/.test(document.querySelector('.voice-toggle').textContent));
  ok('Einstellung bleibt nach dem Neuladen an', true);

  // Ohne Spracherkennung im Browser: Hinweis
  const q = await ctx.newPage();
  await q.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  await q.goto(`${BASE}#/frei/chord?chord=C`);
  await q.waitForSelector('.voice-toggle');
  await q.waitForTimeout(300);
  ok('Ohne Unterstützung: Hinweis auf Chrome oder Edge', /Chrome oder Edge/.test(await q.textContent('.voice-line')), await q.textContent('.voice-line'));

  console.log(errors.length ? `Browser-Fehler: ${errors.join(' | ')}` : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
