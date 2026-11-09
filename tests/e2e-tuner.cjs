const { chromium } = require('playwright');
const [OUT] = process.argv.slice(2);
const BASE = 'http://127.0.0.1:8123/';
async function run(file, pickString) {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${OUT}/${file}`] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 860 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(BASE);
  await p.waitForSelector('.dock');
  await p.click('.pedal:nth-child(3)');
  await p.waitForSelector('.tuner');
  if (pickString !== undefined) await p.click(`.tuner-strings button:nth-child(${pickString + 1})`);
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await p.waitForTimeout(350);
    seen.push(await p.evaluate(() => `${document.querySelector('.tuner-msg').textContent} | ${document.querySelector('.tuner-cents').textContent} | Saite ${[...document.querySelectorAll('.tuner-strings button')].findIndex((x) => x.classList.contains('on')) + 1} | ok ${document.querySelectorAll('.tuner-strings button.ok').length}`));
  }
  console.log(file, [...new Set(seen)].slice(-6));
  await p.screenshot({ path: `${OUT}/tuner-${file}.png` });
  await b.close();
}
(async () => {
  await run('e-low-flat.wav');
  await run('a-sharp.wav', 1);
  await run('e-in-tune.wav');
})().catch((e) => { console.error(e); process.exit(1); });
