# Hosanna Studio

**Hosanna Studio** is the web dashboard for [Hosanna](https://hosanna.live) — the ChordPro songbook and worship planning platform for churches.

Leaders plan here. Musicians play from the [Hosanna mobile app](https://github.com/Apoll011/Hosanna). Same library, same services, offline on stage.

Live: [studio.hosanna.live](https://studio.hosanna.live)

### SEO / Search Console

- `public/sitemap.xml` → https://studio.hosanna.live/sitemap.xml (demo, signup, login)
- `public/robots.txt` — allows those public pages; discourages crawling private `/:slug/*` workspaces
- Also linked from the marketing site robots: https://hosanna.live/robots.txt  
  In Google Search Console, prefer a **Domain** property for `hosanna.live` and submit **both** sitemaps (marketing + Studio).

---

## What Studio is for

Studio is the admin and planning surface of Hosanna. Use it to:

- Build and maintain the church **ChordPro song library** (create, edit, import, export)
- Organize songs in **folders** and **collections** (a song can sit in multiple collections)
- Plan **services**: date, title, song order, team notes, announcements, scripture cues
- Manage **teams**, roles, and permissions so the right people can edit vs. only view
- Work with **agendas** for upcoming gatherings and responsibilities
- Search and jump around with a **command palette**
- Handle **organization** settings, onboarding, subscriptions/billing, and trash recovery

It talks to the Hosanna API for all data. This repo is a static frontend (Vite); the API owns persistence and business rules.

---

## Product features (shipped)

| Area | Details |
| --- | --- |
| **Library** | ChordPro songs with structured metadata (key, capo, tempo, artist, CCLI, song number, …) |
| **Editor** | ChordPro editing with Hosanna’s chord tooling (`@hosanna` / hosanna-chordpro) |
| **Drive / folders** | Familiar folder browsing for large repertoires |
| **Collections** | Cross-cutting groupings (unlike folders, membership is many-to-many) |
| **Services** | Drag-and-drop order, notes, and sharing with the whole worship team |
| **Print** | Print templates for **song**, **songbook**, **service**, and **agenda event** |
| **Teams** | People, roles, and access control for the org |
| **Agendas** | Scheduling and reminders around services and duties |
| **AI** | Org AI settings, song import from photo/PDF, Studio AI assistant |
| **Imports** | ChordPro + third-party chord sources (e.g. CifraClub-style providers) |
| **Library health** | Admin insights and auto-fixes (duration, YouTube id, …) |
| **Auth** | Better Auth — email, social sign-in, 2FA, org management |
| **Search** | Fast find + keyboard command palette |
| **PWA** | Installable progressive web app |
| **Demo** | Try Studio without registering (`/demo`) |
| **Analytics** | Usage, setlist insights, library health (PostHog + in-app) |
| **Backups** | Organization library backup download |

Mobile companions (separate repo): per-musician transpose/capo, metronome, auto-scroll, **song** PDF, AI chart import, offline sync.

---

## Tech stack

**Frontend:** Preact, TypeScript, Vite, React Router, Tailwind CSS, Lucide, React Hook Form

**App services:** Better Auth, PostHog, [Hosanna ChordPro](https://github.com/Apoll011/hosanna-chordpro), Ace editor, TanStack Markdown, LIQE query/filter, QRCode.react, Atlassian pragmatic drag-and-drop

```text
┌─────────────────────┐
│    Hosanna Studio   │  Preact + TypeScript + Vite
└──────────┬──────────┘
           │ HTTP/API
           ▼
┌─────────────────────┐
│     Hosanna API     │  Auth, business logic, database
└─────────────────────┘
```

## Project structure

```text
src/
├── api/          # API communication
├── components/   # Reusable UI
├── contexts/
├── hooks/
├── layouts/
├── lib/
├── pages/        # Songs, Services, Teams, Agenda, Collections, …
├── routes/
├── types/
├── App.tsx
└── main.tsx
```

## Getting started

```bash
git clone https://github.com/Apoll011/hosanna-studio.git
cd hosanna-studio
npm install
npm run dev
```

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` / `npm run start` | Preview production build |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run clean` | Remove build output |

Environment variables go in a local Vite `.env` (API URL, auth, analytics). Do not commit secrets.

## Related projects

- **Product site:** https://hosanna.live
- **Mobile app:** https://github.com/Apoll011/Hosanna
- **ChordPro tooling:** https://github.com/Apoll011/hosanna-chordpro

## License

Apache License 2.0 — see [LICENSE.md](LICENSE.md).
