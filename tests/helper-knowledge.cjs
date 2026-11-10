// node tests/helper-knowledge.cjs [bildordner]: Tab-Leser mit simuliertem Claude. Prüft Zusatzinfos im Prompt,
// den Abschnitt "Aus Claudes Wissen", die Stimmung und die Formatversion.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

const ANSWER = {
  title: 'Seven Nation Army', artist: 'The White Stripes', tempo: 124, ts: [4, 4], tuning: 'standard', capo: 0,
  bars: [{ beats: [{ d: 4, dot: true, notes: [{ s: 5, f: 7 }] }, { d: 8, notes: [{ s: 5, f: 7 }] }, { d: 4, t: 3, notes: [{ s: 5, f: 10 }] }, { d: 4, t: 3, notes: [{ s: 5, f: 7 }] }, { d: 4, t: 3, notes: [{ s: 5, f: 5 }] }] }],
  uncertain: [],
  info: ['Tempo 124 BPM: Originaltempo des Songs.', 'Rhythmus aus dem Original, im Bild sind keine Notenhälse.'],
};

async function open(b, answer) {
  const p = await b.newPage({ viewport: { width: 1200, height: 900 }, colorScheme: 'dark' });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const html = fs.readFileSync('helper/tab-leser.html', 'utf8');
  await p.addInitScript((ans) => {
    window.__prompts = [];
    const sample = async () => ({ text: '' });
    sample.limits = async () => ({ images: { maxCount: 8, mediaTypes: ['image/png'] } });
    sample.json = async (prompt) => { window.__prompts.push(prompt); return JSON.parse(ans); };
    window.claude = { use: async () => sample };
  }, JSON.stringify(answer));
  await p.route('**/*', (r) => (r.request().url().startsWith('http://helper') ? r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset=utf8></head><body>${html}</body></html>` }) : r.abort()));
  await p.goto('http://helper.test/');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await p.setInputFiles('#file', { name: 'tab.png', mimeType: 'image/png', buffer: png });
  return p;
}

(async () => {
  const b = await chromium.launch();
  const p = await open(b, ANSWER);
  await p.fill('#extra', 'Seven Nation Army, Hauptriff');
  await p.click('#run');
  await p.waitForSelector('#copyBox:not([hidden])');
  const prompt = (await p.evaluate(() => window.__prompts))[0];
  ok('Zusatzinfos stehen im Prompt', /<hinweise>\nSeven Nation Army, Hauptriff\n<\/hinweise>/.test(prompt));
  ok('Ohne Tempo fragt der Prompt nach dem Originaltempo', /sonst das Originaltempo des Stücks/.test(prompt));
  ok('Abschnitt "Aus Claudes Wissen" erscheint', await p.isVisible('#infoBox'));
  const info = await p.$$eval('#info li', (els) => els.map((e) => e.textContent));
  ok('Wissen wird aufgelistet', info.length === 2 && /124 BPM/.test(info[0]), JSON.stringify(info));
  const out = JSON.parse(await p.inputValue('#json'));
  ok('Standardstimmung bleibt Format 2', out.format === 2 && out.info.length === 2, String(out.format));
  const meta = await p.textContent('#meta');
  ok('Interpret wird angezeigt', /InterpretThe White Stripes/.test(meta), meta);
  if (OUT) await p.screenshot({ path: `${OUT}/helper-knowledge.png`, fullPage: true });

  const p2 = await open(b, { ...ANSWER, tuning: 'dropd', info: [] });
  await p2.click('#run');
  await p2.waitForSelector('#copyBox:not([hidden])');
  const prompt2 = (await p2.evaluate(() => window.__prompts))[0];
  ok('Ohne Zusatzinfos kein Hinweisblock', !/<hinweise>/.test(prompt2));
  ok('Ohne Wissen kein Abschnitt', !(await p2.isVisible('#infoBox')));
  const out2 = JSON.parse(await p2.inputValue('#json'));
  ok('Andere Stimmung braucht Format 3', out2.format === 3);
  const tab = await p2.textContent('#preview');
  ok('Tab-Vorschau zeigt die Stimmung', /^D\|/m.test(tab), tab.split('\n').slice(-1)[0]);

  const p3 = await open(b, { ...ANSWER, tuning: 'eb-irgendwas' });
  await p3.click('#run');
  await p3.waitForSelector('#copyBox:not([hidden])');
  const out3 = JSON.parse(await p3.inputValue('#json'));
  ok('Unbekannte Stimmung wird Standard und gemeldet', out3.tuning === 'standard' && out3.uncertain.some((u) => /eb-irgendwas/.test(u)));
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
