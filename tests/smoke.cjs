// node tests/smoke.cjs <out-dir>: lädt alle Seiten, meldet Fehler, macht Screenshots.
const { chromium } = require('playwright');
const OUT = process.argv[2];
const URL_BASE = 'http://127.0.0.1:8123/';
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 860 }, colorScheme: 'dark', permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 240)}`); });
  p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 3).join('\n')}`));
  await p.goto(URL_BASE);
  await p.waitForSelector('.page', { timeout: 8000 });
  const routes = ['', 'akkorde', 'strums', 'riffs', 'songs', 'aufnahmen', 'fortschritt', 'einstellungen'];
  for (const r of routes) {
    await p.evaluate((x) => { location.hash = `#/${x}`; }, r);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/page-${r || 'home'}.png` });
    console.log('ok', r || 'home', await p.evaluate(() => document.querySelector('h1')?.textContent));
  }
  console.log(errors.length ? errors.join('\n') : 'keine Fehler');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
