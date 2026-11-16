# Development

## Setup

Open the repo in the devcontainer (Node 24 and the GitHub CLI are included), or install Node 24 yourself:

```sh
npm install
```

## Commands

| Command | What it does |
|---|---|
| `npm test` | Runs all unit and build tests (`node --test "test/*.test.js"`). |
| `npm run check` | Tests plus both builds: run it before every commit. |
| `npm run build:example` | Builds the site from `examples/data` into `_site/`. |
| `npm run serve` | Serves `_site/` on http://localhost:8080. |
| `npm run build:editor` | Builds the editor into `_editor/` (what gets deployed). |
| `npm run build:editor:demo` | Same, plus sample data so the editor runs without GitHub (see below). |
| `npm run serve:editor` | Serves `_editor/` on http://localhost:8081. |
| `npm run icons` | Regenerates the editor's PNG icons from `src/editor/icons/icon.svg`. The PNGs are committed. |

`_site/` and `_editor/` are git-ignored. Build, then serve; there is no watch mode, and a full rebuild takes a second or two.

## The example site

`examples/data` is a small data repo: two published trips (a one-section guide with a place that is off the route, and a two-section log with dates that must never render) and one draft (a guide with a low-rated place). It drives `npm run build:example` and most tests.

To see real maps locally, put a Google Maps key and Map ID in `examples/data/config.json`. The key must allow the referrers `http://localhost:8080/*` and `http://localhost:8081/*`. **Do not commit the key.** The `MAPS_KEY` in `.env` is for the deploy scripts, not for this file.

## Trying the editor without GitHub

The editor normally needs a data repo and a token. For local work:

```sh
npm run build:editor:demo && npm run serve:editor
```

Open http://localhost:8081/#/setup and press **Use sample data** (the button only exists on localhost). The editor loads the example trips into a fake repo kept in your browser's `localStorage`, and Sync, Publish, Unpublish, Delete and conflicts all work against it. **Settings → Change repo/token** switches back to a real repo. The sample data is built into the editor only by the `:demo` build; the deployed editor never contains it.

Notes for local testing:
- The editor registers a service worker that caches the app shell. After rebuilding, if you see stale code, unregister the worker and clear caches (DevTools → Application), or accept the "Update available" banner.
- Stored trips and the fake repo live in the browser profile (IndexedDB and `localStorage`); clear the site's data to start clean.
- The trip photo picker calls the Wikipedia API directly from the browser.
- Edits reach IndexedDB 300 ms after you stop typing; when the tab is hidden or closed, pending edits are also stashed in `localStorage` (`tripbook.unsaved.<id>`) and recovered on the next start.

## Tests

`node:test` with `node:assert`, no other test dependencies. GitHub and Google are never called: tests mock `fetch`, and the Places and Geocoder code is isolated in `src/editor/core/places.js`. `test/fixtures.js` loads fresh copies of the example trips. Test files follow the modules:

| File | Covers |
|---|---|
| `paths.test.js` | slugs, URL paths, listing prefixes, collisions |
| `schema.test.js` | schema rules (including `photo` and `off_route`), the newer-version message, factories |
| `maps-links.test.js` | Google Maps directions (always an array, 11-stop chunks, 2048-char cap), route link labels, Open in Google Maps |
| `format.test.js` | minutes, letters, short addresses, Markdown escaping, star markup, `isLow` |
| `visible.test.js` | numbering and visibility: low-rated switch, section prefixes and continued numbering, off-route letters |
| `render.test.js` | the trip page: numbers, legs, notes, ratings, switches, off-route stops, analytics only on published pages, escaping, share image, listing cards; `#trip-data` carries exactly what the browser needs |
| `trip-md.test.js` | Markdown output, `llms.txt`, `llms-full.txt`, JSON-LD (no ratings, no dates) |
| `build-site.test.js` | a full site build: files, inlined CSS and font preload, sitemap, robots, redirects, errors, and **no `.json` file in the output** |
| `build-editor.test.js` | the editor build: hashed bundle, lazy chunks in the offline shell, `build.json`, service worker, manifest, icons, demo data |
| `github.test.js` | the GitHub client (UTF-8 base64, conflicts, single-commit move), sync logic, and the fake client |
| `editing.test.js` | slug-follows-title, moving stops and sections, structural sharing (`reuseUnchanged`), location autofill, "make guide from log" |
| `capture.test.js` | "Day N" placement and the local-midnight boundary, place and geocode mapping, coordinate parsing |
| `wikipedia.test.js` | the trip photo lookup |

## Code layout

```
src/
  shared/          used by the site build, the trip page script and the editor
    schema.js        JSDoc types (Trip, Section, Stop, ...), SCHEMA_VERSION, DEFAULT_CONFIG, validateTrip(), factories
    paths.js         tripPath(), listingPrefixes(), listingCrumbs(), findCollisions()
    visible.js       numbering and visibility (low-rated switch, off-route letters)
    maps-links.js    Google Maps URLs: directions in chunks, route links, per-stop, Open in Google Maps
    maps-loader.js   Google Maps JS bootstrap loader
    markdown.js      safe Markdown subset; stripMarkdown()
    tokens.css       CSS colors, radius, fonts (imported by both stylesheets)
    theme.js         the same colors for JavaScript, and the star icon path
    rating.js, format.js, slug.js, wikipedia.js
    render/          pure HTML/text renderers: trip, listing, layout, seo, trip-md, llms, jsonld, photo, redirect, icons
  site/            the public trip page in the browser
    site.css         all site styles, grouped by component
    fonts/           self-hosted Space Grotesk 700 (OFL)
    trip/            main.js (entry), list, sheet, clamp, map, prefs, dom
  build/           build-site.mjs, build-editor.mjs, bundle.mjs (esbuild + hashing), cli.mjs
  editor/          the PWA: main.js, App.js, index.html, editor.css, sw.js, manifest, icons/
    screens/         Setup, Trips, TripEditor, Capture, Settings
    components/      controls (memo, fields, menu, stars), overlays, Sections, StopCard, PhotoField, MapPicker, Conflict
    state/           signals and actions, one file per concern; import from state/index.js
    core/            no UI: github, sync, store, demo, editing, places, capture, countries
templates/data-repo/ files copied into a new data repo (config, workflow, README)
examples/data/       sample data repo
scripts/             deploy scripts (see DEPLOY.md) and make-icons.mjs
.github/workflows/   editor.yml (test + deploy the editor), release.yml (automatic releases)
```

The site build and the editor's Preview call the same render functions in `src/shared/render/`, so what you preview is what gets published. The site build makes no network calls.

## Performance notes

- Trip and listing pages inline their CSS and preload one font file; the only third-party request on load is Google Maps, started after the first paint.
- The mobile sheet moves with `transform`; clamped notes use a `ResizeObserver`; map markers are created once and reused.
- The editor's main bundle excludes SortableJS and the Preview renderer (with `marked`): they load on first use and are precached by the service worker. `StopCard` is memoized and `updateTrip` keeps unchanged sections and stops by identity, so typing re-renders one card.

## Conventions

- Plain, readable JavaScript with ES modules. No TypeScript (JSDoc types in `schema.js`), no feature flags, no frameworks beyond Preact (editor only).
- Small modules with one job; editor UI imports state from `state/index.js`, and `state/` never imports UI.
- CSS: one declaration per line, grouped by component; colors only as `var(--…)` tokens from `src/shared/tokens.css`. No inline `style=` in markup.
- Dependencies are kept to a short list in `package.json` (`preact`, `htm`, `@preact/signals`, `sortablejs`, `idb-keyval`, `marked`, `esbuild`; dev: `sirv-cli`, `sharp`). `esbuild` is a runtime dependency because the data repo's workflow runs the site build after `npm ci --omit=dev`.
- All user text is escaped; Markdown only goes through `renderMarkdown`.
- Anything that could reveal when something happened stays out of rendered output.

## How releases reach your site

```
push to main ──▶ Editor workflow ──▶ editor redeployed
      │
      └─ site-building files changed? ──▶ Release workflow
              tests ─▶ tag next v0.x.y ─▶ set TRIPBOOK_REF in the data repo ─▶ run its Site workflow
```

- The data repo's `site.yml` checks out tripbook at `vars.TRIPBOOK_REF`, runs `npm ci --omit=dev` and `build-site.mjs`, and deploys `_site/` to Pages.
- The Release workflow needs the `DATA_REPO` variable and `DATA_REPO_TOKEN` secret (set by `scripts/setup-auto-release.sh`). Without them it still tags, and the run prints a notice.
- By hand: `scripts/release.sh <version>` (clean `main`, tests, tag, push, move the pin, rebuild).
- A schema change needs care: bump `SCHEMA_VERSION` only for breaking changes; optional new fields do not need it. A build refuses trips newer than it supports.

See [DEPLOY.md](DEPLOY.md) for the full setup. AI agents should also read [AGENTS.md](../AGENTS.md); [BUILD.md](BUILD.md) is the full spec.
