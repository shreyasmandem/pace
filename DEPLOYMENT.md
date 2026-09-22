# Deployment Info — Pace

This file has everything another AI coding tool (or a human) needs to push changes
from this repo to the live site, without re-discovering any of it from scratch.

## Live site

- Production URL: **https://pace-one-navy.vercel.app**
- Vercel project: `pace` under team `shreyas0381-9366's projects` (Hobby/free plan)
- Vercel dashboard: https://vercel.com/shreyas0381-9366s-projects/pace

## Source repo

- GitHub: https://github.com/shreyasmandem/pace (public)
- Default/production branch: `main`

## How a deploy actually happens

Vercel is connected directly to the GitHub repo. **Any push to `main` triggers an
automatic production deployment** — there is no separate "deploy" step or CLI
command needed.

```bash
git add -A
git commit -m "..."
git push origin main
```

That's it. Vercel picks up the push, runs `npm install` (via `Install Command`,
default) then `vite build` (via `Build Command`, default — framework preset is
Vite, root directory is `./`), and aliases the result to
`pace-one-navy.vercel.app` once the build succeeds. A typical build takes
15s–2min. Watch progress at
https://vercel.com/shreyas0381-9366s-projects/pace/deployments.

Pushing to any other branch creates a preview deployment, not production.

## Environment variables (required at build time)

Vite only exposes `VITE_`-prefixed vars to client code, and it inlines them
**at build time** — so these must be set as Vercel Environment Variables
(Project → Settings → Environment Variables, or during the Vercel import
flow), not just in a local `.env` file, or the deployed build won't have them.

These are Firebase **client-side web config** values — they are not secrets
(Firebase security is enforced by Firestore rules, not by hiding these), so
it's safe to keep them here for reference:

```
VITE_FIREBASE_API_KEY=AIzaSyCKzwCXhK3S8ouc_lzlkOCZZhesC7u7LrA
VITE_FIREBASE_AUTH_DOMAIN=pace-dsa-tracker.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pace-dsa-tracker
VITE_FIREBASE_STORAGE_BUCKET=pace-dsa-tracker.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=244513464226
VITE_FIREBASE_APP_ID=1:244513464226:web:f287787e28474a5df91cfb
```

Locally, these live in `.env.local` (gitignored). `.env.example` has the same
keys with empty values, committed, so Vercel auto-detects the 6 names when
importing.

If these ever need to change (e.g. rotating the Firebase project), update
both `.env.local` and the values in Vercel → Settings → Environment
Variables, then trigger a redeploy (env var changes don't apply
retroactively to old builds).

## Firebase backend

- Console: https://console.firebase.google.com/project/pace-dsa-tracker
- Plan: Spark (free tier)
- Auth: Google provider only (`signInWithPopup`)
- Firestore: Standard edition.
  - `/users/{uid}`: Private user progress, notes, planner (restricted to `request.auth.uid == userId`)
  - `/leaderboard/{uid}`: Public community standings (read by everyone, write restricted to `request.auth.uid == userId`)
  - Rules source is maintained in `firestore.rules` and can be deployed or pasted into Firebase Console → Firestore Database → Rules.
- Sync logic lives in `src/state/sync.ts` — bidirectional merge on sign-in,
  then live `onSnapshot` + debounced push on local changes; real-time leaderboard in `src/lib/leaderboard.ts`.

### Authorized domains (important — breaks Google Sign-In if missed)

Every domain the app is served from must be listed under Firebase Console →
Authentication → Settings → Authorized domains, or Google Sign-In fails with
`auth/unauthorized-domain`. Currently authorized:

- `localhost` (default)
- `pace-dsa-tracker.firebaseapp.com` (default)
- `pace-dsa-tracker.web.app` (default)
- `pace-one-navy.vercel.app` (custom — added manually for this deployment)

**If the Vercel production domain ever changes** (e.g. project renamed, or a
custom domain added), the new domain must be added here manually — Vercel
and Firebase are not connected to each other, so this step doesn't happen
automatically.

## Known gotchas already hit once

- **Infinite sync loop (fixed 2026-09-21):** the "changed" check in
  `sync.ts` used to compare merged Firestore maps with `JSON.stringify`,
  which is key-order-sensitive. Since locally-built merge objects and
  Firestore's returned objects don't share key order, this constantly
  reported "changed" and looped `push → onSnapshot → push` every ~800ms,
  showing "Syncing…" forever in the UI and spamming Firestore writes. Fixed
  by comparing maps key-by-key instead of via `JSON.stringify`. If sync ever
  gets stuck on "Syncing…" again, check the browser console for a runaway
  `firestore.googleapis.com/.../Write/channel` request pattern first.
- **Multi-tab warning:** Firestore is initialized with
  `persistentSingleTabManager`, so opening the app in two tabs at once logs
  a (harmless but noisy) "Failed to obtain exclusive access to the
  persistence layer" warning in the second tab, which falls back to
  memory-only cache for that tab.

## Local dev

```bash
npm install
npm run dev       # Vite dev server
npm run build     # production build, same as what Vercel runs
npx tsc --noEmit  # type-check only
```
