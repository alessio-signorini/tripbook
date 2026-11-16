# AGENTS.md

Tripbook: a PWA editor plus a static trips site, built from JSON in a private GitHub data repo. Plain JavaScript (Node 24, ES modules, no TypeScript; JSDoc types in `src/shared/schema.js`). `docs/BUILD.md` is the full spec; `docs/DATA-MODEL.md` the JSON format.

## Commands

- `npm run check`: tests + `build:example` + `build:editor`. Run it before every commit; it takes seconds.
- `npm test`: tests only (`node --test "test/*.test.js"`; the glob is required).
- `npm run build:example && npm run serve`: example site on :8080.
- `npm run build:editor:demo && npm run serve:editor`: editor on :8081; on `#/setup` press "Use sample data" (no GitHub or token).
- No linter, no watch mode. Rebuild after edits. Start servers detached and kill them by PID when done.

## Where to change what

| Task | Files |
|---|---|
| Trip page markup | `src/shared/render/trip.js` (`stopRow`, `sectionBlock`, `tripHeader`, `mobileChrome`, `toggles`) + the matching group in `src/site/site.css` |
| Trip page behavior | `src/site/trip/`: `main.js` (wiring, switches), `list.js` (rows, totals, links), `sheet.js`, `clamp.js`, `map.js` (pins, lines), `prefs.js` |
| Numbering, low-rated hiding, off-route letters | `src/shared/visible.js` (used by the build, the page script and the editor) |
| Google Maps links | `src/shared/maps-links.js` |
| Listing, 404, robots, sitemap, Markdown, llms, JSON-LD | `src/shared/render/{listing,layout,seo,trip-md,llms,jsonld}.js` |
| Page `<head>`, CSS inlining, font preload | `src/shared/render/layout.js`; assets in `src/build/build-site.mjs` `buildAssets()` |
| Colors and fonts | `src/shared/tokens.css` (CSS) and `src/shared/theme.js` (JS: pins, stars); keep them equal |
| Schema / new trip field | `src/shared/schema.js` (typedef, `validateTrip`, factories) + `docs/DATA-MODEL.md` + `docs/BUILD.md` §5 |
| An editor screen | `src/editor/screens/*.js`; shared widgets in `src/editor/components/` (`controls.js`: Field, Menu, StarInput, Chips, memo) |
| Editor state or an action | `src/editor/state/` (signals, router, ui, connection, records, actions, site-config, pwa); import via `state/index.js` |
| Trip edit operations | `src/editor/core/editing.js` (pure; applied through `updateTrip`) |
| GitHub, sync, conflicts | `src/editor/core/{github,sync}.js`; conflict modal `components/Conflict.js` |
| Capture, Places, geolocation | `src/editor/core/{capture,places}.js`, `screens/Capture.js` |
| Offline / service worker | `src/editor/sw.js`, shell list in `src/build/build-editor.mjs` |
| Tests | `test/<module>.test.js`; fixtures in `test/fixtures.js` |

## Rules that matter

- **Privacy:** never render dates or times on the public site (`captured_at`, `auto_date`, `created_at`, `updated_at`, `synced_at` stay in JSON/editor). The site build must never output a `.json` file. Tests enforce both.
- Escape all user text (`esc`); Markdown only via `renderMarkdown`.
- `#trip-data` carries only `CLIENT_STOP_FIELDS` (`render/trip.js`). If `src/site/trip/` or the shared code it calls needs another stop field, add it there; `render.test.js` checks both directions.
- Change rendering only in `src/shared/render/`: the editor's Preview uses the same functions.
- CSS: one declaration per line, in the component's group; colors as `var(--…)` only; no inline `style=`. Some rules depend on order (comments say so in `editor.css`). Hover styles go inside `@media (hover: hover)`. The 900 px breakpoint is mirrored by `MOBILE_QUERY` in `src/site/trip/dom.js`.
- Editor: `state/` never imports UI. Pass `StopCard` small props (it is memoized); change trips only through `updateTrip`/`structural` so unchanged objects keep their identity.
- Keep SortableJS and the Preview renderer behind `import()` (lazy chunks); `build-editor.test.js` checks it.
- Schema changes: optional fields need no version bump; update `validateTrip`, the typedefs, `docs/DATA-MODEL.md` and `docs/BUILD.md`. Unknown fields must be preserved.
- Keep the dependency list short (`package.json`); no frameworks, no TypeScript. Fonts are self-hosted (`src/site/fonts/`, OFL); never add Google Fonts links.
- Never commit secrets. `.env` is git-ignored; `examples/data/config.json` must keep an empty Maps key in git (a local key may exist in the working copy: never stage it). Search the staged diff for `AIza` before committing.
- The editor service worker is cache-first: after a rebuild, unregister it and clear caches when testing in a browser.
- **Never run** `scripts/create-data-repo.sh`, `setup-editor-pages.sh`, `release.sh` or `setup-auto-release.sh` unless the user asks: they change real GitHub repos.
- Site-building changes (`src/shared`, `src/site`, `src/build/{build-site,bundle,cli}.mjs`) are auto-released by `.github/workflows/release.yml` on push to `main`; editor-only changes just redeploy the editor. Release is skipped when `HEAD` is already tagged, and it needs `DATA_REPO_TOKEN` with Variables and Actions read/write on the data repo (see `docs/DEPLOY.md` step 13).

## Workflow

- Add or adjust tests in the existing `test/*.test.js` file for the module you change; no network calls in tests (mock `fetch`).
- When behavior or layout changes, update `docs/BUILD.md` (the spec) and any directly related doc in the same commit.
- Commit messages: short imperative subject; end with the `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer when an AI wrote the change. Do not push unless asked.
