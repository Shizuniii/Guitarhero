// Kursdaten für den Lernplan: JustinGuitar Beginner Grade 1, Module 1 bis 7.
// Titel, Links, Längen, Routinen und Ziele stammen von justinguitar.com (abgerufen im November 2026).
// Was dort nicht steht, steht hier nicht: fehlende Längen bleiben leer, Kurzbeschreibungen gibt es nur,
// wo die Lektionsseite gelesen werden konnte.

const L = (slug) => `https://www.justinguitar.com/guitar-lessons/${slug}`;

export const COURSE = {
  title: 'JustinGuitar Beginner Grade 1',
  url: 'https://www.justinguitar.com/classes/beginner-guitar-course-grade-one',
  // Laut Shy: Lektionen von Modul 0 bis 4 gesehen, in Modul 5 „The C Chord“ (Stand 23. November 2026).
  // Die Übungen aus Modul 1 bis 4 sitzen aber noch nicht alle, deshalb werden sie mitgeprüft.
  doneBefore: 'Module 0 bis 4',
};

// Ab diesem Modul richtet sich der Ablauf der Einheit (Shy schaut gerade die Lektionen von Modul 5).
// Modul 1 bis 4 laufen mit und müssen erfüllt sein, bevor Modul 6 kommt.
export const START_FOCUS = 5;

// In welchem Modul Justin etwas einführt. Daran hängt, zu welchem Modul deine Übungen zählen.
export const CHORD_MODULE = { A: 1, D: 1, E: 2, Am: 3, Em: 3, Dm: 4, C: 5, G: 6 };
export const STRUM_MODULE = [[/old faithful/i, 4], [/^d dudud$/i, 3], [/^d dud d$/i, 3]];
export const RIFF_MODULE = [[/peter gunn/i, 2], [/seven nation/i, 3], [/sunshine/i, 4], [/come as you are/i, 5]];
export const STRETCH_MODULE = 4;

export const GRADE1_CHORDS = ['A', 'D', 'E', 'Am', 'Dm', 'Em', 'C', 'G'];

export const MODULES = [
  {
    n: 1,
    title: 'A & D Chords: Play Your First Song!',
    de: 'A und D, Ankerfinger, Ein-Minuten-Wechsel',
    lessons: [
      { id: 'b1-105', title: 'How To Play The D Chord', dur: '08:33', url: L('how-to-play-the-d-chord-b1-105') },
      { id: 'b1-108', title: 'How To Play The A Chord', dur: '06:22', url: L('how-to-play-the-a-chord-b1-108') },
      { id: 'b1-109', title: 'How To Use Anchor Fingers', dur: '03:02', url: L('how-to-use-anchor-fingers-b1-109') },
      { id: 'b1-110', title: 'One Minute Changes Exercise', dur: '05:22', url: L('one-minute-changes-exercise-b1-110') },
      { id: 'b1-111', title: 'Bars & Strumming On 1', dur: '04:47', url: L('bars-strumming-on-1-b1-111') },
      { id: 'b1-112', title: 'How To Strum The Correct Strings', dur: '02:14', url: L('how-to-strum-the-correct-strings-b1-112') },
      { id: 'b1-113', title: 'How To Minimize Finger Pain', dur: '04:10', url: L('how-to-minimize-finger-pain-b1-113') },
      { id: 'b1-114', title: 'Super Easy 2 Chord Songs', dur: '05:47', url: L('super-easy-2-chord-songs-b1-114') },
      { id: 'b1-115', title: 'How To Use Justin\'s Song App', dur: '05:07', url: L('how-to-use-justin-s-song-app-b1-115') },
      { id: 'b1-116', title: 'Module 1 Practice Routine', dur: '05:14', url: L('module-1-practice-routine-b1-116'), sum: 'Justins erste 20-Minuten-Routine und wann es weitergeht.' },
      { id: 'b1-117', title: 'Using My Practice Assistant', dur: '10:06', url: L('using-my-practice-assistant-b1-117') },
      { id: 'b1-118', title: 'When to move on from Module 1?', dur: '02:40', url: L('when-to-move-on-from-module-1-b1-118') },
    ],
    routine: {
      url: L('module-1-practice-routine-b1-116'),
      items: ['1′ Gitarre stimmen', '3′ Chord Perfect D', '3′ Chord Perfect A', '2′ Ankerfinger A und D', '1′ OMC A → D', '1′ OMC D → A', '10′ Songs mit zwei Akkorden'],
    },
    checks: [
      { id: 'm1-memo', text: 'A und D auswendig' },
      { id: 'm1-omc', text: 'Mindestens 30 Akkordwechsel pro Minute', auto: 'routine', pairs: [['A', 'D']], how: 'Gemessen an A–D.' },
      { id: 'm1-song', text: 'Einen Song ausprobiert' },
    ],
  },
  {
    n: 2,
    title: 'Rhythm & Chord Changes + Your First Riff!',
    de: 'E-Akkord, Fuß mitklopfen, Schlagtechnik, erster Riff',
    lessons: [
      { id: 'b1-201', title: 'How To Play The E Chord', dur: '06:35', url: L('how-to-play-the-e-chord-b1-201') },
      { id: 'b1-202', title: 'E Chord Anchors & Tricks', dur: '02:24', url: L('e-chord-anchors-tricks-b1-202') },
      { id: 'b1-203', title: 'Tapping Your Foot', dur: '04:49', url: L('tapping-your-foot-b1-203') },
      { id: 'b1-204', title: 'Strumming Mechanics', dur: '09:43', url: L('strumming-mechanics-b1-204') },
      { id: 'b1-205', title: 'Strumming On The Beat', dur: '06:38', url: L('strumming-on-the-beat-b1-205') },
      { id: 'b1-206', title: 'Chord Changes For One', dur: '03:39', url: L('chord-changes-for-one-b1-206') },
      { id: 'b1-207', title: 'Peter Gunn Theme', dur: '05:52', url: L('peter-gunn-theme-b1-207') },
      { id: 'b1-208', title: 'Songs For Module 2', dur: '04:16', url: L('songs-for-module-2-b1-208') },
      { id: 'b1-209', title: 'Module 2 Practice Routine', dur: '07:36', url: L('module-2-practice-routine-b1-209'), sum: 'Justins 20-Minuten-Routine und die Ziele für Modul 2.' },
    ],
    routine: {
      url: L('module-2-practice-routine-b1-209'),
      items: ['Gitarre stimmen', '2′ Chord Perfect E', '1′ Chord Perfect D', '1′ Chord Perfect A', '2′ Ankerfinger E, A und D', '1′ OMC A → D', '1′ OMC A → E', '1′ OMC D → E', '1′ Peter Gunn Theme', '10′ Songs für Modul 2'],
    },
    checks: [
      { id: 'm2-memo', text: 'E auswendig, dazu A und D' },
      { id: 'm2-anchor', text: 'Ankerfinger bei diesen Wechseln sicher' },
      { id: 'm2-omc', text: 'Rund 30 Wechsel pro Minute zwischen allen bisherigen Akkorden', auto: 'chords', chords: ['A', 'D', 'E'], how: 'Gemessen an A–D, A–E und D–E.' },
      { id: 'm2-riff', text: 'Spaß mit dem Peter Gunn Theme gehabt' },
      { id: 'm2-song', text: 'Einen oder zwei Songs mit allen drei Akkorden ausprobiert' },
    ],
  },
  {
    n: 3,
    title: 'Capo, Minor Chords & Up Strums',
    de: 'Am und Em, Aufschläge, Capo',
    lessons: [
      { id: 'b1-301', title: 'What Are Minor Chords', dur: '04:23', url: L('what-are-minor-chords-b1-301') },
      { id: 'b1-302', title: 'The E Minor Chord', dur: '01:53', url: L('the-e-minor-chord-b1-302') },
      { id: 'b1-303', title: 'The A Minor Chord', dur: '06:02', url: L('the-a-minor-chord-b1-303') },
      { id: 'b1-304', title: 'Holding the Guitar', dur: '02:43', url: L('holding-the-guitar-b1-304') },
      { id: 'b1-305', title: 'Counting Ands', dur: '03:26', url: L('counting-ands-b1-305') },
      { id: 'b1-306', title: 'All About Up Strums', dur: '06:22', url: L('all-about-up-strums-b1-306') },
      { id: 'b1-307', title: 'Strumming Patterns With Ups', dur: '07:48', url: L('strumming-patterns-with-ups-b1-307'), sum: 'Die Muster D DUD D und D DUDUD, erst auf gedämpften Saiten.' },
      { id: 'b1-308', title: 'All About Capos', dur: '08:38', url: L('all-about-capos-b1-308') },
      { id: 'b1-309', title: 'Seven Nation Army', dur: '06:16', url: L('seven-nation-army-b1-309') },
      { id: 'b1-310', title: 'Songs For Module 3', dur: '02:07', url: L('songs-for-module-3-b1-310') },
      { id: 'b1-311', title: 'Module 3 Practice Routine', dur: '05:54', url: L('module-3-practice-routine-b1-311'), sum: 'Justins 20-Minuten-Routine und die Ziele für Modul 3.' },
    ],
    routine: {
      url: L('module-3-practice-routine-b1-311'),
      items: ['Gitarre stimmen', '1′ Chord Perfect Am', '1′ Chord Perfect Em', '1′ OMC Am → E', '1′ OMC Em → D', '1′ OMC Am → Em', '1′ Ankerfinger E, A und D', '2′ Strumming', '2′ Seven Nation Army', '10′ Songs für Modul 3'],
    },
    checks: [
      { id: 'm3-memo', text: 'Am und Em auswendig, dazu alle bisherigen Akkorde' },
      { id: 'm3-omc', text: 'Rund 30 Wechsel pro Minute zwischen allen bisherigen Akkorden', auto: 'chords', chords: ['A', 'D', 'E', 'Am', 'Em'], how: 'Alle 10 Paare aus A, D, E, Am und Em.' },
      { id: 'm3-riff', text: 'Spaß mit Seven Nation Army gehabt' },
      { id: 'm3-song', text: 'Einen oder zwei Songs mit Am und Em ausprobiert' },
    ],
  },
  {
    n: 4,
    title: 'Metronome, Stretches & The Pattern',
    de: 'Dm, Finger Stretch, Metronom, Old Faithful',
    lessons: [
      { id: 'b1-401', title: 'Beginner Finger Stretches', dur: '09:02', url: L('beginner-finger-stretches-b1-401') },
      { id: 'b1-402', title: 'The D Minor Chord', dur: '05:03', url: L('the-d-minor-chord-b1-402') },
      { id: 'b1-403', title: 'Meet The Metronome', dur: '04:25', url: L('meet-the-metronome-b1-403') },
      { id: 'b1-404', title: 'THE Strumming Pattern', dur: '08:35', url: L('the-strumming-pattern-b1-404') },
      { id: 'b1-405', title: 'How To Read Guitar TAB', dur: '04:56', url: L('how-to-read-guitar-tab-b1-405') },
      { id: 'b1-406', title: 'Sunshine Of Your Love', dur: '06:08', url: L('sunshine-of-your-love-b1-406') },
      { id: 'b1-407', title: 'Songs For Module 4', dur: '02:47', url: L('songs-for-module-4-b1-407') },
      { id: 'b1-408', title: 'Module 4 Practice Routine', dur: '06:05', url: L('module-4-practice-routine-b1-408'), sum: 'Justins 20-Minuten-Routine und die Ziele für Modul 4.' },
    ],
    routine: {
      url: L('module-4-practice-routine-b1-408'),
      items: ['Gitarre stimmen', '2′ Finger Stretch', '1′ Chord Perfect Dm', '1′ der Akkord, der am schwersten fällt', '2′ die schwierigsten Wechsel, zwei Durchgänge', '2′ Old Faithful', '2′ Sunshine Of Your Love', '10′ Songs für Modul 4'],
    },
    checks: [
      { id: 'm4-omc', text: 'Rund 30 Akkordwechsel pro Minute', auto: 'chords', chords: ['A', 'D', 'E', 'Am', 'Dm', 'Em'], how: 'Alle 15 Paare aus A, D, E, Am, Dm und Em. Justin lässt dafür die schwierigsten Wechsel üben.' },
      { id: 'm4-memo', text: 'A, D, E, Am, Dm und Em auswendig' },
      { id: 'm4-strum', text: 'Old Faithful sitzt gleichmäßig und bequem auf gedämpften Saiten, am besten mit Metronom' },
      { id: 'm4-riff', text: 'Sunshine Of Your Love schaffen' },
      { id: 'm4-song', text: 'Mindestens einen Song ordentlich und größtenteils durchspielen' },
    ],
  },
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
      { id: 'm5-omc', text: 'Rund 30 Akkordwechsel pro Minute', auto: 'routine', pairs: [['Am', 'C'], ['C', 'Em']], how: 'Gemessen an den beiden Wechseln aus Justins Routine, Am–C und C–Em: beide mindestens 30 pro Minute.' },
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
      { id: 'b1-608', title: 'Module 6 Practice', url: L('module-6-practice-b1-608'), sum: 'Justins 20-Minuten-Routine und die Ziele für Modul 6.' },
    ],
    routine: {
      url: L('module-6-practice-b1-608'),
      items: ['1′ Finger Stretch', '1′ Wechselschlag auf einer Saite (Plektrumwinkel, Handgelenk, Arm)', '2′ G Chord Perfect', '1′ Chord Perfect auf dem Akkord, der schwerfällt', '1′ OMC G → C', '1′ OMC G → D', '1′ OMC C → D (oder der schwierigste)', '2′ Strumming 6/8', '10′ Song-Arbeit'],
    },
    checks: [
      { id: 'm6-omc', text: 'Rund 30 Akkordwechsel pro Minute', auto: 'routine', pairs: [['G', 'C'], ['G', 'D']], how: 'Gemessen an den Wechseln aus Justins Routine, G–C und G–D: beide mindestens 30 pro Minute.' },
      { id: 'm6-chords', text: 'A, D, E, Am, Dm, Em, C und G auswendig' },
      { id: 'm6-picking', text: 'Wechselschlag auf einer Saite ausprobiert und gemerkt, wie stark der Plektrumwinkel den Klang verändert' },
      { id: 'm6-68', text: '6/8 ausprobiert, am besten mit Metronom. Auch wenn es noch schwerfällt, kannst du Klick und Tempo vorausahnen' },
      { id: 'm6-song', text: 'Mindestens einen Song mit G größtenteils durchspielen. Justins Tipp: Hey Joe von Jimi Hendrix' },
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
      { id: 'g1-omc', text: '30 Wechsel pro Minute bei jedem Akkordpaar', auto: 'chords', chords: GRADE1_CHORDS, how: 'Alle 28 Paare der acht Akkorde, jedes mit mindestens 30 pro Minute. Justin: 60 wären toll, sind für die meisten aber zu viel verlangt.' },
      { id: 'g1-strum', text: 'Old Faithful (D DU UD) mit 80 BPM zum Metronom' },
      { id: 'g1-songs', text: 'Fünf leichte Songs so auswendig, dass du sie auf einer Party spielen kannst', count: 5 },
      { id: 'g1-perform', text: 'Einen Song vor jemandem spielen oder dich dabei aufnehmen' },
      { id: 'g1-ear', text: 'Gehörtraining Grade 1 und Musiktheorie Grade 1', optional: true },
    ],
    note: 'Das Wichtigste laut Justin: Sei nachsichtig und freundlich zu dir.',
  },
];

for (const m of MODULES) m.lessons.forEach((l, i) => { l.module = m.n; l.num = `${m.n}.${i + 1}`; });
export const ALL_LESSONS = MODULES.flatMap((m) => m.lessons);
export const moduleByN = (n) => MODULES.find((m) => m.n === n);
export const lessonById = (id) => ALL_LESSONS.find((l) => l.id === id);

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
  picking: 'Wechselschlag: auf einer Saite gleichmäßig ab und auf anschlagen. Achte auf Plektrumwinkel, Handgelenk und Arm, probier gerade und schräg gehaltenes Plektrum und auch andere Saiten.',
  forcing: 'Aus „Forcing Chord Changes“: Akkord auf Schlag 1 treffen, die Schlaghand hört nie auf. Notfalls einen Akkord auslassen oder kürzer halten.',
  sixEight: '6/8 mit Metronom: laut zählen, Betonung auf 1 und 4. Auf 2 und 5 kein Anschlag, der Arm schwingt trotzdem weiter. Das Muster steht in der Lektion „A 6:8 Strumming Pattern“.',
};

export const SONG_NOTES = {
  5: 'Ein Song mit C. Justins Vorschläge in „Songs For Module 5“: Eleanor Rigby (nur C und Em), Get Lucky, Black, I Only Want You, Tonight’s The Night. Er rät: Songs nehmen, die dir gefallen, Songs mit G noch auslassen.',
  6: 'Ein Song mit G. Justins Tipp in „Module 6 Practice“: Hey Joe von Jimi Hendrix. Mehr Vorschläge in „Songs For Module 6“.',
  7: 'Songs auswendig lernen. Grade-1-Ziel: fünf leichte Songs, so gut, dass du sie auf einer Party spielen kannst.',
};

// Songvorschläge für die Karte „Noch kein Song“, aus Justins Lektionen
export const SONG_IDEAS = {
  5: { text: 'Justins Vorschläge für Modul 5: Eleanor Rigby (nur C und Em), Get Lucky, Black, I Only Want You, Tonight’s The Night. Songs mit G lässt er hier noch aus. Für den Prüfpunkt brauchst du einen Song mit C.', lesson: 'b1-507' },
  6: { text: 'Justins Tipp für Modul 6: Hey Joe von Jimi Hendrix. Für den Prüfpunkt brauchst du einen Song mit G.', lesson: 'b1-607' },
  7: { text: 'Für Grade 1 brauchst du fünf leichte Songs auswendig. Wie man sie sich merkt, zeigt Justin in „Memorize Easy Songs“.', lesson: 'b1-707' },
};

// Ohne Song gehen die 5 Minuten an zusätzliche Wechsel: Dort ist dein Abstand zum Ziel gemessen (rund 30 pro Minute).
const NO_SONG = [{ kind: 'omc', from: 'pool', n: 4 }];

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
      { kind: 'song', min: 5, fallback: NO_SONG },
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
      { kind: 'picking', unlock: 'b1-601', instead: { kind: 'omc', from: 'pool', n: 1 } },
      { kind: 'strum', n: 1, unlock: 'b1-604' },
      { kind: 'sixeight', unlock: 'b1-604', instead: { kind: 'strum', n: 2 } },
      { kind: 'riff' },
      { kind: 'song', min: 5, fallback: NO_SONG },
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
      { kind: 'song', min: 5, fallback: NO_SONG },
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
