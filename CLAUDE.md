# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node is at `/opt/homebrew/bin/node` — it is not on PATH by default. Prefix all npm commands:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev      # start Vite dev server on :5180
PATH=/opt/homebrew/bin:$PATH npm run build    # tsc type-check + Vite production build
PATH=/opt/homebrew/bin:$PATH npm install      # install deps
```

No test runner is configured. Type-check only via `npm run build`. Preview launch entry is
`us-open-draft` (port 5180) in the parent working directory's `.claude/launch.json`.

> The Vite dev server does **not** run the `api/` serverless function. The app degrades gracefully
> (draft calls fail to a cached/offline state), so to exercise the live draft end-to-end use
> `vercel dev` with a linked Vercel KV store, or test against a deployed preview.

## Architecture

Single-page React 18 + TypeScript app (Vite, Tailwind v3) for a head-to-head **U.S. Open draft**
between Aidan ("me") and his Dad ("dad"), forked from the PGA Championship Tracker. The app has two
modes: a **live two-device draft**, then the same **tracker** (leaderboard / compare / analysis).

### Draft (the new core vs. the PGA app)

Each side drafts **5 main players + 1 dark horse** (6 each, 12 total) by **straight alternating**
order (A, B, A, B, …). Turn and slot are *derived*, never stored: `turnIndex = picks.length`,
current side = `firstPicker` when the index is even else the other; a side's 6th pick is its dark
horse. The two devices share state through **Vercel KV** via a Node serverless function.

- `api/draft.js` — KV-backed `create` / `join` / `pick` / GET-fetch. Validates turn, ownership
  (per-device `token` owns a side), availability, and 6-per-side cap server-side. Whole room stored
  as one JSON value at `draft:room:<CODE>`. No auth — friend-group toy.
  - **Concurrency:** `@vercel/kv` has no transactions, so `join`/`pick` run inside `lockedUpdate()`
    — acquire a short-lived `draft:lock:<CODE>` (`set … {nx,ex:5}`), re-read fresh state, mutate,
    write, release. Without this, two simultaneous joins clobber each other. Lock contention returns
    `busy` (client retries).
  - **Gotcha:** room codes are **uppercase** alnum; use `sanitizeCode` (allows `A–Z0–9`) for codes
    and `sanitizeId` (lowercase slug) for player ids — do not sanitize a code with `sanitizeId` or it
    strips the letters.
- `src/lib/draft.ts` — pure derivations (`currentSide`, `slotForNextPick`, `isComplete`,
  `toPicks` → converts the chronological pick list into the `{ me, dad }` `Picks` shape the tabs
  use) **mirrored from the server**, plus fetch wrappers (4–6s timeout) that validate response shape
  via `isDraftState` and fall back to a localStorage cache (`usopen2026.draft.<code>.*`). The
  per-device token lives at `usopen2026.token`.
- `src/components/DraftRoom.tsx` — setup (create/join + pick side + who-picks-first), the live board
  (turn banner, both teams' 6 slots, available-player pool via `PlayerTable` with per-row Draft
  buttons), and **~2s polling** while the draft is live.
- Room is shared via `?room=CODE` (`src/lib/urlState.ts`).

### Tracker (reused from the PGA app)

Once `isComplete(state)`, `App.tsx` swaps `DraftRoom` for the header + three tabs, passing
`toPicks(state)` as `picks`:
- **Leaderboard** — manual refresh hits `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard`
  (this feed surfaces the current featured event; **confirm it carries U.S. Open data during event
  week** — it showed prior tour events pre-championship). Team summary cards + full leaderboard with
  pre-tourney and live odds (`VITE_ODDS_API_KEY` optional).
- **Compare** — head-to-head SG / odds / live-score edge.
- **Initial Analysis** — both slates + "Notable Players Not Added".

### Data

`src/data/players.ts` is the field source of truth: ~50 `Player` objects (id, country, American
`odds`, SG stats, `last5`, drive distance, up&down %, `usOpen2025` = 2025 Oakmont finish). Exports
`PLAYERS`, `PLAYERS_BY_ID`, `avgPosition()`. **No `DEFAULT_PICKS`** — teams come from the draft.
`src/types.ts` adds `DraftPick` / `DraftState` alongside the reused `Player` / `Picks` types.

### Header image

Header background references `/shinnecock.jpg` (served from `public/`, not committed). Without it the
fallback dark-green CSS gradient shows.

## Deployment

`vercel.json` builds the Vite SPA to `dist/` and rewrites all non-`/api` routes to `index.html` so
shared `?room=` links and serverless functions both work. **A Vercel KV (Upstash) store must be
attached** so `KV_REST_API_URL` / `KV_REST_API_TOKEN` are injected (read automatically by
`@vercel/kv`). Set `VITE_ODDS_API_KEY` if live odds are wanted.
