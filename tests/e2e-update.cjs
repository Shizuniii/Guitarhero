// node tests/e2e-update.cjs: Updates über den Offline-Speicher (Service Worker) und die Rettung bei kaputtem Start.
// Ein eigener Server verhält sich wie GitHub Pages (max-age=600) und kann eine alte oder kaputte Version liefern.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const PORT = 8131;
const BASE = `http://localhost:${PORT}/Guitarhero/`;
const ok = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };

let mode = 'new';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
function content(p) {
  let body = fs.readFileSync(path.join(ROOT, p));
  if (mode === 'old') {
    // "Alte" Version: andere Service-Worker-Version und eine markierte analysis.js
    if (p === 'sw.js') body = Buffer.from(body.toString().replace(/guitarhero-[0-9a-f]+/, 'guitarhero-alt0000000'));
    if (p === 'src/lib/analysis.js') body = Buffer.concat([body, Buffer.from('\n// ALTE VERSION\n')]);
  }
  if (mode === 'broken' && p === 'src/lib/dsp.js') body = Buffer.from(body.toString().replace('export const BODY', 'const BODY'));
  return body;
}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/^\/Guitarhero\//, ''));
  if (!p || p.endsWith('/')) p += 'index.html';
  try {
    const body = content(p);
    const etag = `"${crypto.createHash('md5').update(body).digest('hex')}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': 'max-age=600' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', ETag: etag });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});

(async () => {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const b = await chromium.launch();
  const cached = (p, f) => p.evaluate(async (file) => {
    const keys = await caches.keys();
    const c = await caches.open(keys.find((k) => k !== 'guitarhero-alt0000000') || keys[0]);
    const r = await c.match(file);
    return { keys, text: r ? await r.text() : null };
  }, f);

  // 1. Update: Die neue Version muss alle Dateien frisch holen, nicht aus dem Browser-Zwischenspeicher
  let ctx = await b.newContext();
  let p = await ctx.newPage();
  mode = 'old';
  await p.goto(BASE);
  await p.waitForSelector('.step-list', { timeout: 15000 });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.waitForSelector('.step-list');
  ok('Alte Version läuft über den Offline-Speicher', (await cached(p, 'src/lib/analysis.js')).text?.includes('ALTE VERSION'));
  mode = 'new';
  await p.reload();
  // Die neue Version installiert sich im Hintergrund und löscht danach die alte
  for (let i = 0; i < 40; i++) {
    const k = await p.evaluate(async () => caches.keys());
    if (k.length === 1 && k[0] !== 'guitarhero-alt0000000') break;
    await p.waitForTimeout(500);
  }
  const after = await cached(p, 'src/lib/analysis.js');
  ok('Nach dem Update: neue Version im Offline-Speicher', !after.keys.includes('guitarhero-alt0000000'), after.keys.join(','));
  ok('Nach dem Update: Dateien frisch, nicht aus dem Browser-Zwischenspeicher', after.text && !after.text.includes('ALTE VERSION'));
  await ctx.close();

  // 2. Rettung: Lassen sich die Programmdateien nicht laden, erscheint ein Knopf statt einer leeren Seite
  ctx = await b.newContext();
  p = await ctx.newPage();
  mode = 'new';
  await p.goto(BASE);
  await p.waitForSelector('.step-list', { timeout: 15000 });
  const steps = await p.$$eval('.step-list li', (e) => e.length);
  ok('Normaler Start ohne Rettung', (await p.locator('#rescue').count()) === 0);
  await p.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.clearBrowserCache');
  mode = 'broken';
  await p.goto(`${BASE}?kaputt`);
  await p.waitForSelector('#rescue', { timeout: 8000 }).catch(() => {});
  ok('Kaputte Programmdateien: Rettung erscheint', (await p.locator('#rescue').count()) === 1, await p.textContent('#rescue-msg').catch(() => ''));
  mode = 'new';
  await p.click('#rescue-go');
  await p.waitForSelector('#rescue-done', { timeout: 20000 }).catch(() => {});
  ok('Knopf: lädt neu und sagt, dass Guitarhero neu geöffnet werden soll', /Schließ Guitarhero/.test(await p.textContent('#rescue').catch(() => '')));
  await p.close();
  const q = await ctx.newPage();
  await q.goto(BASE);
  await q.waitForSelector('.step-list', { timeout: 20000 }).catch(() => {});
  ok('Nach dem Neuöffnen startet die App', (await q.locator('.step-list').count()) === 1);
  ok('Daten bleiben erhalten', (await q.$$eval('.step-list li', (e) => e.length)) === steps);
  await b.close();
  server.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 300)); process.exit(1); });
