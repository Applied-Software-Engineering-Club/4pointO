# How to contribute
1. Pick out a task from spreadsheet
2. Make sure that GitHub repo has task name in issues (if not ask tech lead, PM, or Prez for details)
3. Create a branch with a name like app_name/stack/detail or app_name-stack-detail etc. so it is easy to discern.
  - EX: gpacalc-backend-courseadd, gpacalc/frontend/calc-button
4. **Before any changes plss**
  - git checkout main
  - git pull origin main
5. Open a PR referencing the #issue
6. Since multiple people can be working on a widget at same time. 1 PR 1 issue pls

# First off what is 4point0?
4point0 is a operating system style webapp (webOS) focused on providing students (SJSU first) with the apps they need to keep track of their academic success.

# What does 4point0 offer?
It offers the tools necessary to keep track their current academic standing as well as future academic pathway through a GPA calculator, course planner, an improved rate my professor system, and a syllabus tracker.

# Running locally
Prerequisites: Node.js 20.9 or newer

Clone repository

```bash
npm install
npm run dev
```

# Who can contribute?
Currently only authorized members of SJSU's ASE dev team

# Isolated dashboard preview

Run the dashboard without a Supabase connection:

```bash
npm run dev:preview
```

Open **http://127.0.0.1:3000**. To choose another port, use `npm run dev:preview -- --port 3001`.

In Windows PowerShell with script execution restrictions, use `npm.cmd` and `npx.cmd` in place of `npm` and `npx`.

The interface is labelled **Local demo preview.** It uses a fixed sample day (October 19, 2026), not an authenticated account. Use **Explore empty states** to inspect empty widgets. Overview, Academic, and Personal filter the workspace. Customize saves widget visibility on this device; notes and sample assignment completion also use local browser storage. Demo storage uses a separate `4pointo.demo.v1` namespace. If storage is unavailable, edits stay in memory for the visit.

Study mode shows the timer and assignments; the 25-minute timer supports start, pause, resume, and reset. Widget positions are fixed in a responsive grid. The page scrolls normally; the elevated app dock has its own space after the cards so it cannot cover content or controls.

The existing GPA calculator and what-if interface use a separate local adapter in preview. Course search searches sample fixtures. Add, edit, and remove affect in-memory data only and reset when leaving the calculator. Grade calculation, the full course manager, syllabus tracker, full calendar, and example app show a preview-unavailable page with a return link. The dashboard calendar remains interactive.

`scripts/preview.mjs` binds to loopback and starts Next in development with `LOCAL_DEMO_PREVIEW=true`. It gives the child empty Supabase URL/key variables so local environment files cannot supply credentials. No secret files are changed. The server-side flag requires `NODE_ENV=development`; setting it in a production build/runtime does not enable preview. The preview proxy skips session refresh, redirects authentication callbacks, rejects mutation/server-action requests, and restricts browser connections to this origin. The shared server client also refuses Supabase access in preview. Normal environment validation and authentication remain intact when preview is off.

To stop preview, press **Ctrl+C**. After receiving your team's valid development environment values, configure them through the existing local environment workflow, then run:

```bash
npm run dev
```

The preview command's flag is confined to its child process. If you manually set `LOCAL_DEMO_PREVIEW` in your shell, unset it before starting normal mode. Do not deploy the development preview server.

Verification commands:

```bash
npm run lint
npx tsc --noEmit
npm run build
node scripts/check-preview.mjs
node scripts/check-preview-boundary.mjs
```

The browser check needs a running preview and a locally installed Chrome. It uses Node's built-in WebSocket API (Node 22+), a fresh temporary profile, and no added dependencies. Set `CHROME_PATH` if Chrome is installed elsewhere; pass an alternate local URL as the first argument. It checks desktop (1366×768 and 1920×1080), tablet, mobile, empty states, local interactions/persistence, safe linked routes, and browser network isolation. Screenshots and a report are written to a new directory in the system temporary folder. Existing `.dashboard-qa` artifacts are not used or modified.

Dashboard data shapes are in `components/dashboard/model.ts`; real reads use existing interfaces through `components/dashboard/load.ts`. Fixtures live in `utils/demo/fixtures.ts`. The dashboard introduces no real mutations. Completion is managed through the existing syllabus tracker in normal mode. Degree progress remains unavailable until there is a verified source. Free-form class days are displayed only when recognized unambiguously; no class location is invented. GPA uses the existing grade-point calculation.

# Need help?
Preferably if there is a PR made contact through there first. Tech Lead, our PMs, Prez, and VP on discord.
