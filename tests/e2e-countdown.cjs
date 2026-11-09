// node tests/e2e-countdown.cjs: Endet der Countdown genau auf Schlag 1?
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

// Zeichnet je Bildschirm-Frame auf: Zeit, Countdown-Zahl, läuft der Timer, leuchtendes Strum-Feld, leuchtender Metronom-Punkt.
const capture = (ms) => new Promise((res) => {
  const out = [];
  const t0 = performance.now();
  document.querySelector('.timer-actions .btn-primary').click();
  const f = () => {
    const now = performance.now() - t0;
    const cells = [...document.querySelectorAll('.strum-cell')];
    const dots = [...document.querySelectorAll('.beats i')];
    out.push({
      t: Math.round(now),
      count: document.querySelector('.timer-count b')?.textContent ?? null,
      running: Boolean(document.querySelector('.timer-face.running')),
      hit: cells.findIndex((c) => c.classList.contains('hit')),
      dot: dots.findIndex((c) => c.classList.contains('on')),
    });
    if (now < ms) requestAnimationFrame(f); else res(out);
  };
  f();
});

async function setDuration(p, sec) {
  await p.locator('.timer-digits').first().click();
  await p.fill('input[aria-label="Sekunden"]', String(sec));
  await p.press('input[aria-label="Sekunden"]', 'Tab');
}

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));

  // 1. Strum: Folk-Muster bei 70 BPM
  await p.goto(`${BASE}#/strums`);
  await p.waitForSelector('.strum-grid');
  await setDuration(p, 6);
  const tl = await p.evaluate(capture, 9000);
  const runAt = tl.find((f) => f.running);
  const firstHit = tl.find((f) => f.hit >= 0);
  const counts = [...new Set(tl.filter((f) => f.count).map((f) => f.count))];
  ok('Countdown zeigt höchstens 5', counts.every((c) => Number(c) <= 5), counts.join(' '));
  ok('Countdown dauert mindestens 5 Sekunden', runAt && runAt.t >= 4900, `${runAt?.t} ms`);
  // Ein einzelner Bildschirm-Frame (unter 20 ms) Versatz ist nicht wahrnehmbar.
  ok('Während des Countdowns leuchtet kein Strum-Feld', tl.filter((f) => !f.running && f.count && f.hit !== -1).every((f) => runAt.t - f.t <= 20));
  ok('Einzählen läuft hörbar mit (Metronom-Punkte wandern)', new Set(tl.filter((f) => f.count).map((f) => f.dot)).size >= 3);
  ok('Erstes leuchtendes Feld ist Schlag 1', firstHit && firstHit.hit === 0, `Feld ${firstHit?.hit}`);
  ok('Schlag 1 fällt mit dem Timerstart zusammen', firstHit && runAt && Math.abs(firstHit.t - runAt.t) <= 80, `Abstand ${firstHit && runAt ? firstHit.t - runAt.t : '?'} ms`);
  await p.locator('.timer-actions >> text=Zurücksetzen').click().catch(() => {});

  // 2. Metronom läuft schon, Timer in einem Akkord-Schritt: Countdown endet auf einem Taktanfang
  await p.goto(`${BASE}#/frei/chord?chord=C`);
  await p.waitForSelector('.chord-title');
  await setDuration(p, 6);
  await p.keyboard.press('m');
  await p.click('.pedal:nth-child(2)');
  await p.waitForSelector('.drawer .beats');
  await p.waitForTimeout(1700);
  const tl2 = await p.evaluate(capture, 8000);
  const run2 = tl2.findIndex((f) => f.running);
  const before = tl2[run2 - 1].dot;
  const firstOne = tl2.slice(run2 - 3).find((f) => f.dot === 0);
  ok('Mit laufendem Metronom endet der Countdown auf Schlag 1', run2 > 0 && before === 3 && firstOne && Math.abs(firstOne.t - tl2[run2].t) <= 20, `letzter Schlag davor ${before + 1}, Schlag 1 ${firstOne ? firstOne.t - tl2[run2].t : '?'} ms nach Timerstart`);
  ok('Countdown auch hier mindestens 5 Sekunden', tl2[run2].t >= 4900, `${tl2[run2].t} ms`);

  console.log(errors.length ? `Browser-Fehler: ${errors.join(' | ')}` : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
