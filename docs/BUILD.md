# BUILD.md — Tripbook

Build spec for an AI coding agent (Claude Sonnet 5.5 in VS Code Copilot, agent mode).
Build the whole project from this file without asking the user anything, except at the single stop point at the end of Phase 0.

This file describes the project **as it currently stands**, including everything added after the first version (off-route stops, trip photos, demo mode, `.env` support, automatic releases, the module layout of §4 and the performance work: inlined CSS, a self-hosted heading font, a lazily loaded map, editor code splitting). Following it produces the same structure, modules, behavior, tests and documentation; it does not reproduce the author's code byte for byte. Keep this file in sync whenever behavior changes.

---

## 0. Agent operating rules (read first, follow always)

1. Work phase by phase, in order. Do not start a phase until the previous phase's **Done when** checks pass.
2. Track progress with the git history: one commit per phase, titled `Phase N: <name>`. On every start, read `git log` and resume at the first phase without a commit. Do not create progress files in the repo.
3. Before starting a phase, re-read that phase's section of this file. Do not rely on memory of earlier sections.
4. Never ask the user questions after Phase 0. When something is unspecified, pick the simplest option that satisfies this spec and mention it in the commit message. If it is a lasting design choice, add it to §2 of this file.
5. Terminal commands must be non-interactive. Use `--yes`/`-y` flags. Never start a long-running process (dev server, watcher) in the foreground. Verify with builds and tests, not by watching a server.
6. Make no network calls to Google or GitHub in tests. Mock `fetch`.
7. After each phase: run `npm run check` (= `npm test && npm run build:example && npm run build:editor`, once they exist), fix failures, then `git add -A && git commit -m "Phase N: <name>"`.
8. Keep dependencies to the list in §3.
9. Write plain, readable code. Prefer one obvious way. No speculative abstractions, no feature flags, no TypeScript, no frameworks beyond §3.
10. Do not run any script in `scripts/` that needs the user's GitHub or Google credentials (`setup-editor-pages.sh`, `create-data-repo.sh`, `release.sh`, `setup-auto-release.sh`). Write them. The user runs them.

---

## 1. What we are building

A personal tool to log places visited on trips and to publish shareable trip logs and city guides.

- **Editor:** an installable PWA on its own domain (author's instance: `edit.trips.signorini.us`). It captures places on the phone ("Add place here"), edits and reorders on the desktop, and syncs JSON files to a private GitHub **data repo** via the GitHub REST API, authenticated with a fine-grained token stored on the device.
- **Site:** a static website of trips only (author's instance: `trips.signorini.us`), built by GitHub Actions in the data repo and deployed to GitHub Pages. Published trips are public. Drafts are built too, at unlisted URLs.
- **No backend.** GitHub is the database. Google Maps JavaScript API renders maps. Google Places API (New) powers place search in the editor.

### Two repositories, two sites

| | `tripbook` (this repo) | `trips` (data repo, one per user) |
|---|---|---|
| Visibility | public, MIT | private |
| Contains | editor, site build script, templates, data-repo template, scripts, docs | `config.json`, `drafts/*.json`, `published/*.json`, one workflow |
| Pages site | the **editor**, at e.g. `edit.trips.signorini.us` | the **trips site**, at e.g. `trips.signorini.us` |
| Deploys when | code is pushed to `main` | a trip or config changes, or a new tripbook release is selected |

- A code push redeploys the editor. It changes the trips site only through a release (below).
- tripbook must be **public**: the data repo's workflow checks it out with its own `GITHUB_TOKEN`, which cannot read another private repo.
- The trips site is built from a **pinned tripbook release** (git tag), named by the data repo's variable `TRIPBOOK_REF`. `scripts/release.sh` tags a release, updates that variable and triggers a rebuild. Template changes reach the site only through a release.
- **Automatic releases:** `.github/workflows/release.yml` runs on every push to `main` that changes site-building code (§9.3). It tags the next patch version and, if the secret `DATA_REPO_TOKEN` and variable `DATA_REPO` are set (by `scripts/setup-auto-release.sh`), moves the data repo's pin and rebuilds the site.
- The editor is generic: on first run the user enters which data repo to use. Nothing is hardcoded to `signorini.us` or to an owner.
- **Version skew guard:** trips carry `"v"` (schema version). The site build refuses trips with a newer schema than it supports, with a message telling the user to run `scripts/release.sh`.

---

## 2. Decisions already made (do not revisit)

- **Domains** come from configuration: the site's from `config.json` `base_url` and the data repo's Pages settings; the editor's from the tripbook repo's Pages settings. Nothing is hardcoded.
- **Folders:** trips live in `drafts/<id>.json` or `published/<id>.json` at the data repo root. Folder = status. File name = trip `id` (stable forever).
- **Notes:** a trip has an overall `note`, each section has a `note`, each stop has a `note`. All three are Markdown and appear in the interface (§7).
- **Ratings:** each stop has an optional `rating`, an integer 1–5. Shown on the site as one compact star filled in proportion plus a small `(4/5)` (§7.8). The editor's input uses five tappable stars.
- **Low-rated places** (rating 1–2): a switch on the trip page shows or hides them (§7.9). Default: hidden on `guide` pages, shown on `log` pages. The editor always shows everything.
- **Off-route places:** in a `route` section a stop can be marked `off_route`: a recommended place that is not on the walking path. It is lettered (A, B, C…) instead of numbered and excluded from the route line, legs and route links (§7.9a).
- **Trip photo:** optional `photo`, picked in the editor from a Wikipedia article's lead image with its licence. Used only for sharing (`og:image`, `twitter:image`, JSON-LD) and listing-card thumbnails, with credits (§7.6).
- **URLs:** `/<country>/<region?>/<city?>/<slug>/`. Region and city are optional. Examples: `/italy/pisa/4-hours-layover/`, `/usa/california/santa-barbara/perfect-day/`. Drafts: the same path under `/drafts/`, e.g. `/drafts/italy/pisa/4-hours-layover/`. When a trip is published, its draft URL simply disappears.
- **Drafts** are built and deployed with `<meta name="robots" content="noindex">`. They are excluded from the index, the listing pages and the sitemap.
- **Privacy:** never render dates or times anywhere on the public site: no visit times, no "updated" stamps, no sitemap `lastmod`. `captured_at`, `created_at` and `updated_at` exist in the JSON only.
- **Only the build output is served.** The data repo's workflow uploads `_site/` alone. `config.json`, `drafts/*.json`, `published/*.json` and the workflow are never published. A test enforces it.
- **LLM-friendly output:** every published trip also has a Markdown version, plus `/llms.txt` and `/llms-full.txt`, and JSON-LD on each trip page (§7.10). Drafts get none of these.
- **Index:** published trips grouped by country, then region, alphabetical. Nothing "live".
- **Trip kinds:** `guide` (a recommendation) and `log` (a record of a trip). One schema and one template for both.
- **Sections** have `style: "route"` (numbered path, legs, directions link), `style: "poi"` (numbered pins, no path, legs or directions link) or `style: "list"` (pins only). A route or poi section may also set an optional `prefix` for its stop labels (`B` gives B1, B2…).
- **Stops store everything** (name, address, city, region, country, coordinates), filled from Google at capture time and fully editable afterwards. The build makes no API calls.
- **Markdown:** a small subset (paragraphs, links, bold, italic, lists) for all notes. Raw HTML is escaped.
- **Language:** one `lang` per trip (default `"en"`).
- **Analytics:** optional Google Analytics 4. When `config.google_analytics_id` is set, the gtag snippet goes on published trip pages and listing pages only, never on drafts or the editor.
- **Editor buttons:** **Sync** (commit to the current folder) and **Publish** / **Unpublish** (move between folders in one commit; Publish of a never-synced or dirty draft writes the file to `published/` and removes the draft in that same commit, so CI runs once). Conflicts: if the file changed elsewhere, show *Load theirs* / *Overwrite*. No merging.
- **Auto sections while logging:** captures into a `log` trip go into the section for today's local date, created on demand and titled "Day N", renamable.
- **Nearby search:** Places Nearby Search, 75 m radius, 10 results, ranked by popularity, plus a text search box and "Drop pin at my location".
- **Delete:** confirm dialog, then delete the file. Git history is the undo.
- **DNS:** both domains are CNAME records to `<owner>.github.io`, **DNS only** (no Cloudflare proxy), so GitHub can issue and renew certificates (§10, docs).
- **Code layout for agents:** small modules with one job each, in folders whose names say what is inside (§4): the editor splits UI (`screens/`, `components/`) from state (`state/`) and pure logic (`core/`); the trip page script is one module per concern (`src/site/trip/`). CSS is one declaration per line, grouped by component, and each group's header names the renderer or component that emits the markup. Data shapes are JSDoc `@typedef`s in `src/shared/schema.js` (no TypeScript).
- **Performance:** public pages inline their CSS (no render-blocking stylesheet request) and preload one self-hosted font file; nothing render-blocking comes from third parties; the map starts after the first paint; the mobile sheet moves with `transform`; the editor loads SortableJS and the Preview renderer (with `marked`) as lazy chunks and re-renders only the stop cards that changed.
- **Devcontainer** for all development.
- **Local `.env`** (git-ignored) holds the author's deploy settings so scripts need no flags: `EDITOR_DOMAIN`, `SITE_DOMAIN`, `DATA_REPO` (owner optional), `MAPS_KEY`, `MAP_ID`, `AUTHOR`. Environment variables win over `.env`; flags win over both. `.env.example` is committed.
- **Demo mode:** on localhost the editor can run against a fake GitHub kept in `localStorage`, seeded from the example data (§8.9).
- **Small lasting choices:** `npm test` is `node --test "test/*.test.js"` (Node 24 rejects a bare directory); `buildSite()` and `buildEditor()` are exported so tests call them directly; the Maps loader lives in `src/shared/maps-loader.js` for both site and editor; colors that JavaScript needs (map pins, star input) come from `src/shared/theme.js`, which mirrors `src/shared/tokens.css`; `directionsUrl` always returns an array; the service worker only skips waiting when the page posts `skip-waiting` (the "Update available" toast); `github.js` treats any 409, and a 422 whose message mentions `sha` or `does not match`, as a conflict; `getFile` returns `{ data, sha }` (or `null` on 404) and `putFile` returns the new sha; trip records carry an `auto_sync` flag, set after the first Sync, so automatic retries only touch trips the user has synced; editor screens render only after local data has loaded (`ready` signal); `renderMarkdown` turns headings into bold paragraphs and drops images and unsafe link schemes; LICENSE holder is "Alessio Signorini".

---

## 3. Stack

One language (JavaScript) for the site build and the editor, so rendering code is shared. The site build and the editor's preview call the same render functions.

- **Runtime:** Node 24 LTS, ES modules everywhere (`"type": "module"`).
- **Editor UI:** Preact + htm + @preact/signals. No JSX compile step; htm tagged templates. Bundled by esbuild.
- **Drag and drop:** SortableJS.
- **IndexedDB:** idb-keyval.
- **Markdown:** marked.
- **Bundler:** esbuild (JS API, called from the build scripts); code splitting for the editor's lazy chunks; CSS `@import` and font files resolved by esbuild.
- **Tests:** `node:test` + `node:assert` (built in).
- **Photos:** Wikipedia and Wikimedia Commons APIs, called from the editor only (`src/shared/wikipedia.js`).
- **Static server for local preview:** sirv-cli (dev dependency).
- **Icons:** sharp (dev dependency, used once by `scripts/make-icons.mjs`; the PNGs are committed).
- **Fonts:** body text uses the system UI stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). Headings on the public site use **Space Grotesk 700**, self-hosted: the Latin and Latin-ext `woff2` subsets from Google Fonts are committed in `src/site/fonts/` with the SIL OFL licence (`OFL.txt`). No Google Fonts requests. The editor uses the system stack only.
- **Maps:** Google Maps JavaScript API via the official dynamic bootstrap loader (inline snippet), `importLibrary("maps" | "marker" | "places" | "geocoding")`. Advanced Markers with `PinElement`. Map ID from config (`"DEMO_MAP_ID"` as default).

Dependencies (exact list):
- `dependencies`: `preact`, `htm`, `@preact/signals`, `sortablejs`, `idb-keyval`, `marked`, `esbuild`
- `devDependencies`: `sirv-cli`, `sharp`

`esbuild` is a runtime dependency because the data repo's workflow runs the site build after `npm ci --omit=dev`.

---

## 4. Repository layout (`tripbook`)

```
.devcontainer/devcontainer.json
.github/workflows/editor.yml   test, build, deploy the editor (§9.1)
.github/workflows/release.yml  tag a release when site-building code changes (§9.3)
AGENTS.md                      short guide for AI agents working on the project (commands, layout, rules)
README.md                      short public intro with screenshots (§13 Phase 7)
LICENSE                        (MIT)
.env.example                   keys read by scripts/ (§10)
docs/BUILD.md                  this file; keep it in sync with behavior
docs/DEPLOY.md                 step-by-step setup guide
docs/DEVELOPMENT.md            local development, tests, layout, releases
docs/DATA-MODEL.md             trip/config JSON, URLs, privacy
docs/images/                   trip-desktop.jpg, trip-mobile.jpg (README screenshots)
package.json
src/
  shared/                 used by the site build, the trip page script and the editor
    schema.js             JSDoc typedefs (Trip, Section, Stop, Photo, Location, TripRecord, Config); SCHEMA_VERSION;
                          DEFAULT_CONFIG; mergeConfig(); validateTrip(trip, file) -> string[]; newTrip(); newSection(); newStop()
    slug.js               slugify(text)
    paths.js              tripPath(trip, config, {draft}); listingPrefixes(trip, config); listingCrumbs(); findCollisions()
    maps-links.js         directionsUrl(stops) -> string[]; routeLinks(stops) -> [{url,label}]; stopDirectionsUrl(stop); openInMaps(routeStops)
    maps-loader.js        loadMaps(key) -> importLibrary: Google Maps JS bootstrap loader (site and editor)
    markdown.js           renderMarkdown(text) with HTML escaped; stripMarkdown(text, max)
    format.js             formatMinutes, sectionLetter, totalMinutes, escapeHtml, locationText, shortAddress, kindLabel, plural
    rating.js             renderStarCompact(rating), isLow(stop)
    visible.js            visibleStops(trip, {showLow, showOffRoute}) -> SectionEntry[] (numbering, off-route letters, counts, minutes); allVisible()
    wikipedia.js          findWikipediaPhoto(title, fetchImpl) -> trip.photo object | null
    theme.js              COLORS and STAR_PATH for JavaScript (mirror of tokens.css)
    tokens.css            CSS custom properties (colors, radius, fonts), @imported by site.css and editor.css
    render/               pure functions returning strings; the editor's Preview calls the same ones
      layout.js           renderLayout(opts): page shell (head, inlined CSS or link, font preload, preconnect, analytics, noindex)
      trip.js             renderTripPage(trip, ctx); tripClientData(trip); CLIENT_STOP_FIELDS
      listing.js          renderListing(items, ctx) (index + prefix pages); groupTrips(); sortedTrips()
      redirect.js         renderRedirect(toUrl)
      seo.js              renderRobots(config), renderSitemap(paths, config), AI_AGENTS
      trip-md.js          renderTripMarkdown(trip, ctx) -> Markdown string (§7.10)
      llms.js             renderLlmsTxt(trips, ctx), renderLlmsFull(trips, ctx)
      jsonld.js           tripJsonLd(trip, ctx) -> JSON string
      photo.js            photoCredit(photo) -> credit line HTML
      icons.js            inline SVG icons for the site
  build/
    bundle.mjs            bundleJs / bundleCss (esbuild) + content hashing
    cli.mjs               isMain, arg, flag, run, usage for the two CLIs
    build-site.mjs        buildSite(); CLI: --data <dir> --out <dir>   (run by the data repo)
    build-editor.mjs      buildEditor(); CLI: --out <dir> [--demo]     (run by this repo)
  site/                   the public trip page in the browser
    index.js              listing-page script: Google map with one pin per trip (links to the trip)
    site.css              all site styles (listing and trip pages)
    fonts/                space-grotesk-700-latin.woff2, space-grotesk-700-latin-ext.woff2, OFL.txt
    trip/
      main.js             entry: reads #trip-data, wires the modules, switches, selection, share, locate
      dom.js              $, $$, MOBILE_QUERY/mobile, rafThrottle, afterFirstPaint, toast
      prefs.js            persistedFlag(key, fallback): switch state in localStorage
      list.js             createList(): applies visibleStops() to rows, legs, badges, totals and Maps links
      sheet.js            createSheet(): mobile bottom sheet (snaps, drag)
      clamp.js            watchClamps(): More/Less for 3-line notes on mobile
      map.js              createMapView(): Google map, reusable markers, route lines, fit, location dot
  editor/
    index.html            shell with {{CSS}} and {{JS}} placeholders
    main.js               entry: global listeners, render <App>, init(), service worker, conflict handler
    App.js                header, update banner, hash-route screen switch, modal and toast hosts
    editor.css
    sw.js                 service worker (scope /)
    manifest.webmanifest
    icons/                icon.svg, icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
    screens/              Setup.js, Trips.js, TripEditor.js, Capture.js, Settings.js
    components/           html.js (htm binding), controls.js (memo, AutoTextarea, StarInput, Menu, Field, Chips,
                          CountryList), overlays.js (Toasts, ModalHost), Sections.js, StopCard.js, PhotoField.js,
                          MapPicker.js, Conflict.js
    state/                Preact signals and the actions that change them (§8.10); index.js re-exports all
      signals.js          settings, trips, configRec, config, toasts, modal, busy, buildInfo, syncErrors, updateReady, ready, dirtyCount
      router.js           route, parseHash, navigate
      ui.js               toast, dismissToast, showModal, closeModal, confirmDialog
      connection.js       isConfigured, gh, saveConnection, updateSettings, setActive
      records.js          saveRecord, removeRecord, updateTrip, structural, newTripAndOpen, flushPendingSaves, recoverUnsaved
      actions.js          init, refresh, doSync, doPublish, doUnpublish, doDiscardLocal, doDelete, autoRetry, registerConflictHandler
      site-config.js      pushConfig, pullConfig, rebuildSite
      pwa.js              registerServiceWorker, applyUpdate
    core/                 no UI; unit-tested
      github.js           GitHub REST client
      sync.js             sync, publish, unpublish, delete, conflict resolution, pull; newRecord, stopCount
      store.js            IndexedDB + localStorage persistence (settings, trip records, config, unsaved-edit stash)
      demo.js             fake GitHub client + sample-data seeding (§8.9)
      editing.js          pure trip edit operations (setTitle, findStop, add/move/delete section and stop,
                          autofillLocation, makeGuide) and reuseUnchanged (structural sharing)
      places.js           Google Places / Geocoder helpers, geolocation, parseCoordinates
      capture.js          "Day N" section logic, captured_at, capture trips
      countries.js        ISO country list via Intl.DisplayNames; countryByName
templates/
  data-repo/
    README.md
    config.json
    drafts/.gitkeep
    published/.gitkeep
    .github/workflows/site.yml
examples/
  data/
    config.json
    published/pisa-in-one-walk.json
    published/santa-barbara-perfect-day.json
    drafts/pisa-4-hours-layover.json
scripts/
  lib.sh                  shared helpers: load_env, normalize_repo
  setup-editor-pages.sh
  create-data-repo.sh
  release.sh
  setup-auto-release.sh
  make-icons.mjs
test/
  fixtures.js             load(), pisa(), sb(), layover(): fresh copies of the example trips
  *.test.js               one file per module or area (§12)
```

`package.json` scripts:

```json
{
  "test": "node --test \"test/*.test.js\"",
  "check": "npm test && npm run build:example && npm run build:editor",
  "build:example": "node src/build/build-site.mjs --data examples/data --out _site",
  "build:editor": "node src/build/build-editor.mjs --out _editor",
  "build:editor:demo": "node src/build/build-editor.mjs --out _editor --demo",
  "serve": "sirv _site --port 8080 --dev --host",
  "serve:editor": "sirv _editor --port 8081 --dev --host --single",
  "icons": "node scripts/make-icons.mjs"
}
```

`.gitignore`: `node_modules/`, `_site/`, `_editor/`, `.env`.

---

## 5. Data model

### 5.1 Trip (`drafts/<id>.json` or `published/<id>.json` in the data repo)

```json
{
  "v": 1,
  "id": "3f6c2a1e-8b1d-4c39-9a51-2d0e8f7b6c44",
  "slug": "pisa-in-one-walk",
  "kind": "guide",
  "title": "Pisa in one walk: from the station to the Leaning Tower",
  "note": "Arriving by train? This route takes you north through the old town.",
  "lang": "en",
  "location": { "country": "Italy", "country_code": "IT", "region": "", "city": "Pisa" },
  "photo": null,
  "old_paths": [],
  "sections": [
    {
      "id": "s-1",
      "title": "",
      "note": "",
      "style": "route",
      "prefix": "",
      "auto_date": null,
      "stops": [
        {
          "id": "p-1",
          "place_id": null,
          "name": "Pisa Centrale",
          "address": "Piazza della Stazione, Pisa",
          "city": "Pisa",
          "region": "Toscana",
          "country": "Italy",
          "country_code": "IT",
          "lat": 43.7085,
          "lng": 10.3984,
          "coords_source": "place",
          "minutes": null,
          "leg_to_next": "3 min walk",
          "note": "Start here if you arrive by train.",
          "rating": null,
          "off_route": false,
          "captured_at": null
        }
      ]
    }
  ],
  "created_at": "2026-11-15T10:00:00Z",
  "updated_at": "2026-11-15T10:00:00Z"
}
```

Field rules (implement in `validateTrip`; the site build fails with a clear message listing file and errors):

- `v`: integer ≥ 1. If `v > SCHEMA_VERSION`, the error is exactly: `<file>: uses schema v<v>, this tripbook release supports v<SCHEMA_VERSION>. Run scripts/release.sh to update the site build.` `SCHEMA_VERSION` is `1`.
- `id`: non-empty string (editor uses `crypto.randomUUID()`). Must equal the file name without `.json`.
- `slug`: `^[a-z0-9]+(-[a-z0-9]+)*$`. The editor auto-derives it from the title until the user edits it.
- `kind`: `"guide" | "log"`.
- `title`: non-empty.
- `note`: string (may be empty). The trip's overall note.
- `lang`: BCP-47-ish string, default `"en"`.
- `location.country`: non-empty. `country_code`: 2 uppercase letters or empty. `region` and `city`: strings, may be empty.
- `photo`: optional; `null` or `{ url, thumb, title, author, license, license_url, source_url }`, all strings, `url`, `thumb`, `license_url` and `source_url` must be `https://` (empty allowed for the license fields).
- `old_paths`: array of strings starting and ending with `/`.
- `sections`: array (may be empty for a new trip). Section `id` unique within trip. `title`: string (may be empty). `note`: string (may be empty). `style`: `"route" | "poi" | "list"`. `prefix`: optional string of 0–3 letters/digits (default none). `auto_date`: `YYYY-MM-DD` or null (editor-only, never rendered).
- Stop `id` unique within trip. `name`: non-empty. `lat` in [-90, 90]; `lng` in [-180, 180]. `place_id`: string or null. `coords_source`: `"device" | "place" | "pin"`. `minutes`: positive integer or null. `leg_to_next`: string or null. `note`: string (may be empty). `rating`: integer 1–5 or null. `off_route`: optional boolean (only meaningful in `route` sections). `captured_at`: ISO string or null.
- Unknown fields: allowed and preserved (forward compatibility).
- Declare these shapes as JSDoc `@typedef`s at the top of `schema.js` (`Location`, `Photo`, `Stop`, `Section`, `Trip`, `TripRecord` (§8.1), `Config`) and reference them with `@param`/`@returns` in `visible.js`, the renderers and `src/editor/core/`.

### 5.2 `config.json` (data repo root)

```json
{
  "site_title": "Trips",
  "author": "Alessio",
  "intro": "",
  "base_url": "https://trips.signorini.us",
  "google_maps_api_key": "",
  "google_maps_map_id": "DEMO_MAP_ID",
  "google_analytics_id": "",
  "time_presets": [10, 30, 45, 60],
  "nearby_radius_m": 75,
  "nearby_max_results": 10,
  "default_kind": "log",
  "default_lang": "en",
  "country_slugs": { "US": "usa", "GB": "uk", "AE": "uae" },
  "ai_crawlers": "allow"
}
```

`intro`: optional Markdown shown under the title on the index page only (editor Settings).

`ai_crawlers`: `"allow"` or `"disallow"` (§7.10).

All fields are optional; the site build and the editor fall back to these defaults (define them once in `src/shared/schema.js` as `DEFAULT_CONFIG`). The Maps API key is a browser key restricted by HTTP referrer, so it is not a secret. The editor reads this file from the data repo through the API and caches it on the device.

### 5.3 URL paths (`src/shared/paths.js`)

- `slugify(text)`: NFKD normalize, strip combining marks, lowercase, replace runs of non `[a-z0-9]` with `-`, trim `-`.
- Country segment: `config.country_slugs[location.country_code]` if present, else `slugify(location.country)`.
- Path = `/` + [country, slugify(region) if non-empty, slugify(city) if non-empty, slug].join(`/`) + `/`.
- Draft path = `/drafts` + path.
- `listingPrefixes(trip)` returns each proper prefix: `/italy/`, `/italy/pisa/`, or `/usa/`, `/usa/california/`, `/usa/california/santa-barbara/`.
- The site build fails if two published trips, or two drafts, resolve to the same path. Error names both files.
- When the editor syncs a **published** trip whose computed path differs from the path at last sync, it appends the old path to `old_paths` (no duplicates). The site build writes a redirect page at each old path, unless the old path collides with a live trip path, which wins.

---

## 6. Build scripts

A full rebuild every run is intended. No incremental logic.

`src/build/bundle.mjs` wraps esbuild (`bundle: true`, `minify: true`, `write: false`, `logLevel: 'silent'`):
- `bundleJs(entry, outDir, baseName, { splitting })`: ESM, target es2020. With `splitting: true`, dynamic `import()` targets become chunks in `chunks/` (`chunkNames: 'chunks/[name]-[hash]'`).
- `bundleCss(entry, outDir, baseName, { publicPath, emitEntry })`: inlines `@import`s; `.woff2` files referenced with `url()` are copied next to the CSS as `<name>-<hash>.woff2` (`loader: { '.woff2': 'file' }`, `assetNames: '[name]-[hash]'`); `publicPath` makes those URLs absolute (`/assets`, `/preview`). With `emitEntry: false` the CSS file itself is not written (the caller inlines it).
- The entry file is written as `<baseName>.<hash>.<ext>`, hash = first 8 hex chars of SHA-256 of its content; every other output keeps esbuild's name. Both return `{ name, text, files }` (entry file name, entry contents, written paths).

`src/build/cli.mjs`: `isMain(import.meta.url)` (run the CLI only when the file is the entry point), `arg(name)`, `flag(name)`, `run(promise)` (print only the error message and exit 1), `usage(text)` (exit 2).

### 6.1 Site build (`src/build/build-site.mjs`)

Input: `--data <dir>` (contains `config.json`, `drafts/`, `published/`), `--out <dir>`.

Steps:
1. Empty `--out`.
2. Load config, merge over `DEFAULT_CONFIG`.
3. Load all trips. Validate. Collect all errors across all files, print them, exit 1 if any.
4. Check path collisions (§5.3).
5. Bundle `src/site/trip/main.js` → `assets/trip.<hash>.js`. Bundle `src/site/site.css` with `publicPath: '/assets'` and `emitEntry: false`: the fonts land in `assets/` as `space-grotesk-700-latin-<hash>.woff2` and `space-grotesk-700-latin-ext-<hash>.woff2`, and the CSS text is passed to every page as `assets.cssText` (inlined, §7.7) with `assets.font` = the Latin font URL (preloaded). No `.css` file is written.
6. Render each published trip to `<path>/index.html`. Render each draft to `/drafts<path>/index.html` with `noindex`.
7. Render listing pages from published trips only: `/index.html` (all) and every listing prefix (`/italy/index.html`, `/usa/california/index.html`, …).
8. Render redirects for `old_paths`.
   Each listing groups trips in collapsible `<details>` (country, then region, with counts; open by default). With several countries it also shows a country list (`All` plus one button per country with its trip count); choosing one shows only that country's trips and, with `google_maps_api_key`, fades the other pins and fits the map to it (`#<Country>` in the URL). The map has one small pin per trip at the mean of its stops (`tripPins()`, data in `#trip-pins`). Script: `src/site/index.js`. Desktop (≥ 900 px): left column = portrait map above the country list (sticky), right column = trips; mobile: no map (Google Maps is not loaded), country chips, then trips. Hovering or focusing a trip card highlights its pin (and vice versa). On the root index the `intro` Markdown replaces the author byline.
9. Write `404.html` through `renderLayout` (title `Not found · <site_title>`, `noindex`, no Open Graph tags, inlined CSS, body `<main class="listing"><h1>Page not found</h1><p><a href="/">Back to all trips</a></p></main>`), `robots.txt` (`renderRobots`, §7.10) and `sitemap.xml` (`renderSitemap`: listing URLs then published trip URLs, absolute with `base_url`, **no `lastmod`**), both from `src/shared/render/seo.js`.
10. For each published trip, write `<path>/index.md` (§7.10). Write `/llms.txt` and `/llms-full.txt` from published trips only.
11. Never copy anything from `--data` into `--out`. Only rendered files and bundled assets go into the output.
12. Every page gets `<meta name="generator" content="tripbook <package.json version>">`.
13. Print a summary: counts of published, drafts, listing pages, redirects, Markdown files.

### 6.2 Editor build (`src/build/build-editor.mjs`)

Input: `--out <dir>`. Output is the root of the editor site.

Steps:
1. Empty `--out`.
2. Bundle `src/editor/main.js` → `app.<hash>.js` with `splitting: true` (lazy chunks for SortableJS and the Preview renderer, plus shared chunks, in `chunks/`), and `src/editor/editor.css` → `editor.<hash>.css`.
3. Bundle the site assets for Preview: `preview/trip.<hash>.js` (from `src/site/trip/main.js`) and `preview/site.<hash>.css` (from `src/site/site.css`, written as a file, with `publicPath: '/preview'` so its fonts load from `preview/`).
4. Copy `index.html` with the hashed names injected, `manifest.webmanifest`, `icons/`.
5. Write `build.json`: `{ version, commit, preview: { trip_js, site_css } }`. `version` from `package.json`; `commit` = first 7 chars of `GITHUB_SHA`, else `git rev-parse --short HEAD`, else `"dev"`.
6. Write `sw.js` with `CACHE_VERSION` = `tripbook-` + hash of all output file names, and `SHELL` = `/` plus every output file except `sw.js`, `404.html`, `*.map` and `demo/` (so `build.json`, the lazy chunks, the preview assets and fonts are all precached).
7. Write `404.html` that redirects to `/` (the editor uses hash routes).
8. With `--demo` (`npm run build:editor:demo`): also write `demo/data.json` (config, published and draft trips from `examples/data`) used by §8.9. It is never added to the service-worker shell list. The deployed editor is built without `--demo`.
9. `buildEditor({ out, demo, log })` and `buildSite({ data, out, log })` are exported; the CLI runs only when the file is the entry point (`isMain` from `cli.mjs`).

---

## 7. Public site

### 7.1 Visual design tokens (from the approved mockups)

- Fonts: system UI stack for text; Space Grotesk 700 for headings, the stop badge and the mobile title (self-hosted, §3). `@font-face` rules at the top of `site.css` (`font-display: swap`, the Google Fonts `unicode-range` for each subset).
- Colors: ink `#1A1D21`, body text `#2F3337`, secondary `#5F6368`, border `#E4E6E1`, input border `#C9CCC6`, switch track and empty star `#D3D6D0`, surface `#F1F2EF`, editor section background `#FAFAF8`, page `#FFFFFF`, accent (pins, route) `#C2410C`, accent text on white `#9A3412`, selected-row tint `#FBEFE9`, location dot `#1A73E8`, danger `#B91C1C`, ok `#166534` on `#DCFCE7`, warning `#78350F` on `#FDE68A`, publish `#1A7F37`.
- All of these are CSS custom properties in `src/shared/tokens.css`, `@import`ed by `site.css` and `editor.css` (no color literals elsewhere except white/black and shadows). `src/shared/theme.js` exports the few JS needs (`COLORS.accent`, `ink`, `muted`, `track`, `white`, and `STAR_PATH`).
- CSS style: one declaration per line; rules grouped by component in page order; each group's comment names the renderer function or component that emits the markup (e.g. `/* stopRow */`); media queries sit inside their component's group. Breakpoint: desktop ≥ 900 px, mobile ≤ 899.98 px (`MOBILE_QUERY` in `src/site/trip/dom.js` must match). Hover styles only inside `@media (hover: hover)` so they do not stick after a tap.
- Radius 10–16 px; touch targets ≥ 44 px; visible focus rings; text contrast ≥ 4.5:1.
- Icons: inline stroke SVG, no emoji, no icon font.

### 7.2 Trip page — desktop (≥ 900 px)

- **Header:** kicker (`Guide · Pisa, Italy`, `Trip log · Maui, Hawaii`; drafts are prefixed `Draft · `; location = city, region, country, skipping empty parts), H1 title, and the trip `note` (Markdown). The buttons **Open in Google Maps** (primary; §7.5) and **Share** (`navigator.share`, fallback: copy the URL and show a toast) sit at the top right of the header. There is no "By …" line and no meta row.
- **Stats:** a gray `(N stops · About 3 h)` is appended at the end of the trip note for single-section trips (updates with the low-rated switch). Multi-section trips show the count and time in each section header instead.
- **Body:** two columns. Left: map, sticky, height `calc(100vh - 32px)`, min 520 px. Right (list column, 100 px wider than the first design): the low-rated switch (§7.9), then the stop list. **There are no section tabs**: every section is shown inline, one after another.
- **Stop row:** number badge (`3`, or `A3` when the trip has more than one section), name (H3), the time pill (`20 min`, `1 h 30 min`; omitted if null) right after the name, then one line with the compact rating (one proportional star + `(4/5)`, §7.8) to the left of the address (secondary text), then the stop note (Markdown). Title, stars and address are tightly spaced. Between consecutive visible stops in a `route` section, a dotted connector with `leg_to_next` text if present. A small directions icon (no text) links to `stopDirectionsUrl` (§7.5).
- **Section header** (shown when the trip has more than one section or the section has a title): `B · Lahaina` (the section `prefix`, only when set), a `Show only this` button, stop count, total time, and for `route` sections the **Route in Google Maps** link. Below it, the section `note` (Markdown) when non-empty.
- Hover or focus on a stop row highlights its pin. Click on a pin scrolls to and highlights the row. Clicking a row selects it (tint) and highlights its pin.
- Separators in text are `·`.

### 7.3 Trip page — mobile (< 900 px) — "Layout B"

The reader is on the ground. No editing or sharing chrome.
- Full-screen map behind everything.
- **Top floating card** (left): title (one line, ellipsis) and `By <author> · about <total>`. **Top-right**: one 52 px icon-only button, `aria-label="Open in Google Maps"`, linking per §7.5.
- **Blue location dot** via `navigator.geolocation.watchPosition`, only after the user taps the "locate" button (never prompt on load).
- **Bottom sheet** (`#sheet`, `src/site/trip/sheet.js`) with drag handle and three snap points showing 28 %, 55 % and 90 % of the viewport. The sheet is always `90dvh` tall and slides with `transform: translateY()` (CSS starts it at `translateY(62dvh)`, the 28 % snap, so there is no jump when the script runs); dragging and snapping never change its height, so the list is not re-laid-out per frame. After each snap the scroll area gets `padding-bottom: 32px + hidden part` so the last stop can be scrolled into view. Pointer-events drag on the top strip (`.sheet-top`, `touch-action: none`), with move/up listeners attached only during a drag; snap to nearest on release; the handle is a button that cycles snap points (a click that ends a drag is ignored). Re-snap on viewport resize and when crossing the breakpoint. `.sheet-scroll` has `overscroll-behavior: contain` (no pull-to-refresh or page scroll chaining).
- Inside the sheet: the switches (§7.9, §7.9a), then the trip note (`.m-note`), then the sections and stops. The trip note and section notes are clamped to 3 lines (`.clamp`); `src/site/trip/clamp.js` adds a **More**/**Less** button after each one that overflows, re-checking with a `ResizeObserver` (no `resize` listener; reads before writes). Desktop never clamps.
- **Rows** show the number badge, name, time, and compact rating placed to the left of the address or note. The rating star is floated so wrapped text runs under it. Instead of the full address, mobile shows the stop note, or, when there is no note, the **short address** (`shortAddress()`: street only, dropping city, region, country and postal parts). Both `.addr-full` and `.addr-short` are in the HTML and toggled by a media query. A 44 px directions icon button is on each row. Tapping a pin selects its stop, scrolls the sheet to it and raises the sheet to half if at peek.
- Hide the header share button and the desktop "Open in Google Maps" button on mobile.

### 7.4 Trip page script (`src/site/trip/`)

- `main.js` is the entry. It reads `#trip-data`, creates the list (`list.js`), the sheet (`sheet.js`) and the clamps (`clamp.js`), binds the switches and row events, then calls `update()`: `visibleStops(data, { showLow, showOffRoute })` → `list.render(results)` and `mapView.render(results)`; `body.hide-stars` is set when the low-rated switch exists and is off. `select(id)` tints the row and highlights the pin; tapping a row or pin on mobile raises the sheet from peek to half.
- Trip data is embedded in the page as `<script type="application/json" id="trip-data">` built by `tripClientData(trip)` in `render/trip.js`: `id`, `kind`, and per section `id`, `prefix`, `title`, `style` and `stops` with only the fields in the exported `CLIENT_STOP_FIELDS` = `id`, `name`, `lat`, `lng`, `place_id`, `rating`, `minutes`, `off_route` (only when `true`; `undefined` values dropped). The script and the shared code it calls (visibility, totals, Maps links) must read nothing else; tests check both directions (§12). **No dates.** Escape `<` as `\u003c`.
- The Maps key and Map ID are injected as `data-maps-key` / `data-map-id` on `<body>`. If the key is empty, show a placeholder box: "Map unavailable: add google_maps_api_key to config.json". When a key is set, the page has `<link rel="preconnect">` to `https://maps.googleapis.com` and `https://maps.gstatic.com`. `initMap()` runs after the first paint (`requestAnimationFrame` then `setTimeout 0`); on failure, toast "Map failed to load".
- `map.js` `createMapView({ el, apiKey, mapId, center, onMarkerClick, bottomPadding })`: `Map` with `zoom 13`, `disableDefaultUI`, `zoomControl` on desktop only, `gestureHandling: 'greedy'`. Advanced Markers with `PinElement` (`background #C2410C`, `borderColor #FFFFFF`, `glyph` = label, `glyphColor #FFFFFF`); a selected or hovered pin is `#1A1D21` and scaled 1.3, and the selected one gets `zIndex 10`. **Off-route pins** are white with a gray outline and a gray glyph (letter). **Markers are created once per stop and reused:** `render()` toggles `marker.map` for visibility and repaints a pin only when its label or off-route state changed; `highlight(id)` repaints only the previous and the new selection; `hover(id, on)` repaints one pin. Route lines are recreated on each render.
- `route` sections: a dashed `Polyline` (straight segments, accent color, `strokeOpacity 0` with a repeating `M 0,-1 0,1` icon every 14 px) through the visible, on-route stops in order. `poi` and `list` sections: no line.
- Fit bounds to all visible markers with padding `{ top 60, left 40, right 40, bottom 40 }`; on mobile, bottom = visible sheet height of the current snap + 20. One marker: zoom 15.
- **Locate** (mobile button): `navigator.geolocation.watchPosition` (high accuracy) starts on the first tap and draws a `.loc-dot` Advanced Marker via `mapView.showLocation(pos)`; on error toast "Location unavailable".
- **Share** (desktop): `navigator.share({ title, url })`, else copy the URL and toast "Link copied".
- Markers, lines, numbers and links always follow the switches (§7.9).

### 7.5 Google Maps links (`src/shared/maps-links.js`)

- `directionsUrl(stops)`: `https://www.google.com/maps/dir/?api=1&origin=<lat,lng>&destination=<lat,lng>&waypoints=<lat,lng>|…&travelmode=walking`; add `origin_place_id`, `destination_place_id`, `waypoint_place_ids` (pipe-separated, aligned with waypoints) when every relevant stop has a `place_id`. Always returns an **array**: `[]` for fewer than 2 stops, one URL for up to 11 stops (9 waypoints), more when split, each chunk sharing its first stop with the previous chunk's last stop. Keep each URL ≤ 2048 characters (drop place_id params if needed to fit).
- `routeLinks(stops)`: `[{ url, label }]` from `directionsUrl`, labelled `Route in Google Maps`, or `Part 1`, `Part 2`… when split. The renderer and `src/site/trip/list.js` both use it.
- `stopDirectionsUrl(stop)`: `https://www.google.com/maps/dir/?api=1&destination=<lat,lng>&travelmode=walking` plus `destination_place_id` if present.
- **Open in Google Maps** button: `openInMaps(routeStops)` over all visible on-route stops: the first `directionsUrl` (walking directions through every stop in order, so the user can press Start); with more than 11 stops the button opens part 1 and the per-section "Part N" links cover the rest. A single stop opens directions to it. **No note** is shown.
- **Route in Google Maps** (route sections of multi-section trips): `routeLinks` over the section's on-route visible stops, in `<span class="route-links">`.
- Always computed from **visible** stops (§7.9). The build computes them for the default state; the trip page script recomputes them on toggle with the same modules.
- Unit-test all limits and encodings.

### 7.6 Listing pages (`src/shared/render/listing.js`)

- `/`: site title, author, then groups: country (H2), then region (H3; trips without region listed directly under the country first), then trip cards sorted by title. Card: title (link), kind badge (`Guide` / `Trip log`), city (if any), `<N> stops`, total time, and a note excerpt (Markdown stripped, ≤ 200 chars). When the trip has a `photo`, a 96 px square thumbnail on the left. A collapsed **Photo credits** `<details>` block at the bottom of the page lists each photo's credit line (`photoCredit`: title, author, licence link, source link). **No dates.**
- Prefix pages (`/usa/`, `/usa/california/`, …): same layout, filtered to that prefix, with a breadcrumb.
- No maps on listing pages.
- Each card list (`.cards`) has `content-visibility: auto` with `contain-intrinsic-size: auto 160px`, so long indexes skip layout and paint off screen.

### 7.7 Layout shell (`src/shared/render/layout.js`)

- `<html lang>` from trip `lang` (listing: `default_lang`).
- `<title>`, meta description (trip note's first 160 chars, Markdown stripped), canonical URL, Open Graph `og:title`, `og:description`, `og:url`, `og:site_name`, `og:type=website`, and `twitter:card`: `summary_large_image` with `og:image` and `twitter:image` when the trip has a `photo`, otherwise `summary`. Drafts get the same tags so live links preview well.
- Published trip pages: `<link rel="alternate" type="text/markdown" href="index.md">` and a `<script type="application/ld+json">` block from `tripJsonLd` (§7.10).
- Drafts: `<meta name="robots" content="noindex">`, and no analytics.
- Analytics slot: if `google_analytics_id` is non-empty and the page is published or a listing page, add the standard gtag.js snippet with that ID.
- `renderLayout(opts)`: `opts.assets` is `{ cssText, font, js }` from the site build or `{ css, js }` (a stylesheet URL) from the editor's Preview. With `cssText` the CSS goes in a `<style>` element (`</style` escaped); otherwise a `<link rel="stylesheet">`. `assets.font` adds `<link rel="preload" as="font" type="font/woff2" crossorigin>`. `opts.preconnect` (origins) adds `<link rel="preconnect" crossorigin>`. `opts.robots: 'noindex'` and `opts.og: false` are used by the 404 page. No Google Fonts links.
- Escape all user text. Markdown only through `renderMarkdown`.

### 7.8 Rating display (`src/shared/rating.js`)

- `renderStarCompact(rating)`: `<span class="stars-compact" role="img" aria-label="Rated 4 out of 5">`, then one 16 px star filled from left to right in proportion `rating / 5`, then `<span class="stars-num">(4/5)</span>`. The star is an `<svg viewBox="0 0 16 16">` with a grey `<path class="star-empty">` and a nested `<svg width="W" height="16" viewBox="0 0 W 16">` holding the accent `<path class="star-full">`, where W = 16 × rating / 5 (`12.8` for 4): the nested viewport clips the fill. No ids, no inline styles, so the output is deterministic. CSS: `.stars-compact` inline-flex, 3 px gap; `.star-empty` fill `var(--track)`; `.star-full` fill `var(--accent)`; `.stars-num` 12 px, secondary color.
- `isLow(stop)`: `rating === 1 || rating === 2`. Unrated stops are never low.
- The site shows only this compact form (desktop and mobile). The editor's rating input is five tappable stars (`StarInput`, using `STAR_PATH`; filled stars get class `on`). Null rating: render nothing.
- Unit-test: the clip width (`12.8` for 4), determinism, no `id`/`style`, aria label, `isLow`.

### 7.9 Low-rated places toggle

- Shown only when the trip has at least one low stop: a subdued, right-aligned switch above the stop list (desktop and mobile), labelled `Show low-rated places (N)`. Real `<input type="checkbox" role="switch">` with a `<label>`.
- Default: off for `guide`, on for `log` (`data-show-low` on `<body>`). The viewer's choice is remembered in `localStorage["tripbook.show_low.<trip id>"]` through `persistedFlag` in `src/site/trip/prefs.js` (try/catch around storage).
- `visibleStops(trip, { showLow, showOffRoute })` in `src/shared/visible.js` returns, per section (`SectionEntry`): `stops` (each `{ stop, visible, offRoute, number, label }`), `visibleStops`, `routeStops` (visible and on-route), `count` and `minutes`. The build renders the default state with it; the trip page script uses it again on toggle.
- The HTML contains **every** stop. Stops hidden in the default state carry the `hidden` attribute and `data-low`. On toggle, `src/site/trip/list.js` shows or hides those rows, renumbers badges, updates counts, totals, legs (a leg connector is shown only between two visible stops), markers, polylines and all Google Maps links.
- Without JavaScript the page shows the default state with correct numbers and links.
- The editor ignores this and always shows every stop.

### 7.9a Off-route places

- `stop.off_route === true` applies only in `route` sections (a `poi` section numbers every stop, with no path, legs or route links); every stop of a `list` section is off-route (letter label, white pin, no route line, legs or route links).
- A `route` section may set an optional `prefix` (0–3 letters/digits, default none): its labels are `<prefix><n>` (`B1`, `B2`…). Numbers continue across route sections sharing the same prefix, so unprefixed sections number 1..n through the whole trip. `visibleStops(trip, { only })` hides the stops of every other section without changing labels.
- When the trip has several sections, each section header has a `Show only this` button (`data-solo`, `aria-pressed`) that shows just that section's stops (on the list, map and totals) and turns into `Show all`; not persisted.
- An off-route stop keeps its place in the list order (with time, rating, address, note) but takes no number. It gets a letter label `A`, `B`, `C`… counted across the **whole trip** (not per section) and the following numbers do not skip. Numbers and letters are computed by `visibleStops`.
- It is excluded from the polyline, from leg connectors (a leg is shown only between two visible **on-route** stops), from `Route in Google Maps` and from **Open in Google Maps**; it still counts in the stop total and time.
- When the trip has off-route stops, a second switch under the low-rated one reads `Show places off the path (N)` (`id="off-toggle"`, on by default; remembered in `localStorage["tripbook.show_off_route.<trip id>"]`). Off, those stops are hidden like low-rated ones (`visibleStops(trip, { showOffRoute: false })`).
- Rendering: the row has class `off-route` and a `badge-num off` (white fill, gray outline); the map pin is white with a gray outline and gray letter. The trip page script recomputes labels on toggle.
- The example data includes one (§11).

### 7.10 LLM and crawler output

- **Markdown per published trip** (`src/shared/render/trip-md.js`), at `<path>/index.md`:
  ```
  # <title>
  <Guide|Trip log> · <city, region, country> · By <author>
  Web: <absolute page URL>

  <trip note>

  ## A · <section title>          (prefix only when the section sets one)
  <section note>

  1. **<name>** — <address>
     Time: <20 min> · Rating: <4/5> · Google Maps: <stopDirectionsUrl>
     <note>
     Next: <leg_to_next>
  ```
  Off-route stops are not numbered: after a section's numbered stops, a line `Also recommended (not on the route):` followed by `- ` bullets with the same stop lines.
  Omit empty parts (no "Time:" when null, no rating when null, no empty notes). Logs list every stop in order. Guides list visible stops (default state, §7.9) and end with `## Not recommended`, listing the low-rated stops with their rating and note. No dates, no `place_id`, no internal ids.
- **`/llms.txt`** (`src/shared/render/llms.js`), following the llms.txt proposal: `# <site_title>`, a one-line blockquote (`> Trip logs and city guides by <author>.`), then one `## <Country>` heading per country with a bullet per published trip: `- [<title>](<absolute .md URL>): <kind>, <city or region>, <N> stops`. Sorted like the index.
- **`/llms-full.txt`**: every published trip's Markdown concatenated, separated by `\n\n---\n\n`, same order.
- **JSON-LD** (`src/shared/render/jsonld.js`) on published trip pages: `{"@context":"https://schema.org","@type":"TouristTrip","name","description" (trip note, Markdown stripped),"url","author":{"@type":"Person","name"},"image" (photo URL, only when present),"itinerary":{"@type":"ItemList","itemListElement":[{"@type":"ListItem","position","item":{"@type":"Place","name","address","geo":{"@type":"GeoCoordinates","latitude","longitude"}}}]}}`, visible stops only. **No ratings and no dates.** Serialize with `JSON.stringify` and escape `<` as `\u003c`.
- **`robots.txt`** (`renderRobots` in `src/shared/render/seo.js`): always `User-agent: *` / `Disallow: /drafts/` and the `Sitemap:` line. If `config.ai_crawlers` is `"disallow"`, add a block per agent: `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `Claude-User`, `Claude-SearchBot`, `Google-Extended`, `CCBot`, `PerplexityBot`, `Applebot-Extended`, `Bytespider`, `meta-externalagent`, each with `Disallow: /`. When `"disallow"`, also skip writing `llms.txt` and `llms-full.txt`.
- Drafts never get Markdown, JSON-LD or an entry in `llms.txt`.

---

## 8. Editor PWA (editor domain, root `/`)

### 8.1 Storage and auth

- `localStorage["tripbook.settings"]`: `{ owner, repo, branch, token, active_trip_id, demo }`.
- IndexedDB (idb-keyval):
  - `trip:<id>` → `{ trip, folder: "drafts"|"published"|null, sha: string|null, dirty: boolean, path_at_sync: string|null, synced_at: ISO string|null, auto_sync }`. `folder: null` means never synced.
  - `config` → `{ config, sha }` (the data repo's `config.json`, cached for offline use).
- `localStorage["tripbook.unsaved.<id>"]`: a record whose edits had not reached IndexedDB yet when the page was hidden or closed (§8.3). Recovered at startup when its `updated_at` is not older than the IndexedDB copy, then removed.
- `localStorage["tripbook.demo.files"]`: the fake repo of demo mode (§8.9).
- Never send the token anywhere except `https://api.github.com`.

### 8.2 GitHub client (`src/editor/core/github.js`)

Plain `fetch` with headers `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.

- The editor reads and writes only `config.json`, `drafts/*.json` and `published/*.json` at the data repo root. Nothing else.
- `getRepo()` → default branch.
- `listFolder(folder)` → `GET /repos/{o}/{r}/contents/{folder}?ref={branch}`; 404 → `[]`.
- `getFile(path)` → content (base64 → bytes → `TextDecoder('utf-8')` → JSON) and `sha`.
- `putFile(path, json, sha|null, message)` → `PUT /contents/{path}`; content = UTF-8 bytes via `TextEncoder`, then base64 (handle non-ASCII correctly; unit test with `"Caffè"`). Returns new `sha`. 409 or 422 with a sha mismatch → throw `ConflictError`.
- `deleteFile(path, sha, message)`.
- `moveFile(fromPath, toPath, json, expectedFromSha, message)`: single commit via Git Data API: `GET /git/ref/heads/{branch}` → `GET /git/commits/{sha}` → verify via `getFile(fromPath)` that the sha equals `expectedFromSha` (else `ConflictError`; when `expectedFromSha` is `null`, the source must not exist, and the delete entry is omitted) → `POST /git/trees` with `base_tree` and entries `[{ path: toPath, mode: "100644", type: "blob", content }, { path: fromPath, mode: "100644", type: "blob", sha: null }]` → `POST /git/commits` → `PATCH /git/refs/heads/{branch}`. Returns the new blob sha of `toPath` (read it back with `getFile`).
- `dispatchRebuild()` → `POST /repos/{o}/{r}/actions/workflows/site.yml/dispatches` with `{ ref: branch }`. Optional; needs Actions write permission; on 403, show "Token lacks Actions permission".
- Commit messages: `Sync: <title>`, `Publish: <title>`, `Unpublish: <title>`, `Delete: <title>`, `Config: update`.

### 8.3 Sync semantics

- Every edit updates the in-memory record at once (`dirty: true`) and is written to IndexedDB 300 ms after the last change (typing does not write per keystroke). On `pagehide` and when the page becomes hidden, pending records are first copied synchronously to `localStorage["tripbook.unsaved.<id>"]` (an IndexedDB write started during unload may not finish), then written to IndexedDB; the stash is removed once the write completes. Saving a whole record (sync, refresh, capture) writes immediately.
- **Sync**: if `folder` is null → create in `drafts/`. Else `putFile` to `<folder>/<id>.json` with the stored sha. Before sync: run `validateTrip`. Block and show errors inline if invalid. For published trips, apply the `old_paths` rule (§5.3) before writing. New trips are written with `v: SCHEMA_VERSION`.
- **Publish** (draft): one `moveFile(drafts → published)` commit carrying the current edits (`expectedFromSha` is `null` for a never-synced trip); no separate Sync commit. Publishing an already published trip is a plain Sync. **Unpublish**: the reverse, but it still runs Sync first if dirty.
- **Conflict** (`ConflictError`): modal with *Load theirs* (fetch remote, replace local, `dirty: false`) and *Overwrite* (fetch remote sha, `putFile` with it). Show both titles and remote/local stop counts to help choose.
- **Offline / failure**: keep `dirty: true`. Show a "Not synced" badge on the trip and in the header; when synced, the editor bar shows `Synced <date and time>` from `synced_at` (editor-only; never rendered on the site). Retry automatically on `online` and on `visibilitychange` to visible, for the active trip only, and only if the user has pressed Sync at least once for that trip (no surprise commits).
- **Opening the trips list** fetches both folders and `config.json`. For each remote file: if no local record, store it (`dirty: false`). If the local record is `dirty`, keep local and show "Local changes not synced" with *Sync now* and *Discard local*. If not dirty and the remote sha differs, replace local.
- **Delete**: confirm dialog naming the trip; delete remote (if synced) and local.
- **Copy live link** button: copies `config.base_url` + draft or published path. Note under it: "Live after the site rebuilds (about a minute)".

### 8.4 Screens

All screens are mobile-first and must also work well on desktop (max content width 960 px, centered).

1. **Setup** (first run, or Settings → "Change repo/token"): fields data repo owner and name (empty by default; placeholder `you/trips`), on localhost a **Use sample data** button (§8.9), token (password field with show toggle), **Test connection** (calls `getRepo`, `listFolder('drafts')` and reads `config.json`). Help text with a link to `https://github.com/settings/personal-access-tokens/new` and the exact permissions: *Repository access: only your data repo; Contents: Read and write; optional Actions: Read and write (for the Rebuild button)*.
2. **Trips** (home): search box; two groups, *Drafts* and *Published*, each sorted by title; each row shows title, kind, location, stop count, badges (`Active`, `Not synced`). Buttons: **New trip**, and if an active trip exists, a large **Add place here** button pinned to the bottom.
3. **Trip editor:**
   - Top bar (sticky under the app header): back, title with the sync status under it (`Not synced`, or `Synced <date, time>`), **Sync**, **Publish** (drafts only; under 520 px it moves into the menu), overflow menu (Copy live link, Preview, Publish on narrow phones, Unpublish for published trips, Set as / Clear active trip, Make guide from this log for logs, Delete). Validation errors from Sync show as a red list under the bar.
   - Header fields, in this order: **Title**; **Kind** (segmented Guide/Log) with **Slug** beside it (auto from title until edited; the computed URL path is shown as small text under the slug); **Trip note** (auto-growing textarea, Markdown hint); **PhotoField** (search a Wikipedia article title with `findWikipediaPhoto`, preview the lead image and credit, accept or clear it; the Find button sits beside the field); a collapsible **Location** toggle (same `details-toggle` style as the stop form's address toggle) that shows a summary (`city, region, country`) when collapsed and is open by default only when the trip has no country. Location fields: **Country** (text input with a `<datalist>` of all ISO countries from `src/editor/core/countries.js`, built with `Intl.DisplayNames`, rendered by the memoized `CountryList` so typing elsewhere does not re-diff 250 options; choosing a known name also fills the country code), country code, region, city. Location is prefilled from the first stop when empty; leave region blank to omit it from the URL.
   - **Sections:** each with drag handle, prefix input, title input, style toggle (Route/List), section note (auto-growing textarea, collapsed to one line until focused), stop count, collapse toggle, overflow menu (Move up/down, Delete section).
   - **Stops:** cards with drag handle, number (or letter for off-route stops), name, and on desktop (≥ 900 px) a time badge and an `Off route` badge, plus a menu (Move to…, Delete stop); tap to expand into the **compact stop form**, in this order:
     1. name, then the **note** (Markdown) directly under it;
     2. two columns: **time** on one side and **rating** (five 44 px tappable stars; tapping the current value clears it) to the left of it. Time = preset chips from `config.time_presets` (default 10, 30, 45, 1 h) plus a small numeric **minutes** input for custom values; custom minutes are rounded to 15-minute blocks when rendered (e.g. 105 → `1 h 45 min`);
     3. an **Off the route** checkbox (only for stops in `route` sections);
     4. an **Address and location** toggle, collapsed by default, hiding address, city, region, country, country code, lat/lng (with "Use my location" and a map picker modal for dragging a pin) and the read-only **place_id** (with Clear) which sits next to the address;
     5. **leg to next** (route sections).
   - **Add stop** button at the end of each section, opening the Capture sheet in "search" mode (no GPS required).
   - **Reorder mode** toggle: collapses all stop cards to one line for fast dragging.
   - **Preview**: full-screen modal with an `<iframe srcdoc>` (sandbox `allow-scripts allow-same-origin allow-popups`) rendered by `renderTripPage` from `src/shared/render/trip.js`, using the preview assets listed in `build.json` (absolute URLs built from `location.origin`, CSS as a `<link>`) and the cached config. The renderer is loaded with `import()` on first use, so it and `marked` are a lazy chunk.
4. **Capture** (bottom sheet or full-screen on mobile; matches the approved mockup):
   - "Adding to: <trip>" with a trip picker (defaults to the active trip; "New trip…" creates a log titled with the city of the first result).
   - Location line: "Near <first result's area> · ±<accuracy> m".
   - The search box also accepts pasted coordinates (`43.7110, 10.3994`, parsed by `parseCoordinates` in `core/places.js`): they are reverse-geocoded and shown as a pin result instead of calling Places text search (which rejects coordinates). Use this to start a guide at a point with no business.
   - Up to 10 suggestions as large radio cards (name, type, distance in m). The selected card expands to show time chips, the five-star rating input and a note field.
   - "Not listed? Search a place" (Places text search biased to the current location) and **Drop pin at my location**.
   - Primary button: **Add as stop N**.
   - On add: fill all stop fields from the place (or reverse geocode for a pin), set `coords_source`, set `captured_at` to now with offset, place the stop per §8.6, save locally, close, toast "Added. Sync when ready." with **Sync** action.
5. **Settings:** edits the data repo's `config.json` (load, form for every field in §5.2, Save = `putFile` with sha, conflict handling as trips). Also: active trip, Change repo/token, **Rebuild site** (`dispatchRebuild`), app version and commit from `build.json`.

### 8.5 Drag and drop (SortableJS)

- One Sortable on the sections container (`group: "sections"`, `handle: ".drag-section"`).
- One Sortable per section's stop list, all sharing `group: "stops"` so stops move across sections.
- SortableJS is loaded with `import('sortablejs')` when a sortable list mounts (a lazy chunk), not in the main bundle.
- Options for both: `animation: 150`, `forceFallback: true`, `fallbackOnBody: true`, `delay: 150`, `delayOnTouchOnly: true`, `scroll: true`, `bubbleScroll: true`, `ghostClass`, `chosenClass`, `dragClass` styled visibly.
- **Preact integration gotcha:** Sortable mutates the DOM. In `onEnd`, first put the DOM node back where it was (`from.insertBefore(item, from.children[oldIndex] ?? null)`), then update state (move the stop between section arrays by index), and let Preact re-render. Key every list item by `id`.
- Every stop card also has **Move to…** in its menu: choose section, then *Top* or *Bottom*. Same for keyboard users.
- **Undo:** keep the previous trip state for the last structural change (move, delete, add section). Show a toast "Moved. Undo" for 6 s.
- Pin numbers in Preview and map pickers reflect the new order immediately.

### 8.6 Capture placement rules (`src/editor/core/capture.js`)

- `kind: "log"`: find the section whose `auto_date` equals today's local date (`YYYY-MM-DD` in device time zone). If none, create one at the end: `{ title: "Day N", style: "list", auto_date: today }`, where N = number of sections with non-null `auto_date` + 1. Append the stop.
- `kind: "guide"`: append to the last section, creating `{ title: "", style: "route" }` if there are none.
- Unit-test both, including the date boundary.

### 8.7 Places helpers (`src/editor/core/places.js`)

- Load Maps JS with the key from the cached `config.json`. If it is empty, Capture shows "Add a Google Maps key in Settings" and offers **Drop pin at my location** only (coordinates from the device, address fields left empty for the user).
- `importLibrary("places")`, `importLibrary("geocoding")`.
- Nearby: `Place.searchNearby({ fields: ["id","displayName","formattedAddress","location","addressComponents","primaryTypeDisplayName"], locationRestriction: { center, radius: config.nearby_radius_m }, maxResultCount: config.nearby_max_results, rankPreference: SearchNearbyRankPreference.POPULARITY })`.
- Text search: `Place.searchByText({ textQuery, fields: [same], locationBias: center, maxResultCount: 10 })`.
- Reverse geocode for pins: `new Geocoder().geocode({ location })`; use the first result.
- Address components mapping: `country` → `country` (longText) and `country_code` (shortText); `administrative_area_level_1` → `region` (longText); city = `locality` ?? `postal_town` ?? `administrative_area_level_3` ?? `administrative_area_level_2`.
- Geolocation: `getCurrentPosition` with `enableHighAccuracy: true`, `timeout: 10000`, `maximumAge: 15000`. Clear errors: denied / unavailable / timeout, each with a retry and a "Search instead" fallback.
- Isolate all Google calls in this module so tests can stub it.

### 8.8 PWA

- `manifest.webmanifest`: name "Tripbook", short_name "Trips", `start_url: "/"`, `scope: "/"`, `display: "standalone"`, theme `#1A1D21`, background `#FFFFFF`, icons 192/512/maskable.
- `apple-touch-icon` link and `apple-mobile-web-app-capable` meta in `index.html`.
- `sw.js`: precache the shell (index, JS including lazy chunks, CSS, manifest, icons, `build.json`, preview assets and fonts; §6.2 step 6). Cache-first for shell files, network-only for `api.github.com` and Google domains. Delete old caches on activate. Show an "Update available, reload" toast when a new SW is waiting.
- `navigator.storage.persist()` on first run.
- Settings shows a one-line tip: "Install to your home screen so the device keeps your offline drafts."

### 8.9 Demo mode (localhost only)

- `src/editor/core/demo.js`: `createFakeGithub()` implements the same interface as `github.js` (`getRepo`, `listFolder`, `getFile`, `putFile`, `deleteFile`, `moveFile`, `dispatchRebuild`) over a JSON object kept in `localStorage["tripbook.demo.files"]`, with real sha and conflict behavior. `seedDemo(data)` fills it from `demo/data.json` (§6.2 step 8).
- `settings.demo = true` makes `gh()` in `state/connection.js` return the fake client; Setup's **Use sample data** button (visible only on `localhost`/`127.0.0.1`) seeds it and skips the token. Settings → Change repo/token leaves demo mode.
- Tests cover the fake client (including conflicts).

### 8.10 Editor code structure

- **UI** (`screens/`, `components/`) imports state and actions from `state/index.js` only, and pure helpers from `core/` and `src/shared/`. Templates use `html` from `components/html.js` (htm bound to Preact).
- **State** (`state/`) holds signals and actions and never imports UI. The sync-conflict modal is UI, so `components/Conflict.js` exports `showConflict(id)` and `main.js` registers it with `registerConflictHandler`; `run()` in `state/actions.js` calls it on `ConflictError`.
- **`updateTrip(id, fn)`** (`state/records.js`) clones the trip, lets `fn` mutate the clone (operations from `core/editing.js`), stamps `updated_at`, then applies `reuseUnchanged(prev, next)`: every section, stop or field that is deep-equal to before keeps its old object (array items with an `id` are matched by id, so moved ones are reused too). The record becomes `dirty`, the `trips` signal updates, and the IndexedDB write is scheduled (§8.3). `structural(id, message, fn)` wraps it with a 6 s Undo toast.
- **`StopCard`** is wrapped in `memo` (from `components/controls.js`, a small `shouldComponentUpdate` with shallow prop comparison; no `preact/compat`). Its props are `tripId`, `stop`, `label`, `reorder`, `isRoute` (never the whole trip), so with structural sharing only the edited card re-renders. "Move to…" reads the trip from the `trips` signal at click time.
- **Startup** (`main.js`): register the conflict handler; listen to `hashchange` (route), `online` (auto-retry), `visibilitychange` (auto-retry when visible, `flushPendingSaves` when hidden) and `pagehide` (`flushPendingSaves`); render `<App>`; `init()` (load IndexedDB records, `recoverUnsaved`, cached config, `build.json`, `storage.persist()`, redirect to `#/setup` when not configured, `ready = true`), then a quiet `refresh()`; `registerServiceWorker()`.

---

## 9. Workflows

If a listed action major version does not exist, use the latest existing major. (Majors known to exist: `checkout@v5`, `setup-node@v5`, `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`.)

### 9.1 Editor (`tripbook/.github/workflows/editor.yml`)

Tests everything and deploys the editor. Never touches the trips site.

```yaml
name: Editor
on:
  push:
    branches: [main]
    paths-ignore: ["**/*.md", "docs/**", ".devcontainer/**"]
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build:example
      - run: npm run build:editor
      - if: github.event_name != 'pull_request'
        uses: actions/configure-pages@v5
      - if: github.event_name != 'pull_request'
        uses: actions/upload-pages-artifact@v4
        with: { path: _editor }
  deploy:
    if: github.event_name != 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 9.2 Trips site (`templates/data-repo/.github/workflows/site.yml`, copied into the data repo)

```yaml
name: Site
on:
  push:
    branches: [main]
    paths: ["drafts/**", "published/**", "config.json", ".github/workflows/site.yml"]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with: { path: data }
      - uses: actions/checkout@v5
        with:
          repository: ${{ vars.TRIPBOOK_REPO }}
          ref: ${{ vars.TRIPBOOK_REF }}
          path: tripbook
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: tripbook/package-lock.json
      - run: npm ci --omit=dev
        working-directory: tripbook
      - run: node src/build/build-site.mjs --data ../data --out ../_site
        working-directory: tripbook
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with: { path: _site }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 9.3 Release (`tripbook/.github/workflows/release.yml`)

Triggers: push to `main` touching `src/shared/**`, `src/site/**`, `src/build/build-site.mjs`, `src/build/bundle.mjs`, `src/build/cli.mjs`, `package.json` or `package-lock.json`; and `workflow_dispatch`. Editor-only changes never release. Permissions `contents: write`; `concurrency: release` without cancelling. Env: `DATA_REPO` from `vars.DATA_REPO`, `DATA_REPO_TOKEN` from `secrets.DATA_REPO_TOKEN`.

Steps: checkout with `fetch-depth: 0` and tags; setup-node 24 with npm cache; `npm ci`; `npm test`; **pick the version**: if HEAD already has a `v*` tag, skip everything; otherwise `MM` = `major.minor` of `package.json`, `LAST` = highest numeric patch among tags `v$MM.*`, tag = `v$MM.$((LAST+1))` (start at `.0`); `git tag` and push it; then, only if both `DATA_REPO` and `DATA_REPO_TOKEN` are set, with `GH_TOKEN=DATA_REPO_TOKEN`: `gh variable set TRIPBOOK_REF -R $DATA_REPO -b <tag>` and `gh workflow run site.yml -R $DATA_REPO`; otherwise print a `::notice::` saying the site was not rebuilt and to run `scripts/setup-auto-release.sh`. (A workflow's own `GITHUB_TOKEN` cannot set variables or dispatch workflows in another repo, hence the personal token. It must be fine-grained, with access to the data repo and *Variables: Read and write*, *Actions: Read and write*, *Metadata: Read*; without Variables the step fails with HTTP 403 on `/actions/variables` after the tag was already pushed.) If `DATA_REPO` has no `/`, the step prefixes `github.repository_owner`. Because a tagged `HEAD` is skipped, re-running or dispatching Release on an already-released commit does nothing: test with a new commit touching a watched path.

### 9.4 Data-repo template (`templates/data-repo/`)

- `config.json`: the defaults from §5.2 with empty key, author and `base_url`.
- `drafts/.gitkeep`, `published/.gitkeep`.
- `.github/workflows/site.yml` (§9.2).
- `README.md`: what the repo is, folder meaning, that the editor writes here, how to edit config, which tripbook release builds the site (`TRIPBOOK_REF` variable) and how to change it (automatic releases, `scripts/release.sh` in tripbook, or edit the variable and run the workflow).

---

## 10. Scripts

All bash scripts: `set -euo pipefail`, `--help`, use `gh` and `node` (no `jq`), print each step, safe to re-run.

**`scripts/lib.sh`** (sourced by the others): `load_env` reads `.env` in the repo root with a safe parser (only the known keys `EDITOR_DOMAIN`, `SITE_DOMAIN`, `DATA_REPO`, `MAPS_KEY`, `MAP_ID`, `AUTHOR`; never `source`d or evaluated; values already in the environment win). `normalize_repo <name>` returns `owner/name`, prefixing the current `gh` user when there is no slash, so `DATA_REPO=trips.example.com` works. Each script's flags override `.env`; each `--help` names the `.env` key that supplies the default.

`.env.example` documents the keys with empty values. `.env` is git-ignored.

### 10.1 `scripts/setup-editor-pages.sh`

Run once in the tripbook repo after pushing it to GitHub.
Flags: `--repo <owner/name>` (default: `gh repo view --json nameWithOwner`), `--domain <host>` (default `EDITOR_DOMAIN` from `.env`; required one way or the other, e.g. `edit.trips.signorini.us`).
1. Check `gh auth status`.
2. Enable Pages from Actions: `gh api -X POST repos/<repo>/pages -f build_type=workflow` (if it exists, `PUT` with `build_type=workflow`).
3. Set the custom domain: `gh api -X PUT repos/<repo>/pages -f cname=<domain>`.
4. `gh workflow run editor.yml -R <repo>`.
5. Print the DNS record to create (`CNAME <host-label> → <owner>.github.io`, DNS only / grey cloud in Cloudflare) and the HTTPS enforcement command for later.

### 10.2 `scripts/release.sh`

Usage: `scripts/release.sh <version> [--data-repo <owner/name>]` (default data repo: `DATA_REPO` from `.env`, else `<gh user>/trips`). Version like `0.2.0`. Normally unnecessary because of §9.3; use it for a minor/major bump or when automatic releases are not set up.
1. Require a clean working tree on `main`, up to date with `origin/main`.
2. `npm test`.
3. `npm version <version> --no-git-tag-version --allow-same-version`, commit "Release v<version>", tag `v<version>`, `git push origin main --follow-tags`.
4. If the data repo exists (`gh repo view`): `gh variable set TRIPBOOK_REF -R <data-repo> -b v<version>`, then `gh workflow run site.yml -R <data-repo>`. If it does not exist yet, print "Data repo not found; create-data-repo.sh will use this release" and exit 0.

### 10.3 `scripts/create-data-repo.sh`

Run once after the first release.
Flags: `--owner <login>` (default: owner part of `DATA_REPO`, else `gh api user -q .login`), `--repo <name>` (default: name part of `DATA_REPO`, else `trips`), `--domain <host>` (default `SITE_DOMAIN`; required, e.g. `trips.signorini.us`), `--code-repo <owner/name>` (default: current repo from `gh repo view`), `--code-ref <tag>` (default: latest `v*` tag from `git describe --tags --abbrev=0 --match 'v*'`; fail with "Run scripts/release.sh 0.1.0 first" if none), `--maps-key <key>` (default `MAPS_KEY`), `--map-id <id>` (default `MAP_ID`), `--author <name>` (default `AUTHOR`; all optional).
1. Check `gh auth status` and that the token has the `workflow` scope (else print `gh auth refresh -s workflow` and exit 1).
2. Copy `templates/data-repo/` to a temp dir. Write `config.json` via inline `node -e`: `base_url = https://<domain>` and the optional flags.
3. `git init -b main`, commit "Initial data repo", `gh repo create <owner>/<repo> --private --source <tmp> --push`. If the repo exists, stop with a clear message (never overwrite).
4. `gh variable set TRIPBOOK_REPO -R <owner>/<repo> -b <code-repo>` and `TRIPBOOK_REF` to the code ref.
5. Enable Pages from Actions and set the custom domain (as §10.1 steps 2–3).
6. `gh workflow run site.yml -R <owner>/<repo>`.
7. Print next steps: DNS record (DNS only), HTTPS enforcement once the certificate is issued (`gh api -X PUT repos/<owner>/<repo>/pages -F https_enforced=true`), token creation link with exact permissions, and the editor URL to open.

### 10.4 `scripts/setup-auto-release.sh`

Run once to enable §9.3's rebuild step. Flags: `--data-repo <owner/name>` (default `DATA_REPO` from `.env`, normalized), `--code-repo <owner/name>` (default: current repo). Checks `gh auth status`, runs `gh variable set DATA_REPO -R <code-repo> -b <data-repo>`, then `gh secret set DATA_REPO_TOKEN -R <code-repo>` (the user pastes the token). The help text explains how to create the fine-grained token for the data repo only, with **Variables: read and write** and **Actions: read and write**.

### 10.5 `scripts/make-icons.mjs`

Rasterize `src/editor/icons/icon.svg` (simple original design: a map pin with a dotted path, accent `#C2410C` on `#1A1D21` rounded square) to 192, 512, maskable 512 (with safe-zone padding) and apple-touch-icon 180, using sharp. Commit the PNGs.

---

## 11. Example data (`examples/data/`)

Use for local builds, tests and screenshots. No `place_id`s (null). Content below; coordinates are approximate.

- `config.json`: defaults, `author: "Alessio"`, `base_url: "http://localhost:8080"`, empty Maps key (the placeholder map must render).
- `published/pisa-in-one-walk.json` — `kind: guide`, location Italy / IT / region "" / city Pisa, slug `pisa-in-one-walk`, trip note "Arriving by train? This route takes you north through the old town, across the Arno, and ends at Piazza dei Miracoli.", one `route` section titled "Station to the Tower" with section note "Flat and easy; about 2 km on foot.", stops in order (name; lat,lng; minutes; leg_to_next; note):
  1. Pisa Centrale; 43.7085,10.3984; null; "3 min walk"; "Start here if you arrive by train. Walk north out of the station."
  2. Tuttomondo mural; 43.7105,10.4011; 10; "4 min walk"; "Keith Haring's 1989 mural, one of his last public works."
  3. Corso Italia; 43.7135,10.4005; 15; "8 min walk"; "Pedestrian shopping street. Keep walking north toward the river."
  4. Ponte di Mezzo; 43.7163,10.4021; 10; "2 min walk"; "The central bridge over the Arno."
  5. Borgo Stretto; 43.7178,10.4035; 20; "5 min walk"; "Arcaded street with cafés. Good place for a coffee stop."
  6. Piazza dei Cavalieri; 43.7194,10.4004; 15; "9 min walk"; "Renaissance square, home of the Scuola Normale Superiore."
  7. Piazza dei Miracoli; 43.7230,10.3958; 90; null; "Cathedral, Baptistery and the **Leaning Tower**. Book the tower climb ahead."; rating 5.
  Insert, between Borgo Stretto and Piazza dei Cavalieri, **Pasticceria Salza** (id `p-8`; 43.7172,10.4038; 20 min; rating 4; a note about the pastries; `off_route: true`), to exercise lettering: it renders as `A`, the numbers stay 1–7, and the polyline and route link skip it.
  → path `/italy/pisa/pisa-in-one-walk/`
- `published/santa-barbara-perfect-day.json` — `kind: log`, location United States / US / California / Santa Barbara, slug `perfect-day`, two `list` sections with `auto_date` set and `captured_at` values set (to prove they never render): "Downtown" (Santa Barbara County Courthouse 34.4241,-119.7024; Old Mission Santa Barbara 34.4383,-119.7139) and "Waterfront" (Stearns Wharf 34.4100,-119.6853; Butterfly Beach 34.4180,-119.6375, rating 2). Ratings on the other stops: 4, 5, 3. Trip note: "One easy day around town." Section notes: "Downtown": "Walkable; park once." "Waterfront": "" (empty, to test that empty notes render nothing).
  → path `/usa/california/santa-barbara/perfect-day/`
- `drafts/pisa-4-hours-layover.json` — `kind: guide`, Italy / Pisa, slug `4-hours-layover`, one route section with stops 1, 5, 7 from the Pisa list, with a fourth stop "Tourist-trap café" (43.7225,10.3970, rating 1) inserted between stops 5 and 7.
  → path `/drafts/italy/pisa/4-hours-layover/`

---

## 12. Tests (`test/`)

`npm test` runs `node --test "test/*.test.js"`. All files must pass; no network calls (mock `fetch`; Google calls are isolated in `core/places.js`). `test/fixtures.js` (not a test file) exports `load(path)`, `pisa()`, `sb()`, `layover()`: fresh copies of the example trips. One file per module or area:

- `paths.test.js`: slugify (diacritics `Città` → `citta`, spaces, punctuation, trimming); both example paths; region omitted; country slug override; draft prefix; listing prefixes; collision detection.
- `schema.test.js`: valid examples pass; each rule fails with a readable message (including `off_route` not boolean); unknown fields preserved; `v: 2` fails with the exact release message; factories validate; `photo` is optional and https only.
- `maps-links.test.js`: `directionsUrl` is always an array (`[]` under 2 stops), chunking at 11 stops with a shared boundary stop, place_id alignment, all-or-nothing place ids, the 2048-char cap; `routeLinks` labels; `stopDirectionsUrl`; `openInMaps` (route stops only, single stop, none).
- `format.test.js`: `formatMinutes`, `sectionLetter`, `shortAddress`; Markdown (links, bold, lists, `<script>` escaped, unsafe links dropped); `renderStarCompact` (clip width `12.8` for 4, deterministic, no `id`/`style`, aria label) and `isLow`.
- `visible.test.js`: guide default hides low stops and numbers the rest 1..n without gaps; `showLow: true` includes and renumbers; prefixed labels `A1`, `B1`; unprefixed sections continue numbering; totals and counts follow visibility; unrated stops never hidden; off-route stops get letters across the trip, take no number, are excluded from `routeStops`, hide with `showOffRoute: false`, and are ignored in `list` sections.
- `render.test.js`:
  - Pisa page: stop names, numbers, dotted legs, trip note, section note, compact star markup for the rated stop; the off-route stop has class `off-route` and letter `A` and no leg connectors around it; the stats `(N stops · time)` appear in the trip note; no section tabs; no "without a Google place" text.
  - Santa Barbara log page: **no `captured_at` values, no `auto_date` values and no 4-digit years from those dates appear in the HTML**; Butterfly Beach is visible (no `hidden` attribute); the switch is present, checked, labelled `Show low-rated places (1)`; the empty "Waterfront" note produces no empty wrapper element.
  - Draft guide page: contains `noindex` and no gtag; the "Tourist-trap café" row exists with `hidden` and `data-low`; the switch is present and unchecked; visible numbers are 1, 2, 3; the default directions link does not include the café's coordinates.
  - Pisa page has no low-rated switch and has the off-path switch, checked; analytics only when the ID is set, never on drafts; `og:image` appears only with a photo; listing cards show thumbnails and the credits block; user text is escaped.
  - `#trip-data`: every stop has only `CLIENT_STOP_FIELDS`, and `visibleStops`, `routeLinks` and `openInMaps` give the same labels, minutes and URLs on the client data as on the full trip (for each example, with an off-route stop, in three switch states). A source scan of `src/site/trip/*.js` finds no `stop.<field>` outside `CLIENT_STOP_FIELDS`.
- `trip-md.test.js`: Pisa Markdown has the title, note, numbered stops with Google Maps links, the 5/5 rating, and the off-route stop under "Also recommended (not on the route):"; the layover guide puts "Tourist-trap café" only under `## Not recommended`; the Santa Barbara log lists Butterfly Beach inline; no ISO dates, no `place_id`, no `captured_at`; empty fields leave no empty labels; `llms.txt` lists both published trips with absolute `.md` URLs and never the draft; `llms-full.txt` contains both; JSON-LD parses, has visible stops only, no `rating` key and no dates.
- `build-site.test.js`: build `examples/data` into a temp dir via `buildSite`; the expected files exist (both trip pages, the draft page, `/index.html`, `/italy/index.html`, `/usa/california/index.html`, `sitemap.xml`, `robots.txt`, `404.html`, `llms.txt`, `llms-full.txt`, `assets/trip.<hash>.js`, the Latin font) and **no `.css` file** is written; trip, index and 404 pages inline the CSS in `<style>`, preload the font that the `@font-face` rule points at, and reference no Google Fonts; the 404 page is `noindex`; the index and sitemap do not mention the draft and the sitemap has no `lastmod`; **the output contains no `.json` file at all**; each published trip has `index.md` and the draft does not; `robots.txt` and the generator meta; `ai_crawlers: "disallow"` lists each agent and skips the llms files; redirects for `old_paths` (a live path wins); invalid trips, newer schema and collisions fail with clear messages; an empty data repo builds.
- `build-editor.test.js`: build into a temp dir via `buildEditor`; `index.html` references the hashed bundle and stylesheet, the manifest and Apple meta, no analytics; `build.json` has version, commit and preview assets that exist; `sw.js` has a cache version and lists the shell (including the preview font) but not itself; the app bundle `import()`s a `chunks/sortable…` and a `chunks/trip…` chunk, does not contain SortableJS, and both chunks exist and are in the shell; `manifest.webmanifest` has `start_url "/"` and existing icons, and `404.html` redirects to `/`; the normal build has no `demo/` and the `--demo` build has `demo/data.json` that is not in the shell.
- `github.test.js` (mock `fetch`): base64 round trip with non-ASCII; headers and UTF-8 content; 409 and sha-mismatch 422 → `ConflictError`; `getFile`/`listFolder` 404 handling; `moveFile` sends one tree with an add and a delete and detects a changed source sha; sync, publish (a never-synced trip publishes in a single move) and pull logic from `core/sync.js`; the fake client from `core/demo.js` (create, update, conflict, move, delete).
- `editing.test.js`: slug follows the title until edited; moving stops across sections and reordering sections; pin numbers follow the order; `deleteStop`, `addSection`; `reuseUnchanged` keeps identity for unchanged sections and stops (also after a move) and returns the previous object when nothing changed; `autofillLocation`; `makeGuide` (new id, "Guide: " prefix, dates cleared).
- `capture.test.js`: Day N creation and reuse; date boundary at local midnight; guide placement; place and geocode result mapping; `parseCoordinates`.
- `wikipedia.test.js`: photo lookup with licence data from a mocked Wikipedia and Commons.

## 13. Phases

### Phase 0 — Devcontainer (then STOP)

1. Create `.devcontainer/devcontainer.json`:

```json
{
  "name": "tripbook",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:24-bookworm",
  "features": {
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "forwardPorts": [8080, 8081],
  "portsAttributes": {
    "8080": { "label": "site preview" },
    "8081": { "label": "editor preview" }
  },
  "postCreateCommand": "if [ -f package-lock.json ]; then npm ci; elif [ -f package.json ]; then npm install; fi",
  "customizations": {
    "vscode": {
      "extensions": ["GitHub.copilot", "GitHub.copilot-chat"]
    }
  }
}
```

   If the `24-bookworm` tag does not exist, use the newest Node LTS `javascript-node` tag.
2. Create `.gitignore` (§4).
3. `git init -b main` if needed; commit "Phase 0: devcontainer".
4. **STOP.** Tell the user, verbatim:
   > Phase 0 is done. Run **Dev Containers: Reopen in Container** from the Command Palette. When VS Code has reopened inside the container, start a new Copilot chat in agent mode and say: **"Continue building from BUILD.md."**

   Do nothing else in this session.

**Done when:** the devcontainer file exists and is valid JSON, and the commit exists.

### Phase 1 — Scaffold and shared modules

- Verify you are inside the container (`node --version` reports v24, `gh --version` works). If not, repeat the Phase 0 stop message and stop.
- `npm init -y`, set `"type": "module"`, `"private": true`, `"version": "0.1.0"`, `"license": "MIT"`, engines `node >= 24`, and the scripts from §4. Install the dependencies from §3.
- Create the folder layout from §4 (empty files are fine for later phases).
- Implement `src/shared/` except `render/`: `schema.js` (with the typedefs), `slug.js`, `paths.js`, `maps-links.js`, `maps-loader.js`, `markdown.js`, `format.js`, `rating.js`, `visible.js`, `wikipedia.js`, `theme.js`, `tokens.css`.
- Write the example data (§11).
- Write `test/fixtures.js`, `paths.test.js`, `schema.test.js`, `maps-links.test.js`, `format.test.js`, `visible.test.js` (§12) and `wikipedia.test.js`.

**Done when:** `npm test` passes.

### Phase 2 — Site build and public site

- Implement `src/shared/render/*` (including `seo.js`, `trip-md.js`, `llms.js`, `jsonld.js`, `photo.js`, `icons.js`), `src/site/site.css` (§7.1 style), the self-hosted fonts in `src/site/fonts/` (download the Space Grotesk 700 `latin` and `latin-ext` woff2 files listed by `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap` with a modern browser User-Agent, and `OFL.txt` from `google/fonts` `ofl/spacegrotesk/`), the trip page script `src/site/trip/*` (§7.3, §7.4, including the switches, §7.9 and §7.9a), `src/build/bundle.mjs`, `src/build/cli.mjs`, `src/build/build-site.mjs` per §6.1 and §7.
- Write `render.test.js`, `trip-md.test.js` and `build-site.test.js`.
- Run `npm run build:example`. Inspect the generated HTML files by reading them (do not start a server). Check the structure matches §7.

**Done when:** `npm test` and `npm run build:example` pass; the date-leak and toggle assertions pass.

### Phase 3 — Editor foundations: build, storage, GitHub, sync

- `src/build/build-editor.mjs` (§6.2, including `--demo`) with a minimal app so it builds.
- `src/editor/core/github.js`, `core/store.js`, `core/sync.js`, `core/demo.js`, the `state/` modules (§8.10), sync semantics (§8.1–§8.3) and demo mode (§8.9).
- Screens: Setup, Trips list (with sync badges, the conflict modal, the "local changes not synced" banner), the Settings shell.
- App shell (`App.js`, `components/overlays.js`): header, simple hash router (`#/`, `#/trip/<id>`, `#/capture[/<tripId>~<sectionId>]`, `#/settings`, `#/setup`), toast system, modal system.
- `github.test.js`, `build-editor.test.js`.

**Done when:** tests pass; `npm run build:editor` passes; the built `index.html` references the hashed bundle.

### Phase 4 — Trip editor and drag and drop

- Trip editor screen (§8.4 item 3) with the compact stop form (note, time and rating columns, off-route checkbox, collapsible address), PhotoField, `src/editor/core/editing.js` (including `reuseUnchanged`), the star input, section controls with notes, SortableJS as a lazy chunk (§8.5), the memoized `StopCard` (§8.10), Move to…, Undo, Reorder mode, Preview (shared renderer as a lazy chunk and `build.json` preview assets).
- Location auto-fill from the first stop, and the URL path preview.
- Make guide from this log: copy to a new draft (new `id`, `kind: "guide"`, title prefixed "Guide: ", `auto_date` and `captured_at` cleared, section styles kept, all stops kept since guides hide low-rated ones by default), then open it.

**Done when:** tests pass; builds pass; no console errors when rendering the editor with an empty trip (add a small render smoke test using Preact's `render` into a minimal DOM if feasible without new deps; otherwise skip it; the editor is exercised by hand in demo mode, §8.9).

### Phase 5 — Capture

- `src/editor/core/places.js` (including `parseCoordinates`), `src/editor/core/capture.js`, the Capture screen (§8.4 item 4), the active trip, the **Add place here** button.
- `capture.test.js`.

**Done when:** tests pass; builds pass.

### Phase 6 — Settings, analytics, PWA

- Settings editing the data repo's `config.json` (§8.4 item 5), Rebuild button, version display.
- Analytics slot (§7.7) driven by config.
- Manifest, icons (`npm run icons`, commit the PNGs), service worker, update toast, `storage.persist`.

**Done when:** tests pass; editor build output contains `manifest.webmanifest`, `sw.js` with precache list and version, and icons.

### Phase 7 — Workflows, template, scripts, docs

- `.github/workflows/editor.yml` (§9.1), `.github/workflows/release.yml` (§9.3), `templates/data-repo/*` (§9.2, §9.4), `.env.example`, all scripts (§10). Make the bash scripts executable. Run `bash -n` on each.
- `AGENTS.md`: under 80 lines: commands (`npm run check`), a "where to change what" table mapping common tasks to files, the rules that are easy to break (privacy, escaping, `CLIENT_STOP_FIELDS`, shared numbering, tokens/theme sync, CSS order notes, state never imports UI, secrets, service-worker cache, never run the deploy scripts), and the workflow (tests, keep this spec updated, no push unless asked).
- Documentation (take real screenshots of the Pisa example with a real Maps key *without committing the key*; save as `docs/images/trip-desktop.jpg` and `trip-mobile.jpg`):
  - `README.md`: short and public-facing. Title and one-liner; both screenshots at the top; **What it does** (logs and guides, capture on the go, editing with drag and drop, notes and ratings, off-route recommendations, drafts and publishing, reader features, Markdown/`llms.txt`/JSON-LD, privacy); **How it works** (ASCII diagram of editor → data repo → pinned tripbook release → Pages site; stack in one line); **Run it locally** (`npm install`, `npm test`, `npm run build:example && npm run serve`, `npm run build:editor:demo && npm run serve:editor`, "Use sample data"); **Run your own** (link to DEPLOY); a documentation list; license.
  - `docs/DEVELOPMENT.md`: setup, command table, the example site and local Maps key (never commit it), trying the editor without GitHub (§8.9) and service-worker caveats, test table, code layout, conventions, how releases reach the site.
  - `docs/DATA-MODEL.md`: trip and config fields, ratings and off-route semantics, URL rules, what the site build writes, privacy rules.
  - `docs/DEPLOY.md`: a numbered, copy-pasteable guide, in this order: prerequisites (Pages from private repos, a domain, Google Cloud, Node/`gh`); `gh auth login` and `gh auth refresh -s workflow`; verify the domain in GitHub; push tripbook (public); the local `.env`; DNS (two CNAMEs, **DNS only**, and why); Google Cloud (enable Maps JavaScript, Places API (New), Geocoding; referrer-restricted key; Map ID; budget alert); `setup-editor-pages.sh`; first release; `create-data-repo.sh`; wait for certificates and enforce HTTPS on both Pages sites; create the fine-grained token; open the editor, run Setup and install it; set the auto-release secret with `setup-auto-release.sh`; optional analytics and `ai_crawlers`; "Day to day"; keeping tripbook private (not possible with the pinned-checkout design unless using a deploy key or token); troubleshooting table (Pages 404, SSL error from the Cloudflare proxy, map placeholder, 401/403, "uses schema vN", checkout failing because tripbook is private or the tag is not pushed, `config.json` presets overriding new defaults, stale service worker, sync conflicts).

**Done when:** tests and builds pass; `bash -n` passes on every script; docs exist and follow the order above.

### Phase 8 — Final verification

Run and fix until all are true:
- `npm ci && npm run check` passes from a clean `node_modules`.
- `_site/` and `_editor/` contain every file listed in the build tests.
- `grep -rE "20[0-9]{2}-[0-9]{2}-[0-9]{2}" _site --include=*.html --include=*.md --include=*.txt` finds nothing. If the user's own trip text ever contains a date, that is allowed; example data must not.
- Draft HTML contains `noindex`; `_site/index.html`, `sitemap.xml` and `llms.txt` do not mention any draft.
- `find _site -name '*.json'` returns nothing.
- Every user-visible string is escaped (spot-check the render code for any unescaped interpolation).
- `README.md`, `AGENTS.md`, `docs/BUILD.md`, `docs/DEPLOY.md`, `docs/DEVELOPMENT.md`, `docs/DATA-MODEL.md`, `docs/images/*`, `LICENSE` exist; no file contains a Maps key (search for the key prefix `AIza` finds nothing).
- Commit "Phase 8: final verification".

Then tell the user, in at most 10 lines: what was built, the commands to preview locally, and "Next: follow docs/DEPLOY.md", plus any assumptions you made.

---

## 14. Out of scope for v1

Do not build: creating trips from photo EXIF data, user-uploaded photos (only the Wikipedia trip photo exists), KML/GPX export, routing APIs or computed walking times, multiple authors, comments, email or magic links, translations of the UI, a "currently traveling" card, offline maps.
