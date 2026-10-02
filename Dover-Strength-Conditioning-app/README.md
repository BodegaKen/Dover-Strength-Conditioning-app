# Dover Tigers S&C

A standalone web app for Dover High School's football strength & conditioning
program: player logins, auto-computed weekly lifts from each athlete's
e1RM, test/session logging, ACWR-based load monitoring, progress charts, an
all-time leaderboard, and a coach admin for roster + phase/week control.

**First time setting this up? Start with [DEPLOY.md](./DEPLOY.md)** — it
walks through creating a free database (Neon) and hosting (Vercel) account
and getting this live at its own URL.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- PostgreSQL via Prisma (hosted free on Neon)
- Username + PIN auth (no email — appropriate for a roster of minors),
  httpOnly JWT session cookie
- Hosted free on Vercel

## Local development

```
npm install
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, COACH_*
npx prisma migrate dev
npm run seed
npm run dev
```

## Where the program's numbers live

`data/program-data.json` holds every phase's sets/reps/%e1RM, extracted from
the project's Phase 1-5 docs. `lib/prescription.ts` normalizes it into a
uniform week-by-week shape the app reads from. To change next season's
numbers, edit that JSON file, commit, and push — Vercel redeploys
automatically.

## Project layout

- `app/login`, `app/change-pin` — auth
- `app/dashboard` — player "This Week" view + test/session logging
- `app/progress` — player's own e1RM trend charts
- `app/leaderboard` — all-time leaderboard (includes archived/graduated
  players by design — see the comment in `app/leaderboard/page.tsx`)
- `app/coach` — roster admin, phase/week setter, team dashboard, CSV export
- `lib/calc.ts` — e1RM and ACWR math, ported from the program's own docs
- `lib/prescription.ts` — turns `data/program-data.json` into displayable
  weekly prescriptions
- `prisma/schema.prisma` — the whole data model
