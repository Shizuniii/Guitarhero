// node tests/e2e-chordsearch.cjs: Akkordsuche zeigt den genauen Treffer zuerst, auf der Akkordseite und im Eingabefeld.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}#/akkorde`);
  await p.waitForSelector('.chord-search input');
  const tiles = async (q) => {
    await p.fill('.chord-search input', q);
    await p.waitForTimeout(80);
    return p.$$eval('.chord-tile b', (els) => els.map((e) => e.textContent));
  };
  for (const [q, first] of [['A', ['A', 'Am', 'A7']], ['E', ['E', 'Em', 'E7']], ['D', ['D', 'Dm', 'D7']], ['G', ['G', 'Gm', 'G7']], ['F', ['F', 'Fm', 'F7']], ['C', ['C', 'Cm', 'C7']], ['B', ['B', 'Bm', 'B7']]]) {
    const t = await tiles(q);
    ok(`Suche "${q}" beginnt mit ${first.join(', ')}`, JSON.stringify(t.slice(0, 3)) === JSON.stringify(first), t.slice(0, 6).join(' '));
  }
  const am = await tiles('am');
  ok('Suche "am" beginnt mit Am', am[0] === 'Am' && am[1] === 'Am7', am.slice(0, 5).join(' '));
  const sharp = await tiles('A#');
  ok('A# findet Bb', sharp[0] === 'Bb', sharp.slice(0, 3).join(' '));
  const ab = await tiles('A');
  ok('A-Akkorde vor Ab-Akkorden', ab.findIndex((x) => x.startsWith('Ab')) === -1 || ab.findIndex((x) => x.startsWith('Ab')) > ab.lastIndexOf('Am7'), ab.join(' '));

  // Eingabefeld beim Akkordwechsel
  const input = p.locator('.change-launch .chord-input input').first();
  await input.fill('');
  await input.type('E');
  ok('Vollständiger Akkord: keine Liste, die etwas verdeckt', (await p.locator('.combo-list').count()) === 0);
  await input.press('ArrowDown');
  await p.waitForSelector('.combo-list li');
  const sugg = await p.$$eval('.combo-list li', (els) => els.map((e) => e.textContent));
  ok('Pfeil nach unten zeigt Vorschläge, E zuerst', sugg[0] === 'E' && sugg[1] === 'Em', sugg.join(' '));
  await input.press('ArrowDown');
  await input.press('Enter');
  ok('Pfeiltasten und Enter wählen aus', (await input.inputValue()) === 'Em' && (await p.locator('.combo-list').count()) === 0, await input.inputValue());
  await input.fill('');
  await input.type('Dsu');
  await p.waitForSelector('.combo-list li');
  const dsu = await p.$$eval('.combo-list li', (els) => els.map((e) => e.textContent));
  ok('Unvollständige Eingabe zeigt Vorschläge', dsu[0] === 'Dsus2' && dsu[1] === 'Dsus4', dsu.join(' '));
  await p.click('.combo-list li >> nth=1');
  ok('Klick wählt aus', (await input.inputValue()) === 'Dsus4', await input.inputValue());
  await input.fill('');
  await input.type('Gs');
  await p.waitForSelector('.combo-list li');
  await input.press('Escape');
  ok('Escape schließt die Liste', (await p.locator('.combo-list').count()) === 0);
  await input.fill('');
  await input.type('G');
  ok('Escape schließt die Liste', (await p.locator('.combo-list').count()) === 0);
  await p.click('.change-launch button:has-text("Wechsel üben")');
  await p.waitForFunction(() => location.hash.includes('frei/change'));
  ok('Gewählte Akkorde kommen beim Üben an', /a=G&b=C/.test(decodeURIComponent(await p.evaluate(() => location.hash))), await p.evaluate(() => location.hash));

  // Deutsche Notennamen: B ist Bb, H ist B
  await p.evaluate(() => { location.hash = '#/einstellungen'; });
  await p.waitForTimeout(300);
  const de = p.locator('text=H und B wie in der Schule');
  if (await de.count()) {
    await de.first().click();
    await p.evaluate(() => { location.hash = '#/akkorde'; });
    await p.waitForSelector('.chord-search input');
    const h = await tiles('H');
    ok('Deutsch: H findet H', h[0] === 'H' && h[1] === 'Hm', h.slice(0, 3).join(' '));
    const bb = await tiles('B');
    ok('Deutsch: B findet B (Bb)', bb[0] === 'B' && bb[1] === 'Bm', bb.slice(0, 3).join(' '));
  } else console.log('SKIP deutsche Notennamen: Schalter nicht gefunden');
  console.log(errors.length ? `Browser-Fehler: ${errors.join(' | ')}` : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
