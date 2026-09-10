/**
 * Demo Mode — dynamic demo data generator.
 *
 * All dates are computed relative to `new Date()` so they always appear
 * current regardless of when the demo is accessed. The data is localizable
 * via the `locale` string ("pt", "en", "es").
 *
 * This module is intentionally free of React imports so it can be called
 * from non-component code (e.g. seedDemoDatabase).
 */

import type {
  AgendaEventDocType,
  FolderDocType,
  ServiceDocType,
  SongDocType,
} from "../db/schemas";
import { AgendaEvent, Folder, Service, Song } from "../types";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toIso(d: Date): string {
  return d.toISOString();
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Returns the nearest upcoming Sunday (or today if it is Sunday). */
function nextSunday(from: Date = new Date()): Date {
  const d = new Date(from);
  const dow = d.getDay(); // 0 = Sunday
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
  return addDays(d, daysUntilSunday);
}

/** Returns the Sunday before nextSunday(). */
function lastSunday(from: Date = new Date()): Date {
  const ns = nextSunday(from);
  return addDays(ns, -7);
}

// ---------------------------------------------------------------------------
// Localization
// ---------------------------------------------------------------------------

const LOCALE_DATA = {
  pt: {
    folders: [
      "Hinos Clássicos",
      "Louvores Contemporâneos",
      "Natal e Páscoa",
      "Especiais",
    ],
    songs: [
      {
        title: "Digno És",
        artist: "Hosanna! Music",
        tags: ["louvor", "adoração", "destaque"],
      },
      {
        title: "Grande é o Senhor",
        artist: "Igreja Universal",
        tags: ["hino", "clássico", "destaque"],
      },
      {
        title: "Santo Espírito",
        artist: "Fernandinho",
        tags: ["adoração", "contemporâneo"],
      },
      { title: "Nada Além do Sangue", artist: "Vineyard", tags: ["adoração"] },
      {
        title: "Oceanos",
        artist: "Hillsong UNITED",
        tags: ["contemporâneo", "adoração"],
      },
      { title: "Tão Profundo", artist: "Aline Barros", tags: ["louvor"] },
      {
        title: "Quão Grande és Tu",
        artist: "Tradicional",
        tags: ["hino", "clássico"],
      },
      {
        title: "Maravilhosa Graça",
        artist: "Tradicional",
        tags: ["hino", "graça"],
      },
      {
        title: "Glória no Alto",
        artist: "Coral Betel",
        tags: ["louvor", "natal"],
      },
      { title: "Aleluia", artist: "Various", tags: ["adoração", "louvor"] },
      {
        title: "Preciso de Ti",
        artist: "Comunidade da Graça",
        tags: ["adoração"],
      },
      {
        title: "Brilha Jesus",
        artist: "Diante do Trono",
        tags: ["louvor", "contemporâneo"],
      },
      { title: "A Ele a Glória", artist: "Tradicional", tags: ["hino"] },
      {
        title: "Resgate",
        artist: "Ana Paula Valadão",
        tags: ["adoração", "contemporâneo"],
      },
    ],
    services: [
      "Culto Dominical",
      "Culto da Manhã",
      "Culto da Tarde",
      "Culto Especial",
    ],
    serviceNotes: [
      "Verificar o sistema de som antes do culto.",
      "Preparar o ambiente com antecedência.",
      null,
      "Culto especial de aniversário da igreja.",
    ],
    agendaEventTypes: [
      "Culto Dominical",
      "Reunião de Líderes",
      "Ensaio",
      "Culto de Oração",
      "Evento Especial",
    ],
    agendaTitles: [
      "Culto Dominical",
      "Reunião de Líderes",
      "Ensaio da Banda",
      "Culto de Oração e Jejum",
      "Evento de Celebração",
    ],
    locations: [
      "Templo Principal",
      "Salão de Reuniões",
      "Sala de Ensaio",
      null,
      "Praça Central",
    ],
    elementTitles: {
      welcome: "Boas-vindas",
      scripture: "Leitura Bíblica",
      message: "Mensagem",
      announcement: "Avisos",
      custom: "Momento Especial",
    },
    passages: [
      "João 3:16",
      "Salmos 23",
      "Romanos 8:28",
      "Filipenses 4:13",
      "Isaías 40:31",
    ],
    sermonTitles: [
      "A Graça de Deus",
      "O Poder da Fé",
      "Renovação Espiritual",
      "A Promessa de Deus",
    ],
  },
  en: {
    folders: [
      "Classic Hymns",
      "Contemporary Worship",
      "Christmas & Easter",
      "Special Songs",
    ],
    songs: [
      {
        title: "Worthy is the Lamb",
        artist: "Hillsong",
        tags: ["worship", "praise", "featured"],
      },
      {
        title: "Great is Thy Faithfulness",
        artist: "Traditional",
        tags: ["hymn", "classic", "featured"],
      },
      {
        title: "Holy Spirit",
        artist: "Francesca Battistelli",
        tags: ["worship", "contemporary"],
      },
      { title: "Nothing But the Blood", artist: "Vineyard", tags: ["worship"] },
      {
        title: "Oceans",
        artist: "Hillsong UNITED",
        tags: ["contemporary", "worship"],
      },
      { title: "So Much Deeper", artist: "Various", tags: ["praise"] },
      {
        title: "How Great Thou Art",
        artist: "Traditional",
        tags: ["hymn", "classic"],
      },
      {
        title: "Amazing Grace",
        artist: "Traditional",
        tags: ["hymn", "grace"],
      },
      {
        title: "Gloria in Excelsis",
        artist: "Church Choir",
        tags: ["praise", "christmas"],
      },
      { title: "Alleluia", artist: "Various", tags: ["worship", "praise"] },
      { title: "I Need Thee", artist: "Community Church", tags: ["worship"] },
      {
        title: "Shine Jesus Shine",
        artist: "Graham Kendrick",
        tags: ["praise", "contemporary"],
      },
      { title: "To God Be the Glory", artist: "Traditional", tags: ["hymn"] },
      {
        title: "Rescue",
        artist: "Lauren Daigle",
        tags: ["worship", "contemporary"],
      },
    ],
    services: [
      "Sunday Service",
      "Morning Service",
      "Evening Service",
      "Special Service",
    ],
    serviceNotes: [
      "Check the sound system before the service.",
      "Prepare the environment in advance.",
      null,
      "Special church anniversary service.",
    ],
    agendaEventTypes: [
      "Sunday Service",
      "Leaders Meeting",
      "Rehearsal",
      "Prayer Service",
      "Special Event",
    ],
    agendaTitles: [
      "Sunday Service",
      "Leaders Meeting",
      "Band Rehearsal",
      "Prayer and Fasting Service",
      "Celebration Event",
    ],
    locations: [
      "Main Sanctuary",
      "Meeting Hall",
      "Rehearsal Room",
      null,
      "Town Square",
    ],
    elementTitles: {
      welcome: "Welcome",
      scripture: "Scripture Reading",
      message: "Message",
      announcement: "Announcements",
      custom: "Special Moment",
    },
    passages: [
      "John 3:16",
      "Psalm 23",
      "Romans 8:28",
      "Philippians 4:13",
      "Isaiah 40:31",
    ],
    sermonTitles: [
      "God's Grace",
      "The Power of Faith",
      "Spiritual Renewal",
      "God's Promise",
    ],
  },
  es: {
    folders: [
      "Himnos Clásicos",
      "Alabanza Contemporánea",
      "Navidad y Pascua",
      "Especiales",
    ],
    songs: [
      {
        title: "Digno Eres",
        artist: "Hosanna! Music",
        tags: ["alabanza", "adoración", "destacada"],
      },
      {
        title: "Grande es tu Fidelidad",
        artist: "Tradicional",
        tags: ["himno", "clásico", "destacada"],
      },
      {
        title: "Espíritu Santo",
        artist: "Fernandinho",
        tags: ["adoración", "contemporáneo"],
      },
      {
        title: "Nada Más que la Sangre",
        artist: "Vineyard",
        tags: ["adoración"],
      },
      {
        title: "Océanos",
        artist: "Hillsong UNITED",
        tags: ["contemporáneo", "adoración"],
      },
      { title: "Tan Profundo", artist: "Aline Barros", tags: ["alabanza"] },
      {
        title: "Cuán Grande es Él",
        artist: "Tradicional",
        tags: ["himno", "clásico"],
      },
      {
        title: "Sublime Gracia",
        artist: "Tradicional",
        tags: ["himno", "gracia"],
      },
      {
        title: "Gloria en las Alturas",
        artist: "Coro Betel",
        tags: ["alabanza", "navidad"],
      },
      { title: "Aleluya", artist: "Varios", tags: ["adoración", "alabanza"] },
      {
        title: "Te Necesito",
        artist: "Comunidad de la Gracia",
        tags: ["adoración"],
      },
      {
        title: "Brilla Jesús",
        artist: "Ante el Trono",
        tags: ["alabanza", "contemporáneo"],
      },
      { title: "A Él la Gloria", artist: "Tradicional", tags: ["himno"] },
      {
        title: "Rescate",
        artist: "Ana Paula Valadão",
        tags: ["adoración", "contemporáneo"],
      },
    ],
    services: [
      "Culto Dominical",
      "Culto Matutino",
      "Culto Vespertino",
      "Culto Especial",
    ],
    serviceNotes: [
      "Verificar el sistema de sonido antes del culto.",
      "Preparar el ambiente con anticipación.",
      null,
      "Culto especial de aniversario de la iglesia.",
    ],
    agendaEventTypes: [
      "Culto Dominical",
      "Reunión de Líderes",
      "Ensayo",
      "Culto de Oración",
      "Evento Especial",
    ],
    agendaTitles: [
      "Culto Dominical",
      "Reunión de Líderes",
      "Ensayo de la Banda",
      "Culto de Oración y Ayuno",
      "Evento de Celebración",
    ],
    locations: [
      "Templo Principal",
      "Salón de Reuniones",
      "Sala de Ensayo",
      null,
      "Plaza Central",
    ],
    elementTitles: {
      welcome: "Bienvenida",
      scripture: "Lectura Bíblica",
      message: "Mensaje",
      announcement: "Avisos",
      custom: "Momento Especial",
    },
    passages: [
      "Juan 3:16",
      "Salmos 23",
      "Romanos 8:28",
      "Filipenses 4:13",
      "Isaías 40:31",
    ],
    sermonTitles: [
      "La Gracia de Dios",
      "El Poder de la Fe",
      "Renovación Espiritual",
      "La Promesa de Dios",
    ],
  },
} as const;

type SupportedLocale = keyof typeof LOCALE_DATA;

function resolveLocale(locale: string): SupportedLocale {
  const lang = locale.split("-")[0].toLowerCase();
  if (lang === "pt" || lang === "en" || lang === "es") return lang;
  return "pt";
}

// ---------------------------------------------------------------------------
// ChordPro song content generator (plain songs)
// ---------------------------------------------------------------------------

const SAMPLE_CHORD_PROGRESSIONS = [
  "G  C  Em  D",
  "C  G  Am  F",
  "D  A  Bm  G",
  "Em  C  G  D",
  "F  C  Gm  Bb",
];

function makeSongContent(title: string, artist: string, idx: number): string {
  const progression =
    SAMPLE_CHORD_PROGRESSIONS[idx % SAMPLE_CHORD_PROGRESSIONS.length];
  const [c1, c2, c3, c4] = progression.split("  ").map((c) => `[${c}]`);
  return [
    `{title: ${title}}`,
    `{artist: ${artist}}`,
    `{key: ${progression.split("  ")[0]}}`,
    "",
    "{start_of_verse: Verso 1}",
    `${c1}Senhor, ${c2}Tu és digno de toda ${c3}honra e ${c4}glória`,
    `${c1}Em Ti ${c2}confio, com ${c3}todo o meu ${c4}coração`,
    "{end_of_verse}",
    "",
    "{start_of_chorus: Refrão}",
    `${c1}Aleluia, ${c2}aleluia`,
    `${c3}Glória a Deus nas ${c4}alturas`,
    `${c1}Aleluia, ${c2}aleluia`,
    `${c3}Digno és de ${c4}louvor`,
    "{end_of_chorus}",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// ChordPro "showcase" songs — hand-authored per locale so the demo library
// actually demonstrates the parser's richer features: multiple sections,
// repeats, comments/comment boxes, an instrumental chord grid, a tab
// section, and an alternate arrangement via {start_of_version}/{end_of_version}.
// These replace the generated content for song index 0 in each locale.
// ---------------------------------------------------------------------------

const SHOWCASE_SONG_CONTENT: Record<SupportedLocale, string> = {
  pt: `{title: Digno És}
{artist: Hosanna! Music}
{key: G}
{original_key: F}
{capo: 1}
{tempo: 72}
{time: 4/4}
{duration: 4:35}
{ccli: 1234567}
{youtube: https://youtube.com/watch?v=demo}

{c: Intro suave, apenas piano}

{start_of_verse: Verso 1}
[G]Tu és digno, [C]Senhor e [D]Rei
[Em]Toda honra [C]a Ti [D]pertence
[G]Reinas para [C]sempre, [D]eternamente
[Em]Nada se com[C]para ao Teu [D]amor
{end_of_verse}

{start_of_verse: Verso 2}
[G]Vim adorar-[C]Te, de [D]coração
[Em]Render[C]-me diante do Teu [D]trono
[G]Tua presença [C]enche este [D]lugar
[Em]Glória e [C]louvor ao Teu [D]nome
{end_of_verse}

{start_of_chorus: Refrão}
[C]Digno és, [G]digno és
[D]O Cordeiro que foi [Em]morto
[C]Digno és, [G]digno és
[D]De receber [G]toda honra
{end_of_chorus}
{repeat: 2}

{start_of_bridge: Ponte}
[Em]Santo, [C]santo, [G]santo é o [D]Senhor
[Em]Digno, [C]digno, [G]digno é o [D]Senhor
{end_of_bridge}
{repeat: 3}

{c: Instrumental — banda entra em conjunto}

{start_of_grid: Grade instrumental}
|: [G]  [C]  |  [D]  [Em] :|
{end_of_grid}

{start_of_tab: Introdução (violão)}
e|--------0-------0------|
B|------1-------1--------|
G|----0-------0----------|
D|--2-------2------------|
A|-----------------------|
E|-3---------------------|
{end_of_tab}

{cb: Nota de regência: reduzir dinâmica na última repetição do refrão}

{start_of_version: Acústica}
{tempo: 64}
{capo: 3}

{start_of_verse: Verso 1}
[G]Tu és digno, [C]Senhor e [D]Rei
[Em]Toda honra [C]a Ti [D]pertence
{end_of_verse}

{start_of_chorus: Refrão}
[C]Digno és, [G]digno és
[D]O Cordeiro que foi [Em]morto
{end_of_chorus}
{end_of_version}
`,

  en: `{title: Worthy is the Lamb}
{artist: Hillsong}
{key: G}
{original_key: F}
{capo: 1}
{tempo: 72}
{time: 4/4}
{duration: 4:35}
{ccli: 1234567}
{youtube: https://youtube.com/watch?v=demo}

{c: Soft intro, piano only}

{start_of_verse: Verse 1}
[G]You are worthy, [C]Lord and [D]King
[Em]Every honor [C]belongs to [D]You
[G]You reign for[C]ever, [D]eternally
[Em]Nothing com[C]pares to Your [D]love
{end_of_verse}

{start_of_verse: Verse 2}
[G]I have come to [C]worship [D]You
[Em]Falling [C]down before Your [D]throne
[G]Your presence [C]fills this [D]place
[Em]Glory and [C]praise to Your [D]name
{end_of_verse}

{start_of_chorus: Chorus}
[C]Worthy is, [G]worthy is
[D]The Lamb who once was [Em]slain
[C]Worthy is, [G]worthy is
[D]To receive [G]all the honor
{end_of_chorus}
{repeat: 2}

{start_of_bridge: Bridge}
[Em]Holy, [C]holy, [G]holy is the [D]Lord
[Em]Worthy, [C]worthy, [G]worthy is the [D]Lord
{end_of_bridge}
{repeat: 3}

{c: Instrumental — full band comes in}

{start_of_grid: Instrumental grid}
|: [G]  [C]  |  [D]  [Em] :|
{end_of_grid}

{start_of_tab: Intro (acoustic guitar)}
e|--------0-------0------|
B|------1-------1--------|
G|----0-------0----------|
D|--2-------2------------|
A|-----------------------|
E|-3---------------------|
{end_of_tab}

{cb: Conductor's note: pull back dynamics on the final chorus repeat}

{start_of_version: Acoustic}
{tempo: 64}
{capo: 3}

{start_of_verse: Verse 1}
[G]You are worthy, [C]Lord and [D]King
[Em]Every honor [C]belongs to [D]You
{end_of_verse}

{start_of_chorus: Chorus}
[C]Worthy is, [G]worthy is
[D]The Lamb who once was [Em]slain
{end_of_chorus}
{end_of_version}
`,

  es: `{title: Digno Eres}
{artist: Hosanna! Music}
{key: G}
{original_key: F}
{capo: 1}
{tempo: 72}
{time: 4/4}
{duration: 4:35}
{ccli: 1234567}
{youtube: https://youtube.com/watch?v=demo}

{c: Intro suave, solo piano}

{start_of_verse: Verso 1}
[G]Tú eres digno, [C]Señor y [D]Rey
[Em]Todo honor [C]te per[D]tenece
[G]Reinas para [C]siempre, [D]eternamente
[Em]Nada se com[C]para a Tu [D]amor
{end_of_verse}

{start_of_verse: Verso 2}
[G]Vengo a adorar[C]te, de [D]corazón
[Em]Postrán[C]dome ante Tu [D]trono
[G]Tu presencia [C]llena este [D]lugar
[Em]Gloria y [C]alabanza a Tu [D]nombre
{end_of_verse}

{start_of_chorus: Coro}
[C]Digno eres, [G]digno eres
[D]El Cordero que fue [Em]inmolado
[C]Digno eres, [G]digno eres
[D]De recibir [G]todo el honor
{end_of_chorus}
{repeat: 2}

{start_of_bridge: Puente}
[Em]Santo, [C]santo, [G]santo es el [D]Señor
[Em]Digno, [C]digno, [G]digno es el [D]Señor
{end_of_bridge}
{repeat: 3}

{c: Instrumental — entra la banda completa}

{start_of_grid: Grilla instrumental}
|: [G]  [C]  |  [D]  [Em] :|
{end_of_grid}

{start_of_tab: Introducción (guitarra acústica)}
e|--------0-------0------|
B|------1-------1--------|
G|----0-------0----------|
D|--2-------2------------|
A|-----------------------|
E|-3---------------------|
{end_of_tab}

{cb: Nota de dirección: bajar la dinámica en la última repetición del coro}

{start_of_version: Acústica}
{tempo: 64}
{capo: 3}

{start_of_verse: Verso 1}
[G]Tú eres digno, [C]Señor y [D]Rey
[Em]Todo honor [C]te per[D]tenece
{end_of_verse}

{start_of_chorus: Coro}
[C]Digno eres, [G]digno eres
[D]El Cordero que fue [Em]inmolado
{end_of_chorus}
{end_of_version}
`,
};

/**
 * Second, lighter showcase — a classic hymn arranged with a capo, a
 * fingerstyle tab intro, and a comment, but no version/grid. Gives the
 * library a second "not just plain verse/chorus" example without
 * repeating the exact same feature set as the flagship showcase song.
 */
const HYMN_SHOWCASE_CONTENT: Record<SupportedLocale, string> = {
  pt: `{title: Grande é o Senhor}
{artist: Igreja Universal}
{key: D}
{capo: 2}
{tempo: 80}
{time: 3/4}
{duration: 3:50}
{ccli: 7654321}

{c: Tocar com dedilhado suave}

{start_of_tab: Dedilhado}
e|----0-----0-----0------|
B|--1-----1-----1--------|
G|0-----0-----0----------|
D|-----------------------|
A|-----------------------|
E|3----------------------|
{end_of_tab}

{start_of_verse: Verso 1}
[D]Grande é o [G]Senhor e [D]digno de [A]louvor
[D]Na cidade [G]do nosso [A]Deus, [D]no Seu monte [A]santo
{end_of_verse}

{start_of_chorus: Refrão}
[G]Grande é o [D]Senhor, [A]grande é o [D]Senhor
[G]Digno é de [D]toda a [A]honra e [D]glória
{end_of_chorus}
{repeat: 2}

{cb: Terminar em ritardando na última repetição}
`,

  en: `{title: Great is Thy Faithfulness}
{artist: Traditional}
{key: D}
{capo: 2}
{tempo: 80}
{time: 3/4}
{duration: 3:50}
{ccli: 7654321}

{c: Play with a gentle fingerstyle pattern}

{start_of_tab: Fingerstyle intro}
e|----0-----0-----0------|
B|--1-----1-----1--------|
G|0-----0-----0----------|
D|-----------------------|
A|-----------------------|
E|3----------------------|
{end_of_tab}

{start_of_verse: Verse 1}
[D]Great is the [G]Lord and [D]worthy of [A]praise
[D]In the city [G]of our [A]God, [D]on His holy [A]mountain
{end_of_verse}

{start_of_chorus: Chorus}
[G]Great is the [D]Lord, [A]great is the [D]Lord
[G]Worthy of [D]all the [A]honor and [D]glory
{end_of_chorus}
{repeat: 2}

{cb: End with a ritardando on the final repeat}
`,

  es: `{title: Grande es tu Fidelidad}
{artist: Tradicional}
{key: D}
{capo: 2}
{tempo: 80}
{time: 3/4}
{duration: 3:50}
{ccli: 7654321}

{c: Tocar con arpegio suave}

{start_of_tab: Introducción con arpegio}
e|----0-----0-----0------|
B|--1-----1-----1--------|
G|0-----0-----0----------|
D|-----------------------|
A|-----------------------|
E|3----------------------|
{end_of_tab}

{start_of_verse: Verso 1}
[D]Grande es el [G]Señor y [D]digno de [A]alabanza
[D]En la ciudad [G]de nuestro [A]Dios, [D]en Su monte [A]santo
{end_of_verse}

{start_of_chorus: Coro}
[G]Grande es el [D]Señor, [A]grande es el [D]Señor
[G]Digno es de [D]todo el [A]honor y [D]gloria
{end_of_chorus}
{repeat: 2}

{cb: Terminar con un ritardando en la última repetición}
`,
};

// ---------------------------------------------------------------------------
// Agenda responsibilities — map demo member *names* to their actual
// OrganizationMember ids (from mock-auth's DEMO_ORGANIZATION.members) so
// that anything keying off `memberId` (avatars, profile links, filters)
// resolves correctly instead of pointing at nonexistent "demo-member-N" ids.
// ---------------------------------------------------------------------------

const DEMO_MEMBER_ID_BY_NAME: Record<string, string> = {
  "Demo User": "demo-member-id",
  "Maria Santos": "demo-member-2",
  "João Silva": "demo-member-3",
};

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export interface DemoData {
  folders: Folder[];
  songs: Song[];
  services: Service[];
  agendaEvents: AgendaEvent[];
}

export function generateDemoData(locale: string): DemoData {
  const loc = resolveLocale(locale);
  const L = LOCALE_DATA[loc];
  const now = new Date();
  const nowIso = toIso(now);

  // -------------------------------------------------------------------------
  // Folders
  // -------------------------------------------------------------------------
  const folderIds = L.folders.map(() => crypto.randomUUID());
  const folders: FolderDocType[] = L.folders.map((name, i) => ({
    id: folderIds[i],
    name,
    color: (["violet", "amber", "sky", "rose"] as const)[i % 4],
    icon: (["music", "star", "heart", "book"] as const)[i % 4],
    parentId: null,
    songCount: i === 0 ? 5 : i === 1 ? 6 : i === 2 ? 2 : 1,
    folderCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    _deleted: false,
    isDeleted: false,
    purgeAt: null,
  }));

  // -------------------------------------------------------------------------
  // Songs — spread across folders. Index 0 and 1 use hand-authored
  // "showcase" ChordPro content so the demo library actually exercises
  // verses/chorus/bridge, repeats, comments, an instrumental grid, tab
  // sections, capo/original-key/ccli/youtube/duration metadata, and an
  // alternate arrangement via {start_of_version}. Every other song keeps
  // the lightweight generated content.
  // -------------------------------------------------------------------------
  const songIds = L.songs.map(() => crypto.randomUUID());
  const folderAssignment = [null, null, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 3];
  const songs: SongDocType[] = L.songs.map((s, i) => {
    let content: string;
    if (i === 0) {
      content = SHOWCASE_SONG_CONTENT[loc];
    } else if (i === 1) {
      content = HYMN_SHOWCASE_CONTENT[loc];
    } else {
      content = makeSongContent(s.title, s.artist, i);
    }

    return {
      id: songIds[i],
      title: s.title,
      artist: s.artist,
      content,
      folderId:
        folderAssignment[i] === null ? null : folderIds[folderAssignment[i]],
      path:
        folderAssignment[i] === null
          ? `${s.title.replace(/\s/g, "_")}.chopro`
          : `${L.folders[folderAssignment[i]]}/${s.title.replace(/\s/g, "_")}.chopro`,
      tags: s.tags as unknown as string[],
      song_number: i + 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      _deleted: false,
      isDeleted: false,
      purgeAt: null,
    };
  });

  // -------------------------------------------------------------------------
  // Services — relative to today's Sundays
  // -------------------------------------------------------------------------
  const thisSunday = nextSunday(now);
  const prevSunday = lastSunday(now);
  const nextNextSunday = addDays(thisSunday, 7);

  const makeElement = (
    type: "welcome" | "scripture" | "message" | "announcement" | "song",
    pos: number,
    songIdx?: number,
  ) => ({
    id: crypto.randomUUID(),
    type,
    title:
      type === "song" && songIdx !== undefined
        ? songs[songIdx].title
        : type === "message"
          ? L.sermonTitles[pos % L.sermonTitles.length]
          : L.elementTitles[type],
    position: pos,
    ...(type === "song" && songIdx !== undefined
      ? { songId: songIds[songIdx], duration: 5 }
      : {}),
    ...(type === "scripture"
      ? { passage: L.passages[pos % L.passages.length], duration: 5 }
      : {}),
    ...(type === "message" ? { duration: 40 } : {}),
    ...(type === "welcome" || type === "announcement" ? { duration: 5 } : {}),
  });

  const services: ServiceDocType[] = [
    {
      id: crypto.randomUUID(),
      name: `${L.services[0]} — ${toLocalDate(thisSunday)}`,
      date: toLocalDate(thisSunday),
      notes: L.serviceNotes[0],
      elements: [
        makeElement("welcome", 0),
        makeElement("song", 1, 0),
        makeElement("song", 2, 4),
        makeElement("scripture", 3),
        makeElement("song", 4, 2),
        makeElement("message", 5),
        makeElement("announcement", 6),
      ],
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      _deleted: false,
      isDeleted: false,
      purgeAt: null,
    },
    {
      id: crypto.randomUUID(),
      name: `${L.services[0]} — ${toLocalDate(nextNextSunday)}`,
      date: toLocalDate(nextNextSunday),
      notes: L.serviceNotes[1],
      elements: [
        makeElement("welcome", 0),
        makeElement("song", 1, 5),
        makeElement("song", 2, 9),
        makeElement("scripture", 3),
        makeElement("song", 4, 11),
        makeElement("message", 5),
        makeElement("announcement", 6),
      ],
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      _deleted: false,
      isDeleted: false,
      purgeAt: null,
    },
    {
      id: crypto.randomUUID(),
      name: `${L.services[0]} — ${toLocalDate(prevSunday)}`,
      date: toLocalDate(prevSunday),
      notes: L.serviceNotes[2],
      elements: [
        makeElement("welcome", 0),
        makeElement("song", 1, 1),
        makeElement("song", 2, 6),
        makeElement("scripture", 3),
        makeElement("message", 4),
        makeElement("announcement", 5),
      ],
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      _deleted: false,
      isDeleted: false,
      purgeAt: null,
    },
    {
      id: crypto.randomUUID(),
      name: L.services[3],
      date: toLocalDate(addDays(prevSunday, -14)),
      notes: L.serviceNotes[3],
      elements: [
        makeElement("welcome", 0),
        makeElement("song", 1, 3),
        makeElement("song", 2, 7),
        makeElement("message", 3),
        makeElement("announcement", 4),
      ],
      archived: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      _deleted: false,
      isDeleted: false,
      purgeAt: null,
    },
  ];

  // -------------------------------------------------------------------------
  // Agenda Events
  // -------------------------------------------------------------------------
  const makeResponsibilities = (eventIdx: number) => {
    const sets: Array<{ categoryId: string; names: string[] }[]> = [
      [
        { categoryId: "leader", names: ["Maria Santos"] },
        { categoryId: "preacher", names: ["Demo User"] },
        { categoryId: "sound", names: ["João Silva"] },
      ],
      [
        { categoryId: "leader", names: ["Maria Santos", "Demo User"] },
        { categoryId: "projection", names: ["João Silva"] },
      ],
      [
        { categoryId: "sound", names: ["João Silva"] },
        { categoryId: "projection", names: ["Maria Santos"] },
        { categoryId: "welcome", names: ["Demo User"] },
      ],
      [
        { categoryId: "leader", names: ["Demo User"] },
        { categoryId: "welcome", names: ["João Silva", "Maria Santos"] },
      ],
      [
        { categoryId: "preacher", names: ["Demo User"] },
        { categoryId: "sound", names: ["João Silva"] },
        { categoryId: "leader", names: ["Maria Santos"] },
      ],
    ];
    return (sets[eventIdx % sets.length] ?? []).map((r) => ({
      id: crypto.randomUUID(),
      categoryId: r.categoryId,
      assignees: r.names.map((name, i) => ({
        id: `assignee-${eventIdx}-${i}`,
        name,
        memberId: DEMO_MEMBER_ID_BY_NAME[name] ?? `demo-member-${i + 1}`,
        avatarUrl: null,
      })),
    }));
  };

  const agendaEvents: AgendaEventDocType[] = [
    // Past events
    {
      id: crypto.randomUUID(),
      date: toLocalDate(addDays(now, -10)),
      title: L.agendaTitles[0],
      type: L.agendaEventTypes[0],
      time: "10:00",
      durationMinutes: 90,
      location: L.locations[0],
      notes: null,
      reminder: { enabled: false, label: "" },
      linkedServiceId: null,
      responsibilities: makeResponsibilities(0),
      createdAt: nowIso,
      updatedAt: nowIso,
      isDeleted: false,
      purgeAt: null,
      _deleted: false,
    },
    {
      id: crypto.randomUUID(),
      date: toLocalDate(addDays(now, -3)),
      title: L.agendaTitles[1],
      type: L.agendaEventTypes[1],
      time: "19:30",
      durationMinutes: 60,
      location: L.locations[1],
      notes: null,
      reminder: { enabled: true, label: "1 dia antes" },
      linkedServiceId: null,
      responsibilities: makeResponsibilities(1),
      createdAt: nowIso,
      updatedAt: nowIso,
      isDeleted: false,
      purgeAt: null,
      _deleted: false,
    },
    // Future events
    {
      id: crypto.randomUUID(),
      date: toLocalDate(thisSunday),
      title: L.agendaTitles[0],
      type: L.agendaEventTypes[0],
      time: "10:00",
      durationMinutes: 90,
      location: L.locations[0],
      notes: null,
      reminder: { enabled: true, label: "1 hora antes" },
      linkedServiceId: services[0].id,
      responsibilities: makeResponsibilities(2),
      createdAt: nowIso,
      updatedAt: nowIso,
      isDeleted: false,
      purgeAt: null,
      _deleted: false,
    },
    {
      id: crypto.randomUUID(),
      date: toLocalDate(addDays(now, 5)),
      title: L.agendaTitles[2],
      type: L.agendaEventTypes[2],
      time: "19:00",
      durationMinutes: 120,
      location: L.locations[2],
      notes: null,
      reminder: { enabled: true, label: "30 min antes" },
      linkedServiceId: null,
      responsibilities: makeResponsibilities(3),
      createdAt: nowIso,
      updatedAt: nowIso,
      isDeleted: false,
      purgeAt: null,
      _deleted: false,
    },
    {
      id: crypto.randomUUID(),
      date: toLocalDate(nextNextSunday),
      title: L.agendaTitles[0],
      type: L.agendaEventTypes[0],
      time: "10:00",
      durationMinutes: 90,
      location: L.locations[0],
      notes: null,
      reminder: { enabled: true, label: "1 hora antes" },
      linkedServiceId: services[1].id,
      responsibilities: makeResponsibilities(4),
      createdAt: nowIso,
      updatedAt: nowIso,
      isDeleted: false,
      purgeAt: null,
      _deleted: false,
    },
  ];

  return { folders, songs, services, agendaEvents };
}
