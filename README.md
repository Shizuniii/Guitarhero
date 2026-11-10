# Guitarhero

Gitarren-Übungsprogramm als installierbare Web-App. Läuft ohne Build-Schritt auf GitHub Pages.

## Bereitstellen

In den Repository-Einstellungen unter Pages: Deploy from a branch, Branch `main`, Ordner `/ (root)`.

## Ändern

- `src/` Programmcode, `css/` Gestaltung, `data/chords.json` Griffe, `vendor/` Bibliotheken
- Nach jeder Änderung `node tools/build-sw.mjs` ausführen. Das aktualisiert die Offline-Dateiliste in `sw.js`.
- `helper/tab-leser.html` ist die KI-Helfer-Seite in Claude und wird dort veröffentlicht.

## Bewertung

Die Auswertung läuft im Browser (`src/lib/dsp.js`, `src/lib/analysis.js`, im Hintergrund über `analysis-worker.js`).
Sie ist auf eine Konzertgitarre mit Nylonsaiten eingestellt und mit künstlichem Gitarrenklang getestet.
Der Plan „Testaufnahmen“ in der App sammelt echte Aufnahmen mit absichtlichen Fehlern für die Feinabstimmung.

## Tests

Statischen Server auf Port 8123 starten (`python3 -m http.server 8123 --bind 127.0.0.1`), dann:

- `node tests/tabformat.test.mjs`
- `node tests/analysis.test.mjs` (Erkennung mit künstlicher Gitarre)
- `node tests/make-wavs.mjs <ordner>` und `node tests/e2e-analysis.cjs <ordner>`
- `node tests/e2e-countdown.cjs` (Countdown endet auf Schlag 1)
- `node tests/e2e-triplets.cjs` (Triolen vom Tab-Leser bis zur Wiedergabe)
- `node tests/e2e-bars.cjs` (Hinweis bei zu langen Takten, Formatversion des Tab-Lesers)
- `node tests/e2e-knowledge.cjs` (Stimmung, Tempo und Wissen der KI vom Tab-Leser bis in die Wiedergabe)
- `node tests/helper-knowledge.cjs` (Tab-Leser mit simuliertem Claude: Zusatzinfos, Stimmung, Formatversion)
- `node tests/e2e-flow.cjs <ordner-mit-testaudio>`
- `node tests/e2e-tuner.cjs <ordner-mit-testaudio>`

## Soundfont

`vendor/alphatab/soundfont/guitarhero.sf2` enthält die Gitarren (GM-Programme 24–31) aus GeneralUser GS v2.0.3 und alle übrigen Instrumente aus dem Sonivox-Soundfont von alphaTab. Die Gitarren sind auf eine gemeinsame Lautstärke angeglichen. Neu bauen:

```
npm pack @coderline/alphatab@1.9.0   # enthält dist/soundfont/sonivox.sf2
# GeneralUser-GS.sf2 von https://github.com/mrbumpy409/GeneralUser-GS
python3 -I tools/build-soundfont.py <sonivox.sf2> <GeneralUser-GS.sf2> vendor/alphatab/soundfont/guitarhero.sf2
```

## Lizenzen

alphaTab: MPL-2.0. Sonivox-Soundfont und Bravura: siehe Dateien in `vendor/alphatab`. GeneralUser GS: `vendor/alphatab/soundfont/LICENSE-GeneralUser-GS.txt`. chords-db: MIT. Preact und htm: MIT/Apache-2.0. Schriften Big Shoulders und Atkinson Hyperlegible Next: OFL.
