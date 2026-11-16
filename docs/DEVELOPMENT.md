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

## Tests

`node:test` with `node:assert`, no other test dependencies. GitHub and Google are never called: tests mock `fetch`, and the Places and Geocoder code is isolated in `src/editor/places.js` so it can be stubbed.

| File | Covers |
|---|---|
| `shared.test.js` | slugs, URL paths and collisions, schema rules (including `photo` and `off_route`), Google Maps links and limits, Markdown escaping, rating markup, numbering and visibility, formatting |
| `render.test.js` | the trip page: numbers, legs, notes, ratings, the low-rated switch, off-route stops, analytics only on published pages, escaping, share image, listing cards |
| `trip-md.test.js` | Markdown output, `llms.txt`, `llms-full.txt`, JSON-LD (no ratings, no dates) |
| `build-site.test.js` | a full site build: files, sitemap, robots, redirects, errors, and **no `.json` file in the output** |
| `build-editor.test.js` | the editor build: hashed bundle, `build.json`, service worker shell list, manifest, icons, demo data |
| `github.test.js` | the GitHub client (UTF-8 base64, conflicts, single-commit move), sync logic, and the fake client |
| `editing.test.js` | slug-follows-title, moving stops and sections, location autofill, "make guide from log" |
| `capture.test.js` | "Day N" placement and the local-midnight boundary, place and geocode mapping, coordinate parsing |
| `wikipedia.test.js` | the trip photo lookup |

## Code layout

```
src/
  shared/          used by both the site build and the editor
    schema.js        SCHEMA_VERSION, DEFAULT_CONFIG, validateTrip(), newTrip/newSection/newStop
    paths.js         tripPath(), listingPrefixes(), listingCrumbs(), findCollisions()
    visible.js       numbering and visibility (low-rated switch, off-route letters)
    maps-links.js    Google Maps URLs (shortlist, directions in chunks, per-stop)
    maps-loader.js   Google Maps JS bootstrap loader
    markdown.js      safe Markdown subset; stripMarkdown()
    rating.js, format.js, slug.js, wikipedia.js
    render/          pure HTML/text renderers: trip, listing, layout, trip-md, llms, jsonld, photo, redirect, icons
  site/            browser code of the public page: trip.js (map, bottom sheet, switch), site.css
  build/           build-site.mjs, build-editor.mjs, bundle.mjs (esbuild + content hashing)
  editor/          the PWA
    app/             Preact screens: Setup, Trips, TripEditor, Sections, StopCard, Capture, Settings, ...
    github.js        GitHub REST client        sync.js   sync, publish, conflicts
    store.js         localStorage + IndexedDB  demo.js   fake GitHub client
    places.js        Google Places/Geocoder    capture.js  "Day N" placement
    editing.js       trip edit operations      sw.js, manifest.webmanifest, icons/
templates/data-repo/ files copied into a new data repo (config, workflow, README)
examples/data/       sample data repo
scripts/             deploy scripts (see DEPLOY.md) and make-icons.mjs
.github/workflows/   editor.yml (test + deploy the editor), release.yml (automatic releases)
```

The site build and the editor's Preview call the same render functions in `src/shared/render/`, so what you preview is what gets published. The site build makes no network calls.

## Conventions

- Plain, readable JavaScript with ES modules. No TypeScript, no feature flags, no frameworks beyond Preact (editor only).
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
