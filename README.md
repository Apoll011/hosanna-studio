# Hosanna Studio

**Hosanna Studio** is the web dashboard for [Hosanna](https://hosanna.live), providing churches and organizations with a centralized workspace for managing their worship content, services, teams, schedules, subscriptions, and more.

Studio is the administrative and organizational side of Hosanna. It communicates with the Hosanna API for application data and backend operations, keeping the frontend focused on the user experience.

## Features

Hosanna Studio currently includes:

- **Drive** — Manage and organize church content and files.
- **Library** — Browse and manage songs and other worship resources.
- **Collections** — Group songs and resources into reusable collections. Unlike folders, a resource can belong to multiple collections.
- **Teams** — Organize people and manage team-related functionality.
- **Services** — Plan and organize church services, including service content and assignments.
- **Agendas** — Schedule upcoming activities and responsibilities, with support for planning and reminders.
- **Subscriptions** — Manage organization subscriptions and billing.
- **Authentication** — Secure authentication and organization management through Better Auth.
- **Search and command palette** — Quickly navigate and interact with Studio using keyboard-driven workflows.
- **Drag and drop** — Interactive organization of content using Atlassian's pragmatic drag-and-drop libraries.
- **PWA support** — Studio can be installed and used as a progressive web application.
- **Analytics** — Product analytics and usage insights through PostHog.
- **Responsive interface** — Designed for desktop, tablet, and mobile use.

Studio also integrates with the Hosanna ChordPro ecosystem for working with structured song content.

## Tech Stack

### Frontend

- [Preact](https://preactjs.com/) — UI framework
- [TypeScript](https://www.typescriptlang.org/) — Type-safe development
- [Vite](https://vite.dev/) — Development server and build tooling
- [React Router](https://reactrouter.com/) — Routing
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [Lucide](https://lucide.dev/) — Icons
- [React Hook Form](https://react-hook-form.com/) — Form management

### Application

- [Better Auth](https://www.better-auth.com/) — Authentication
- [PostHog](https://posthog.com/) — Product analytics
- [Hosanna ChordPro](https://github.com/Apoll011/hosanna-chordpro) — ChordPro parsing and song functionality
- [React Ace](https://github.com/securingsincity/react-ace) / Ace — Editor functionality
- [TanStack Markdown](https://tanstack.com/) — Markdown functionality
- [LIQE](https://github.com/gajus/liqe) — Query/filter functionality
- [QRCode.react](https://github.com/zpao/qrcode.react) — QR code generation
- [Atlaskit Pragmatic Drag and Drop](https://atlassian.design/components/pragmatic-drag-and-drop/) — Drag-and-drop interactions

### Infrastructure

Studio is a frontend application that communicates with the **Hosanna API** for backend operations and application data. Database access and server-side business logic are handled outside this repository.

The application is built with Vite and can be deployed as a static frontend, including through Vercel.

## Architecture

Studio is intentionally separated from the Hosanna backend.

```text
┌─────────────────────┐
│    Hosanna Studio   │
│                     │
│  Preact + TypeScript│
│  Vite               │
│  Tailwind CSS       │
│  Better Auth        │
│  PostHog            │
└──────────┬──────────┘
           │
           │ HTTP/API
           ▼
┌─────────────────────┐
│     Hosanna API     │
│                     │
│ Authentication      │
│ Business logic      │
│ Database access     │
│ Backend services    │
└─────────────────────┘
```

This separation allows Studio to remain a focused frontend application while the API owns persistent data and backend responsibilities.

## Project Structure

The source code is organized by application responsibility:

```text
src/
├── api/                    # API communication
├── assets/                 # Application assets
├── components/             # Reusable UI components
├── contexts/               # Application contexts
├── db/                     # Frontend data/database-related utilities
├── demo/                   # Demo functionality and data
├── hooks/                  # Reusable application hooks
├── layouts/                # Page layouts
├── lib/                    # Shared application utilities
├── pages/                  # Application pages
├── routes/                 # Routing configuration
├── types/                  # TypeScript types
├── utils/                  # General utilities
│
├── App.tsx                 # Application root
├── main.tsx                # Application entry point
├── index.css               # Global styles
└── command-palette.types.ts
```

## Requirements

- Node.js
- npm

Check your installed versions with:

```bash
node --version
npm --version
```

## Getting Started

Clone the repository:

```bash
git clone https://github.com/Apoll011/hosanna-studio.git
cd hosanna-studio
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite will start the development server and provide the local URL in the terminal.

## Available Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the Vite development server |
| `npm run build`     | Build Studio for production       |
| `npm run start`     | Preview the production build      |
| `npm run preview`   | Preview the production build      |
| `npm run typecheck` | Run TypeScript type checking      |
| `npm run lint`      | Run ESLint                        |
| `npm run clean`     | Remove the production build       |

Before submitting changes, it is recommended to run:

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment

Studio communicates with the Hosanna API and uses environment configuration for services such as authentication and analytics.

Environment variables should be provided through Vite's environment configuration.

Do not commit secrets or production credentials to the repository.

For local development, create the appropriate `.env` file based on the environment configuration expected by the current API and deployment setup.

## Development

Studio uses a component-oriented architecture with application functionality separated into pages, layouts, components, hooks, API utilities, and shared types.

When adding functionality:

1. Keep API communication inside the API layer where practical.
2. Reuse existing components and hooks before introducing new abstractions.
3. Keep page-specific logic close to the relevant page.
4. Prefer TypeScript types over untyped data.
5. Use the existing design system and Tailwind utilities.
6. Keep the frontend independent from direct database access.
7. Run type checking, linting, and a production build before opening a pull request.

## Design Philosophy

Studio is designed around a few principles:

- **Simple** — Complex functionality should remain understandable.
- **Fast** — Interactions should feel immediate and lightweight.
- **Responsive** — The interface should work across desktop, tablet, and mobile.
- **Consistent** — Components and interactions should follow a shared visual language.
- **Accessible** — Important functionality should remain usable across different devices and interaction methods.
- **Focused** — Features should solve real church workflow problems without unnecessary product bloat.

## Related Projects

- **Hosanna** — The main Hosanna application
  https://hosanna.live

- **Hosanna Studio** — This repository
  https://github.com/Apoll011/hosanna-studio

- **Hosanna ChordPro** — ChordPro parser and song tooling
  https://github.com/Apoll011/hosanna-chordpro

## License

Hosanna Studio is licensed under the [Apache License 2.0](LICENSE.md).
