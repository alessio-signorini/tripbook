# AGENTS.md

Tripbook: a PWA editor plus a static trips site, built from JSON in a private GitHub data repo. Plain JavaScript (Node 24, ES modules). Read [README.md](README.md) first; deeper docs are in `docs/`.

## Commands

- `npm test`: all tests (`node --test "test/*.test.js"`; the glob is required). Run it after every change; it is fast.
- `npm run build:example && npm run serve`: example site on :8080.
- `npm run build:editor:demo && npm run serve:editor`: editor on :8081; on `#/setup` press "Use sample data" (no GitHub or token needed).
- `npm run build:editor` / `npm run build:example` must still pass after changes.
- No linter, no TypeScript, no watch mode. Rebuild after edits. Start servers detached and kill them by PID when done.

## Layout

- `src/shared/`: code used by both the site build and the editor (schema, paths, visibility and numbering, Maps links, Markdown, ratings, `render/*` pure HTML renderers). The editor's Preview and the published site call the same renderers, so change rendering here only.
- `src/site/`: browser code and CSS of the public trip page.
- `src/editor/`: the PWA (Preact + htm + signals, no JSX). Screens in `app/`, GitHub client `github.js`, sync logic `sync.js`, pure edit operations `editing.js`, Google calls isolated in `places.js`, fake GitHub for demo mode `demo.js`.
- `src/build/`: `build-site.mjs` and `build-editor.mjs` (both export functions that tests call).
- `scripts/`: deploy scripts that act on real GitHub repos. **Never run** `create-data-repo.sh`, `setup-editor-pages.sh`, `release.sh` or `setup-auto-release.sh` unless the user asks.
- `examples/data/`: sample data that drives `build:example`, demo mode and most tests.
- `docs/`: `DEPLOY.md` (user setup), `DEVELOPMENT.md`, `DATA-MODEL.md`, `BUILD.md` (full spec to regenerate the project).

## Rules that matter

- **Privacy:** never render dates or times on the public site (`captured_at`, `auto_date`, `created_at`, `updated_at`, `synced_at` stay in JSON/editor only). The site build must never output a `.json` file. Tests enforce both.
- Escape all user text (`esc`); Markdown only via `renderMarkdown`.
- The site's embedded `#trip-data` must carry every stop field `src/site/trip.js` uses (`minutes`, `off_route`); omissions fail silently in the browser.
- Numbering, low-rated hiding and off-route lettering live in `src/shared/visible.js`; the build and `trip.js` both use it. Keep them in agreement.
- Schema changes: optional fields need no version bump; update `validateTrip`, `docs/DATA-MODEL.md`, and `docs/BUILD.md`. Unknown fields must be preserved.
- Keep the dependency list short (see `package.json`); do not add frameworks or TypeScript.
- Never commit secrets. `.env` is git-ignored; `examples/data/config.json` must keep an empty Maps key. Search for `AIza` before committing.
- The editor service worker is cache-first: when testing in a browser after a rebuild, unregister it and clear caches, or you will see stale code.
- Site-building changes (`src/shared`, `src/site`, build scripts) are auto-released by `.github/workflows/release.yml` on push to `main`; editor-only changes just redeploy the editor.

## Workflow

- Add or adjust tests in the existing `test/*.test.js` files for behavior you change; no network calls in tests (mock `fetch`).
- When behavior changes, update `docs/BUILD.md` (the spec) and any directly related doc so they stay accurate.
- Commit messages: short imperative subject; end with the `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer when an AI wrote the change. Do not push unless asked.
