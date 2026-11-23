// Kursdaten für den Lernplan: JustinGuitar Beginner Grade 1, Module 5 bis 7.
// Titel, Links, Längen, Routinen und Ziele stammen von justinguitar.com (abgerufen im November 2026).
// Was dort nicht steht, steht hier nicht: fehlende Längen bleiben leer, Kurzbeschreibungen gibt es nur,
// wo die Lektionsseite gelesen werden konnte.

const L = (slug) => `https://www.justinguitar.com/guitar-lessons/${slug}`;

export const COURSE = {
  title: 'JustinGuitar Beginner Grade 1',
  url: 'https://www.justinguitar.com/classes/beginner-guitar-course-grade-one',
  // Laut Shy: Module 0 bis 4 fertig, in Modul 5 „The C Chord“ gesehen (Stand 23. November 2026)
  doneBefore: 'Module 0 bis 4',
};

export const GRADE1_CHORDS = ['A', 'D', 'E', 'Am', 'Dm', 'Em', 'C', 'G'];

export const MODULES = [
  {
    n: 5,
    title: 'Basic Theory & Strumming Development',
    de: 'C-Akkord, Strumming, Notennamen',
    url: 'https://www.justinguitar.com/modules/lesson-5-c-chord-nirvana',
    lessons: [
      { id: 'b1-501', title: 'The C Chord', dur: '05:49', url: L('the-c-chord-b1-501'), sum: 'C-Akkord greifen und ein Trick, die tiefe E-Saite zu dämpfen.' },
      { id: 'b1-502', title: 'Guitar Strumming Tips', dur: '16:28', url: L('guitar-strumming-tips-b1-502'), sum: 'Schlagen aus dem Ellbogen, ein Pendel, das nie anhält, acht mögliche Schläge pro Takt.' },
      { id: 'b1-503', title: 'Exploring Strumming', dur: '06:18', url: L('exploring-strumming-b1-503') },
      { id: 'b1-504', title: 'Understanding Music Notes', dur: '06:05', url: L('understanding-music-notes-b1-504'), sum: 'Die zwölf Töne im Notenkreis, Kreuz und b, Halbtöne auf dem Griffbrett.' },
      { id: 'b1-505', title: 'Your Own Songbook', dur: '04:02', url: L('your-own-songbook-b1-505'), sum: 'Ein eigenes Songbuch mit Songs, die du gern und sicher spielst.' },
      { id: 'b1-506', title: 'RIFF Come As You Are', dur: '05:00', url: L('riff-come-as-you-are-b1-506'), sum: 'Nirvana-Riff als Übung für Abschlag, sauberes Greifen und Rhythmus.' },
      { id: 'b1-507', title: 'Songs For Module 5', dur: '02:29', url: L('songs-for-module-5-b1-507'), sum: 'Fünf Songvorschläge mit C. Songs mit G noch auslassen.' },
      { id: 'b1-508', title: 'Module 5 Practice', dur: '06:33', url: L('module-5-practice-b1-508'), sum: 'Justins 20-Minuten-Routine und die Ziele für Modul 5.' },
    ],
    routine: {
      url: L('module-5-practice-b1-508'),
      items: ['2′ Finger Stretch', '1′ C Chord Perfect', '1′ Chord Perfect auf dem Akkord, der schwerfällt', '1′ OMC Am → C', '1′ OMC C → Em', '2′ Strumming (beliebige Muster, Timing)', '2′ Come As You Are', '10′ Song-Arbeit'],
    },
    checks: [
      { id: 'm5-omc', text: 'Rund 30 Akkordwechsel pro Minute', auto: 'm5omc', how: 'Gemessen an den beiden Wechseln aus Justins Routine, Am–C und C–Em: beide mindestens 30 pro Minute.' },
      { id: 'm5-chords', text: 'A, D, E, Am, Dm, Em und C auswendig' },
      { id: 'm5-rhythm', text: 'Sicherer im Rhythmus: Die Schlaghand bleibt ziemlich gleichmäßig in Bewegung, am besten mit Metronom' },
      { id: 'm5-caya', text: 'Come As You Are einmal durchgespielt, nicht perfekt, einfach durch und mit Spaß' },
      { id: 'm5-song', text: 'Mindestens einen Song mit C ordentlich und größtenteils durchspielen' },
    ],
  },
  {
    n: 6,
    title: '6:8 Time, Fast Changes & Alternate Picking',
    de: 'G-Akkord, 6/8-Takt, Wechselschlag, schnellere Wechsel',
    url: 'https://www.justinguitar.com/modules/6-8-time-fast-changes-alternate-picking',
    lessons: [
      { id: 'b1-601', title: 'Beginner Alternate Picking', url: L('beginner-alternate-picking-b1-601'), sum: 'Auf einer Saite gleichmäßig ab und auf anschlagen.' },
      { id: 'b1-602', title: 'The G Chord… hacked!', url: L('the-g-chord-hacked-b1-602'), sum: 'Justins Abkürzung zum G-Akkord.' },
      { id: 'b1-603', title: 'About Time Signatures', url: L('about-time-signatures-b1-603') },
      { id: 'b1-604', title: 'A 6:8 Strumming Pattern', url: L('a-6-8-strumming-pattern-b1-604'), sum: 'Ein Muster im 6/8-Takt mit Betonung auf 1 und 4.' },
      { id: 'b1-605', title: 'Open String Note Names', url: L('open-string-note-names-b1-605') },
      { id: 'b1-606', title: 'Forcing Chord Changes', url: L('forcing-chord-changes-b1-606'), sum: 'Wechsel im Song erzwingen: Akkord auf Schlag 1, die Schlaghand läuft weiter.' },
      { id: 'b1-607', title: 'Songs For Module 6', url: L('songs-for-module-6-b1-607'), sum: 'Songs zum Üben der bisherigen Akkorde und Techniken.' },
      { id: 'b1-608', title: 'Module 6 Practice', url: L('module-6-practice-b1-608'), sum: 'Justins Routine für Modul 6.' },
    ],
    routine: { url: L('module-6-practice-b1-608'), items: null },
    checks: [
      { id: 'm6-goals', text: 'Justins Ziele aus „Module 6 Practice“ erfüllt', how: 'Diese Seite ließ sich nicht auslesen. Öffne die Lektion und prüf die Ziele dort.', link: L('module-6-practice-b1-608') },
    ],
  },
  {
    n: 7,
    title: 'Air Changes, Dynamics & Consolidation!',
    de: 'Luftwechsel, Dynamik, Festigen, Abschluss Grade 1',
    url: 'https://www.justinguitar.com/modules/air-changes-dynamics-consolidation',
    lessons: [
      { id: 'b1-701', title: 'The 8 Essential Beginner Chord Grips', url: L('the-8-essential-beginner-chord-grips-b1-701') },
      { id: 'b1-702', title: 'Best Chord Changes To Work On', url: L('best-chord-changes-to-work-on-b1-702') },
      { id: 'b1-703', title: 'Air Changes (aspire to this!)', url: L('air-changes-aspire-to-this-b1-703') },
      { id: 'b1-704', title: 'Open Strings Between Changes', url: L('open-strings-between-changes-b1-704') },
      { id: 'b1-705', title: 'Feel Good Strumming', url: L('feel-good-strumming-b1-705') },
      { id: 'b1-706', title: 'Dynamic Improvements', url: L('dynamic-improvements-b1-706') },
      { id: 'b1-707', title: 'Memorize Easy Songs', url: L('memorize-easy-songs-b1-707') },
      { id: 'b1-708', title: 'Why do Ear Training?', url: L('why-do-ear-training-b1-708') },
      { id: 'b1-709', title: 'Why study Music Theory?', url: L('why-study-music-theory-b1-709') },
      { id: 'b1-710', title: 'How to PASS Grade 1', url: L('how-to-pass-grade-1-b1-710'), sum: 'Die Kriterien für den Abschluss von Grade 1.' },
      { id: 'b1-711', title: 'Module 7 Practice', url: L('module-7-practice-b1-711'), sum: 'Justins 20-Minuten-Routine für Modul 7.' },
      { id: 'b1-712', title: 'Consolidation Practice Tip', url: L('consolidation-practice-tip-b1-712') },
      { id: 'b1-7ff', title: 'Grade 1 Feedback Please!', url: L('grade-1-feedback-please-b1-7ff') },
    ],
    routine: {
      url: L('module-7-practice-b1-711'),
      items: ['2′ Chord Perfect auf dem Akkord, der schwerfällt', '2 × 1′ OMC: die zwei schwächsten (falls nötig)', '2′ Strumming mit Metronom', '2′ Strumming 6/8 mit Metronom', '2′ Riff', '10′ Song-Arbeit'],
    },
    // „How to PASS Grade 1“, in Justins Reihenfolge
    checks: [
      { id: 'g1-tune', text: 'Die Gitarre mit einem Stimmgerät stimmen' },
      { id: 'g1-memo', text: 'Die acht Akkorde A, D, E, Am, Dm, Em, C und G auswendig, in beliebiger Reihenfolge, sofort' },
      { id: 'g1-perfect', text: 'Alle acht Akkorde öfter sauber als nicht (über 50 %): alle Töne klingen, gedämpfte Saiten bleiben stumm, nichts schnarrt' },
      { id: 'g1-omc', text: '30 Wechsel pro Minute bei jedem Akkordpaar', auto: 'g1omc', how: 'Alle 28 Paare der acht Akkorde, jedes mit mindestens 30 pro Minute. Justin: 60 wären toll, sind für die meisten aber zu viel verlangt.' },
      { id: 'g1-strum', text: 'Old Faithful (D DU UD) mit 80 BPM zum Metronom' },
      { id: 'g1-songs', text: 'Fünf leichte Songs so auswendig, dass du sie auf einer Party spielen kannst', count: 5 },
      { id: 'g1-perform', text: 'Einen Song vor jemandem spielen oder dich dabei aufnehmen' },
      { id: 'g1-ear', text: 'Gehörtraining Grade 1 und Musiktheorie Grade 1', optional: true },
    ],
    note: 'Das Wichtigste laut Justin: Sei nachsichtig und freundlich zu dir.',
  },
];

export const ALL_LESSONS = MODULES.flatMap((m) => m.lessons.map((l, i) => ({ ...l, module: m.n, num: `${m.n}.${i + 1}` })));

// Hinweise, die beim Üben über dem Schritt stehen. Inhalte aus den genannten Lektionen.
export const HINTS = {
  perfect: 'Chord Perfect: Akkord greifen, anschlagen, prüfen, ob jede Saite klingt. Hand weg, neu greifen.',
  perfectNew: (c) => `Chord Perfect auf ${c}, deinem neuesten Akkord. Greifen, anschlagen, jede Saite prüfen, Hand weg, neu greifen.`,
  omcNew: (c) => `Ein-Minuten-Wechsel mit ${c}. Jeder saubere Wechsel zählt. Ziel: rund 30 pro Minute.`,
  omcPool: 'Ein-Minuten-Wechsel aus deinem Plan, der Reihe nach. Ziel für Grade 1: 30 pro Minute.',
  omcWeak: 'Einer deiner zwei schwächsten Wechsel unter 30 pro Minute.',
  strum5: 'Aus „Guitar Strumming Tips“: Arm locker, Bewegung aus dem Ellbogen, ein Pendel, das nie anhält. Bei Luftschlägen weiterschwingen. Zum Einüben auch auf gedämpften Saiten.',
  strum: 'Die Schlaghand bleibt in Bewegung, auch bei Luftschlägen. Mit Metronom.',
  oldFaithful: 'Grade-1-Ziel: Old Faithful (D DU UD) mit 80 BPM zum Metronom.',
  caya: 'Come As You Are: Übung für Abschlag, sauberes Greifen und Rhythmus. Der Riff beginnt auf dem „und“ nach Zählzeit 3 im Takt davor. Etwa 2 Minuten.',
  riff: 'Riff aus deinem Plan, der Reihe nach. Etwa 2 Minuten.',
  picking: 'Wechselschlag: auf einer Saite gleichmäßig ab und auf anschlagen. Auch andere Saiten probieren, abwechselnd mit gerade und schräg gehaltenem Plektrum.',
  forcing: 'Aus „Forcing Chord Changes“: Akkord auf Schlag 1 treffen, die Schlaghand hört nie auf. Notfalls einen Akkord auslassen oder kürzer halten.',
  sixEight: '6/8 mit Metronom: laut zählen, Betonung auf 1 und 4. Auf 2 und 5 kein Anschlag, der Arm schwingt trotzdem weiter. Das Muster steht in der Lektion „A 6:8 Strumming Pattern“.',
};

export const SONG_NOTES = {
  5: 'Ein Song mit C. Justins Vorschläge in „Songs For Module 5“: Eleanor Rigby (nur C und Em), Get Lucky, Black, I Only Want You, Tonight’s The Night. Er rät: Songs nehmen, die dir gefallen, Songs mit G noch auslassen.',
  6: 'Ein Song aus „Songs For Module 6“ oder einer, den du magst.',
  7: 'Songs auswendig lernen. Grade-1-Ziel: fünf leichte Songs, so gut, dass du sie auf einer Party spielen kannst.',
};

// Ablauf einer Einheit pro Modul. Minuten sind Richtwerte, Wechsel dauern so lange wie in deinem Plan.
// kind: stretch | perfect | omc | strum | riff | picking | sixeight | song
export const TEMPLATES = {
  5: {
    normal: [
      { kind: 'stretch' },
      { kind: 'perfect', from: 'new' },
      { kind: 'perfect', from: 'rot', n: 1 },
      { kind: 'omc', from: 'new', n: 2 },
      { kind: 'omc', from: 'pool', n: 4 },
      { kind: 'strum', n: 2 },
      { kind: 'riff', focus: 'Come As You Are' },
      { kind: 'song', min: 5 },
    ],
    kurz: [
      { kind: 'perfect', from: 'new' },
      { kind: 'perfect', from: 'rot', n: 1 },
      { kind: 'omc', from: 'new', n: 2 },
      { kind: 'strum', n: 1 },
    ],
  },
  6: {
    normal: [
      { kind: 'stretch' },
      { kind: 'perfect', from: 'new' },
      { kind: 'perfect', from: 'rot', n: 1 },
      { kind: 'omc', from: 'new', n: 2 },
      { kind: 'omc', from: 'pool', n: 2 },
      { kind: 'strum', n: 2, alt: { kind: 'sixeight', unlock: 'b1-604' } },
      { kind: 'picking', unlock: 'b1-601', instead: { kind: 'omc', from: 'pool', n: 2 } },
      { kind: 'riff' },
      { kind: 'song', min: 5 },
    ],
    kurz: [
      { kind: 'perfect', from: 'new' },
      { kind: 'perfect', from: 'rot', n: 1 },
      { kind: 'omc', from: 'new', n: 2 },
      { kind: 'strum', n: 1 },
    ],
  },
  7: {
    normal: [
      { kind: 'stretch' },
      { kind: 'perfect', from: 'rot', n: 2 },
      { kind: 'omc', from: 'weak', n: 2 },
      { kind: 'omc', from: 'pool', n: 2 },
      { kind: 'strum', n: 2, first: 'Old Faithful' },
      { kind: 'sixeight' },
      { kind: 'riff' },
      { kind: 'song', min: 5 },
    ],
    kurz: [
      { kind: 'perfect', from: 'rot', n: 2 },
      { kind: 'omc', from: 'weak', n: 2 },
      { kind: 'strum', n: 1, first: 'Old Faithful' },
    ],
  },
};

// Aus deinem Wochenplan (Wallpaper): Gitarre täglich 20 Minuten, Minimum 5 Minuten
export const WEEK = {
  minutes: 20,
  minimum: 5,
  slots: 'Mo bis Fr und So 17:30 bis 17:50, Sa 15:15 bis 15:35',
};
