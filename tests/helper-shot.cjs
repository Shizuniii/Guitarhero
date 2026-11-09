const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 }, colorScheme: 'dark' });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const html = fs.readFileSync('helper/tab-leser.html', 'utf8');
  await p.route('**/*', (r) => (r.request().url().startsWith('http://helper') ? r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset=utf8></head><body>${html}</body></html>` }) : r.abort()));
  await p.goto('http://helper.test/');
  await p.waitForTimeout(400);
  console.log(await p.evaluate(() => document.getElementById('preview').textContent));
  await p.screenshot({ path: `${OUT}/helper.png` });
  await b.close();
})();
