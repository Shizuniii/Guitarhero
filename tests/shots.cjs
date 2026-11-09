const { chromium } = require('playwright');
const OUT = process.argv[2];
const BASE = 'http://127.0.0.1:8123/';
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${OUT}/e-in-tune.wav`] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 860 }, colorScheme: 'dark', permissions: ['microphone'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(BASE);
  await p.waitForSelector('.step-list');
  await p.click('.step-list li:nth-child(5) .step-title');
  await p.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
  await p.waitForTimeout(800);
  await p.click('.pedal:nth-child(1)');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/s-song-timer.png` });
  await p.click('.pedal:nth-child(3)');
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${OUT}/s-tuner.png` });
  await p.click('.pedal:nth-child(2)');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/s-metro.png` });
  await p.click('.pedal:nth-child(2)');

  // Progress with sample data
  await p.evaluate(async () => {
    const days = [1, 3, 4, 6, 8, 9, 10, 12, 13];
    await new Promise((res) => {
      const r = indexedDB.open('griffbrett');
      r.onsuccess = () => {
        const tx = r.result.transaction('sessions', 'readwrite');
        days.forEach((d, i) => tx.objectStore('sessions').put({ id: `s${i}`, type: i % 2 ? 'chord' : 'song', title: 'x', seconds: 200 + i * 170, at: Date.now() - d * 864e5 }));
        tx.oncomplete = res;
      };
    });
  });
  await p.reload();
  await p.evaluate(() => { location.hash = '#/fortschritt'; });
  await p.waitForSelector('.chart');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/s-progress.png` });

  // Light theme
  await p.evaluate(() => { location.hash = '#/einstellungen'; });
  await p.waitForSelector('.settings');
  await p.click('text=Ahorn (hell)');
  await p.evaluate(() => { location.hash = '#/'; });
  await p.waitForSelector('.step-list');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/s-light-home.png` });
  await p.click('.step-list li:nth-child(4) .step-title');
  await p.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/s-light-riff.png` });
  await p.evaluate(() => { location.hash = '#/plan/x'; });

  // Phone
  const phone = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'dark', permissions: ['microphone'] });
  const m = await phone.newPage();
  m.on('pageerror', (e) => console.log('[pageerror m]', e.message));
  await m.goto(BASE);
  await m.waitForSelector('.step-list');
  await m.waitForTimeout(300);
  await m.screenshot({ path: `${OUT}/m-home.png` });
  await m.click('text=Plan starten');
  await m.waitForSelector('.chord-title');
  await m.waitForTimeout(300);
  await m.screenshot({ path: `${OUT}/m-chord.png` });
  const over = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log('horizontal overflow chord', over);
  await m.click('.dock-slot >> text=Nächster Schritt');
  await m.click('.dock-slot >> text=Nächster Schritt');
  await m.waitForSelector('.strum-grid');
  await m.waitForTimeout(300);
  await m.screenshot({ path: `${OUT}/m-strum.png` });
  await m.click('.dock-slot >> text=Nächster Schritt');
  await m.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
  await m.waitForTimeout(800);
  await m.screenshot({ path: `${OUT}/m-riff.png` });
  console.log('horizontal overflow riff', await m.evaluate(() => document.querySelector('.main').scrollWidth > document.querySelector('.main').clientWidth));
  await m.click('.pedal:nth-child(3)');
  await m.waitForTimeout(1200);
  await m.screenshot({ path: `${OUT}/m-tuner.png` });
  await b.close();
})().catch((e) => { console.error(e.message.slice(0, 1200)); process.exit(1); });
