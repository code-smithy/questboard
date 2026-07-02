# Questboard

A small static application to organize nerd meetups, tabletop sessions, gaming nights, painting events, and other friend-group activities.

See the [Questboard design document](docs/design.md) for the current product plan and MVP decisions.
See the [Supabase setup guide](docs/supabase-setup.md) for Phase 2 database, RLS, and Discord OAuth setup notes.
See the [GitHub Pages deployment guide](docs/github-pages.md) for static hosting setup.

## Phase 1 frontend scaffold

Questboard is scaffolded as a static Vite + React + TypeScript application.

### Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.

### Available scripts

- `npm run dev` starts the local Vite development server.
- `npm run build` type-checks and builds the static app.
- `npm run preview` previews the production build locally.
- `npm run lint` runs ESLint.
