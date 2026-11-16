# BUILD.md — Tripbook

Build spec for an AI coding agent (Claude Sonnet 5.5 in VS Code Copilot, agent mode).
Build the whole project from this file without asking the user anything, except at the single stop point at the end of Phase 0.

This file describes the project **as it currently stands**, including everything added after the first version (off-route stops, trip photos, demo mode, `.env` support, automatic releases). Following it produces the same structure, modules, behavior, tests and documentation; it does not reproduce the author's code byte for byte. Keep this file in sync whenever behavior changes.

---

## 0. Agent operating rules (read first, follow always)

1. Work phase by phase, in order. Do not start a phase until the previous phase's **Done when** checks pass.
2. Track progress with the git history: one commit per phase, titled `Phase N: <name>`. On every start, read `git log` and resume at the first phase without a commit. Do not create progress files in the repo.
3. Before starting a phase, re-read that phase's section of this file. Do not rely on memory of earlier sections.
4. Never ask the user questions after Phase 0. When something is unspecified, pick the simplest option that satisfies this spec and mention it in the commit message. If it is a lasting design choice, add it to §2 of this file.
5. Terminal commands must be non-interactive. Use `--yes`/`-y` flags. Never start a long-running process (dev server, watcher) in the foreground. Verify with builds and tests, not by watching a server.
6. Make no network calls to Google or GitHub in tests. Mock `fetch`.
7. After each phase: run `npm test`, `npm run build:example` and `npm run build:editor` (once they exist), fix failures, then `git add -A && git commit -m "Phase N: <name>"`.
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
- **Sections** have `style: "route"` (numbered path, legs, directions link) or `style: "list"` (pins only).
- **Stops store everything** (name, address, city, region, country, coordinates), filled from Google at capture time and fully editable afterwards. The build makes no API calls.
- **Markdown:** a small subset (paragraphs, links, bold, italic, lists) for all notes. Raw HTML is escaped.
- **Language:** one `lang` per trip (default `"en"`).
- **Analytics:** optional Google Analytics 4. When `config.google_analytics_id` is set, the gtag snippet goes on published trip pages and listing pages only, never on drafts or the editor.
- **Editor buttons:** **Sync** (commit to the current folder) and **Publish** / **Unpublish** (move between folders in one commit). Conflicts: if the file changed elsewhere, show *Load theirs* / *Overwrite*. No merging.
- **Auto sections while logging:** captures into a `log` trip go into the section for today's local date, created on demand and titled "Day N", renamable.
- **Nearby search:** Places Nearby Search, 75 m radius, 10 results, ranked by popularity, plus a text search box and "Drop pin at my location".
- **Delete:** confirm dialog, then delete the file. Git history is the undo.
- **DNS:** both domains are CNAME records to `<owner>.github.io`, **DNS only** (no Cloudflare proxy), so GitHub can issue and renew certificates (§10, docs).
- **Devcontainer** for all development.
- **Local `.env`** (git-ignored) holds the author's deploy settings so scripts need no flags: `EDITOR_DOMAIN`, `SITE_DOMAIN`, `DATA_REPO` (owner optional), `MAPS_KEY`, `MAP_ID`, `AUTHOR`. Environment variables win over `.env`; flags win over both. `.env.example` is committed.
- **Demo mode:** on localhost the editor can run against a fake GitHub kept in `localStorage`, seeded from the example data (§8.9).
- **Small lasting choices:** `npm test` is `node --test "test/*.test.js"` (Node 24 rejects a bare directory); `buildSite()` and `buildEditor()` are exported so tests call them directly; the Maps loader lives in `src/shared/maps-loader.js` for both site and editor; the service worker only skips waiting when the page posts `skip-waiting` (the "Update available" toast); `github.js` treats any 409, and a 422 whose message mentions `sha` or `does not match`, as a conflict; `getFile` returns `{ data, sha }` (or `null` on 404) and `putFile` returns the new sha; trip records carry an `auto_sync` flag, set after the first Sync, so automatic retries only touch trips the user has synced; editor screens render only after local data has loaded (`ready` signal); `renderMarkdown` turns headings into bold paragraphs and drops images and unsafe link schemes; LICENSE holder is "Alessio Signorini".

---

## 3. Stack

One language (JavaScript) for the site build and the editor, so rendering code is shared. The site build and the editor's preview call the same render functions.

- **Runtime:** Node 24 LTS, ES modules everywhere (`"type": "module"`).
- **Editor UI:** Preact + htm + @preact/signals. No JSX compile step; htm tagged templates. Bundled by esbuild.
- **Drag and drop:** SortableJS.
- **IndexedDB:** idb-keyval.
- **Markdown:** marked.
- **Bundler:** esbuild (JS API, called from the build scripts).
- **Tests:** `node:test` + `node:assert` (built in).
- **Photos:** Wikipedia and Wikimedia Commons APIs, called from the editor only (`src/shared/wikipedia.js`).
- **Static server for local preview:** sirv-cli (dev dependency).
- **Icons:** sharp (dev dependency, used once by `scripts/make-icons.mjs`; the PNGs are committed).
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
  shared/
    schema.js             SCHEMA_VERSION; DEFAULT_CONFIG; mergeConfig(); validateTrip(trip) -> string[]; newTrip(); newSection(); newStop()
    slug.js               slugify(text)
    paths.js              tripPath(trip, config, {draft}) ; listingPrefixes(trip, config); listingCrumbs(); findCollisions()
    maps-links.js         shortlistUrl, shortlistCount, directionsUrl, stopDirectionsUrl, openInMaps(stops, routeStops)
    maps-loader.js        Google Maps JS bootstrap loader (site and editor)
    markdown.js           renderMarkdown(text) with HTML escaped; stripMarkdown(text, max)
    format.js             formatMinutes, sectionLetter, totalMinutes, escapeHtml, locationText, shortAddress, kindLabel, plural
    rating.js             renderStars(rating), renderStarCompact(rating), isLow(stop)
    visible.js            visibleStops(trip, {showLow}) -> sections with numbering, off-route letters, counts, minutes; allVisible()
    wikipedia.js          findWikipediaPhoto(title, fetchImpl) -> trip.photo object | null
    render/
      layout.js           page shell (head, fonts, css link, analytics slot, noindex)
      trip.js             renderTripPage(trip, ctx) -> HTML string
      listing.js          renderListing(groups, ctx) -> HTML string (index + prefix pages)
      redirect.js         renderRedirect(toUrl)
      trip-md.js          renderTripMarkdown(trip, ctx) -> Markdown string (§7.10)
      llms.js             renderLlmsTxt(trips, ctx), renderLlmsFull(trips, ctx)
      jsonld.js           tripJsonLd(trip, ctx) -> object
      photo.js            photoCredit(photo) -> credit line HTML
      icons.js            inline SVG icons for the site
  build/
    bundle.mjs            esbuild helpers + content hashing (shared)
    build-site.mjs        CLI: --data <dir> --out <dir>   (run by the data repo)
    build-editor.mjs      CLI: --out <dir>                (run by this repo)
  site/
    site.css
    trip.js               map, bottom sheet, low-rating switch, list<->map sync
  editor/
    index.html
    main.js               app entry (Preact)
    app/                  Preact screens: App, Setup, Trips, TripEditor, Sections, StopCard, Capture, MapPicker, PhotoField, Settings, Conflict, fields, ui, state, countries
    github.js             GitHub REST client
    sync.js               sync, publish, unpublish, delete, conflict resolution, pull
    store.js              IndexedDB + localStorage persistence
    demo.js               fake GitHub client + sample-data seeding (§8.9)
    editing.js            pure trip edit operations (setTitle, moveStop, moveSection, autofillLocation, makeGuide, …)
    places.js             Google Places / Geocoder helpers
    capture.js            geolocation + "Day N" section logic + coordinate parsing
    editor.css
    sw.js                 service worker (scope /)
    manifest.webmanifest
    icons/                icon.svg, icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
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
  *.test.js
```

`package.json` scripts:

```json
{
  "build:example": "node src/build/build-site.mjs --data examples/data --out _site",
  "build:editor": "node src/build/build-editor.mjs --out _editor",
  "build:editor:demo": "node src/build/build-editor.mjs --out _editor --demo",
  "serve": "sirv _site --port 8080 --dev --host",
  "serve:editor": "sirv _editor --port 8081 --dev --host --single",
  "test": "node --test \"test/*.test.js\"",
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
- `sections`: array (may be empty for a new trip). Section `id` unique within trip. `title`: string (may be empty). `note`: string (may be empty). `style`: `"route" | "list"`. `auto_date`: `YYYY-MM-DD` or null (editor-only, never rendered).
- Stop `id` unique within trip. `name`: non-empty. `lat` in [-90, 90]; `lng` in [-180, 180]. `place_id`: string or null. `coords_source`: `"device" | "place" | "pin"`. `minutes`: positive integer or null. `leg_to_next`: string or null. `note`: string (may be empty). `rating`: integer 1–5 or null. `off_route`: optional boolean (only meaningful in `route` sections). `captured_at`: ISO string or null.
- Unknown fields: allowed and preserved (forward compatibility).

### 5.2 `config.json` (data repo root)

```json
{
  "site_title": "Trips",
  "author": "Alessio",
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

A full rebuild every run is intended. No incremental logic. Hash = first 8 hex chars of SHA-256 of the output content.

### 6.1 Site build (`src/build/build-site.mjs`)

Input: `--data <dir>` (contains `config.json`, `drafts/`, `published/`), `--out <dir>`.

Steps:
1. Empty `--out`.
2. Load config, merge over `DEFAULT_CONFIG`.
3. Load all trips. Validate. Collect all errors across all files, print them, exit 1 if any.
4. Check path collisions (§5.3).
5. Bundle `src/site/trip.js` → `assets/trip.<hash>.js` (minified, ESM, target es2020) and `src/site/site.css` → `assets/site.<hash>.css`.
6. Render each published trip to `<path>/index.html`. Render each draft to `/drafts<path>/index.html` with `noindex`.
7. Render listing pages from published trips only: `/index.html` (all) and every listing prefix (`/italy/index.html`, `/usa/california/index.html`, …).
8. Render redirects for `old_paths`.
9. Write `404.html` (simple, links to `/`), `robots.txt` (§7.10), `sitemap.xml` (published trip URLs and listing URLs, absolute with `base_url`, **no `lastmod`**).
10. For each published trip, write `<path>/index.md` (§7.10). Write `/llms.txt` and `/llms-full.txt` from published trips only.
11. Never copy anything from `--data` into `--out`. Only rendered files and bundled assets go into the output.
12. Every page gets `<meta name="generator" content="tripbook <package.json version>">`.
13. Print a summary: counts of published, drafts, listing pages, redirects, Markdown files.

### 6.2 Editor build (`src/build/build-editor.mjs`)

Input: `--out <dir>`. Output is the root of the editor site.

Steps:
1. Empty `--out`.
2. Bundle `src/editor/main.js` → `app.<hash>.js` and `src/editor/editor.css` → `editor.<hash>.css`.
3. Bundle the site assets for Preview: `preview/trip.<hash>.js`, `preview/site.<hash>.css` (same sources as §6.1).
4. Copy `index.html` with the hashed names injected, `manifest.webmanifest`, `icons/`.
5. Write `build.json`: `{ version, commit, preview: { trip_js, site_css } }`. `version` from `package.json`; `commit` = first 7 chars of `GITHUB_SHA`, else `git rev-parse --short HEAD`, else `"dev"`.
6. Write `sw.js` with `CACHE_VERSION` = hash of all output asset names, and the list of shell files to precache (including `build.json` and the preview assets).
7. Write `404.html` that redirects to `/` (the editor uses hash routes).
8. With `--demo` (`npm run build:editor:demo`): also write `demo/data.json` (config, published and draft trips from `examples/data`) used by §8.9. It is never added to the service-worker shell list. The deployed editor is built without `--demo`.
9. `buildEditor({ out, demo, log })` and `buildSite({ data, out, log })` are exported; the CLI runs only when the file is the entry point.

---

## 7. Public site

### 7.1 Visual design tokens (from the approved mockups)

- Fonts: Inter (body; 400/500/600/700) and Space Grotesk (headings; 500/700) via Google Fonts `css2` link.
- Colors: ink `#1A1D21`, body text `#2F3337`, secondary `#5F6368`, border `#E4E6E1`, surface `#F1F2EF`, page `#FFFFFF`, accent (pins, route) `#C2410C`, accent text on white `#9A3412`, selected-row tint `#FBEFE9`, location dot `#1A73E8`, empty star `#D3D6D0`.
- Radius 10–16 px; touch targets ≥ 44 px; visible focus rings; text contrast ≥ 4.5:1.
- Icons: inline stroke SVG, no emoji, no icon font.

### 7.2 Trip page — desktop (≥ 900 px)

- **Header:** kicker (`Guide · Pisa, Italy`, `Trip log · Maui, Hawaii`; drafts are prefixed `Draft · `; location = city, region, country, skipping empty parts), H1 title, and the trip `note` (Markdown). The buttons **Open in Google Maps** (primary; §7.5) and **Share** (`navigator.share`, fallback: copy the URL and show a toast) sit at the top right of the header. There is no "By …" line and no meta row.
- **Stats:** a gray `(N stops · About 3 h)` is appended at the end of the trip note for single-section trips (updates with the low-rated switch). Multi-section trips show the count and time in each section header instead.
- **Body:** two columns. Left: map, sticky, height `calc(100vh - 32px)`, min 520 px. Right (list column, 100 px wider than the first design): the low-rated switch (§7.9), then the stop list. **There are no section tabs**: every section is shown inline, one after another.
- **Stop row:** number badge (`3`, or `A3` when the trip has more than one section), name (H3), the time pill (`20 min`, `1 h 30 min`; omitted if null) right after the name, then one line with the compact rating (one proportional star + `(4/5)`, §7.8) to the left of the address (secondary text), then the stop note (Markdown). Title, stars and address are tightly spaced. Between consecutive visible stops in a `route` section, a dotted connector with `leg_to_next` text if present. A small directions icon (no text) links to `stopDirectionsUrl` (§7.5).
- **Section header** (shown when the trip has more than one section or the section has a title): `A · Lahaina` (letter only when more than one section), stop count, total time, and for `route` sections the **Route in Google Maps** link. Below it, the section `note` (Markdown) when non-empty.
- Hover or focus on a stop row highlights its pin. Click on a pin scrolls to and highlights the row.
- Separators in text are `·`.

### 7.3 Trip page — mobile (< 900 px) — "Layout B"

The reader is on the ground. No editing or sharing chrome.
- Full-screen map behind everything.
- **Top floating card** (left): title (one line, ellipsis) and `By <author> · about <total>`. **Top-right**: one 52 px icon-only button, `aria-label="Open in Google Maps"`, linking per §7.5.
- **Blue location dot** via `navigator.geolocation.watchPosition`, only after the user taps the "locate" button (never prompt on load).
- **Bottom sheet** with drag handle and three snap points (peek 28 %, half 55 %, full 90 %). Pointer-events drag on the handle and header; snap to nearest on release; the handle is a button that cycles snap points.
- Inside the sheet: the low-rated switch, then the trip note (clamped to 3 lines with a **More** toggle), then the sections and stops.
- **Rows** show the number badge, name, time, and compact rating placed to the left of the address or note. The rating star is floated so wrapped text runs under it. Instead of the full address, mobile shows the stop note, or, when there is no note, the **short address** (`shortAddress()`: street only, dropping city, region, country and postal parts). Both `.addr-full` and `.addr-short` are in the HTML and toggled by a media query. A 44 px directions icon button is on each row. Tapping a pin selects its stop, scrolls the sheet to it and raises the sheet to half if at peek.
- Hide the header share button and the desktop "Open in Google Maps" button on mobile.

### 7.4 Map behavior (`src/site/trip.js`)

- Trip data is embedded in the page as `<script type="application/json" id="trip-data">` containing only fields the client script needs: `id`, `kind`; section ids, letters, titles, styles; stops' id, name, lat, lng, place_id, rating, **minutes** and (when true) **off_route**. `trip.js` needs `minutes` and `off_route` to recompute totals and labels when the switch changes (it breaks silently without them). **No dates.**
- The Maps key and Map ID are injected as data attributes on `<body>`. If the key is empty, show a placeholder box: "Map unavailable: add google_maps_api_key to config.json".
- Advanced Markers with `PinElement` (`background #C2410C`, `borderColor #FFFFFF`, `glyph` = label, `glyphColor #FFFFFF`); the selected pin is `#1A1D21` and scaled 1.3. **Off-route pins** are white with a gray outline and a gray glyph (letter).
- `route` sections: a dashed `Polyline` (straight segments, accent color) through the visible, on-route stops in order. `list` sections: no line.
- Fit bounds to all visible markers with padding (on mobile, bottom padding = current sheet height).
- Markers, lines, numbers and links always follow the low-rating switch (§7.9).

### 7.5 Google Maps links (`src/shared/maps-links.js`)

- `shortlistUrl(stops)`: `https://www.google.com/maps/@?api=1&map_action=shortlist&place_ids=<id1>,<id2>,…` using stops with a `place_id`, max 20, in order. Return null if none.
- `directionsUrl(stops)`: `https://www.google.com/maps/dir/?api=1&origin=<lat,lng>&destination=<lat,lng>&waypoints=<lat,lng>|…&travelmode=walking`; add `origin_place_id`, `destination_place_id`, `waypoint_place_ids` (pipe-separated, aligned with waypoints) when every relevant stop has a `place_id`. Max 9 waypoints (11 stops total); if more, return an array of URLs, each chunk sharing its first stop with the previous chunk's last stop. Keep each URL ≤ 2048 characters (drop place_id params if needed to fit).
- `stopDirectionsUrl(stop)`: `https://www.google.com/maps/dir/?api=1&destination=<lat,lng>&travelmode=walking` plus `destination_place_id` if present.
- **Open in Google Maps** button: `openInMaps(routeStops)` over all visible on-route stops: the first `directionsUrl` (walking directions through every stop in order, so the user can press Start); with more than 11 stops the button opens part 1 and the per-section "Part N" links cover the rest. A single stop opens directions to it. **No note** is shown.
- **Route in Google Maps** (route sections): `directionsUrl` over the section's on-route visible stops; multiple chunks render as `Part 1`, `Part 2`.
- Always computed from **visible** stops (§7.9). The build computes them for the default state; `trip.js` recomputes them on toggle with the same modules.
- Unit-test all limits and encodings.

### 7.6 Listing pages (`src/shared/render/listing.js`)

- `/`: site title, author, then groups: country (H2), then region (H3; trips without region listed directly under the country first), then trip cards sorted by title. Card: title (link), kind badge (`Guide` / `Trip log`), city (if any), `<N> stops`, total time, and a note excerpt (Markdown stripped, ≤ 200 chars). When the trip has a `photo`, a 96 px square thumbnail on the left. A collapsed **Photo credits** `<details>` block at the bottom of the page lists each photo's credit line (`photoCredit`: title, author, licence link, source link). **No dates.**
- Prefix pages (`/usa/`, `/usa/california/`, …): same layout, filtered to that prefix, with a breadcrumb.
- No maps on listing pages.

### 7.7 Layout shell (`src/shared/render/layout.js`)

- `<html lang>` from trip `lang` (listing: `default_lang`).
- `<title>`, meta description (trip note's first 160 chars, Markdown stripped), canonical URL, Open Graph `og:title`, `og:description`, `og:url`, `og:site_name`, `og:type=website`, and `twitter:card`: `summary_large_image` with `og:image` and `twitter:image` when the trip has a `photo`, otherwise `summary`. Drafts get the same tags so live links preview well.
- Published trip pages: `<link rel="alternate" type="text/markdown" href="index.md">` and a `<script type="application/ld+json">` block from `tripJsonLd` (§7.10).
- Drafts: `<meta name="robots" content="noindex">`, and no analytics.
- Analytics slot: if `google_analytics_id` is non-empty and the page is published or a listing page, add the standard gtag.js snippet with that ID.
- Escape all user text. Markdown only through `renderMarkdown`.

### 7.8 Rating display (`src/shared/rating.js`)

Both functions return inline SVG markup and are used by the site and the editor.
- `renderStars(rating)` (used by the editor): five 16 px star icons in a row, 2 px gap. Stars `1..rating` filled `#C2410C`; the rest filled `#D3D6D0`. Wrapper has `role="img"` and `aria-label="Rated 4 out of 5"`.
- `renderStarCompact(rating)`: one 16 px star, filled from left to right in proportion `rating / 5` (accent), with the remainder grey. Implement with a `linearGradient` whose two stops sit at the same offset (hard edge). Give each gradient a unique `id` per call. Follow it with `(4/5)` in 12 px secondary text. Same `role` and `aria-label`.
- `isLow(stop)`: `rating === 1 || rating === 2`. Unrated stops are never low.
- Where each appears: the **site shows only the compact form** (desktop and mobile). The editor's collapsed cards use the compact form and its rating input uses five tappable stars. Null rating: render nothing.
- Unit-test: star counts, gradient offset (`80%` for 4), unique IDs, aria labels, `isLow`.

### 7.9 Low-rated places toggle

- Shown only when the trip has at least one low stop: a subdued, right-aligned switch above the stop list (desktop and mobile), labelled `Show low-rated places (N)`. Real `<input type="checkbox" role="switch">` with a `<label>`.
- Default: off for `guide`, on for `log`. The viewer's choice is remembered in `localStorage["tripbook.show_low.<trip id>"]` (wrap in try/catch).
- `visibleStops(trip, { showLow })` in `src/shared/visible.js` returns, per section: `stops` (each `{ stop, visible, offRoute, number, label }`), `visibleStops`, `routeStops` (visible and on-route), `count` and `minutes`. The build renders the default state with it; `trip.js` uses it again on toggle.
- The HTML contains **every** stop. Stops hidden in the default state carry the `hidden` attribute and `data-low`. On toggle, `trip.js` shows or hides those rows, renumbers badges, updates counts, totals, legs (a leg connector is shown only between two visible stops), markers, polylines and all Google Maps links.
- Without JavaScript the page shows the default state with correct numbers and links.
- The editor ignores this and always shows every stop.

### 7.9a Off-route places

- `stop.off_route === true` applies only in `route` sections; in `list` sections it is ignored.
- An off-route stop keeps its place in the list order (with time, rating, address, note) but takes no number. It gets a letter label `A`, `B`, `C`… counted across the **whole trip** (not per section) and the following numbers do not skip. Numbers and letters are computed by `visibleStops`.
- It is excluded from the polyline, from leg connectors (a leg is shown only between two visible **on-route** stops), from `Route in Google Maps` and from the directions fallback; it still counts in the stop total and time and is in the shortlist.
- Rendering: the row has class `off-route` and a `badge-num off` (white fill, gray outline); the map pin is white with a gray outline and gray letter. `trip.js` recomputes labels on toggle.
- The example data includes one (§11).

### 7.10 LLM and crawler output

- **Markdown per published trip** (`src/shared/render/trip-md.js`), at `<path>/index.md`:
  ```
  # <title>
  <Guide|Trip log> · <city, region, country> · By <author>
  Web: <absolute page URL>

  <trip note>

  ## A · <section title>          (omit the letter when there is one section)
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
- **`robots.txt`**: always `User-agent: *` / `Disallow: /drafts/` and the `Sitemap:` line. If `config.ai_crawlers` is `"disallow"`, add a block per agent: `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `Claude-User`, `Claude-SearchBot`, `Google-Extended`, `CCBot`, `PerplexityBot`, `Applebot-Extended`, `Bytespider`, `meta-externalagent`, each with `Disallow: /`. When `"disallow"`, also skip writing `llms.txt` and `llms-full.txt`.
- Drafts never get Markdown, JSON-LD or an entry in `llms.txt`.

---

## 8. Editor PWA (editor domain, root `/`)

### 8.1 Storage and auth

- `localStorage["tripbook.settings"]`: `{ owner, repo, branch, token, active_trip_id, demo }`.
- IndexedDB (idb-keyval):
  - `trip:<id>` → `{ trip, folder: "drafts"|"published"|null, sha: string|null, dirty: boolean, path_at_sync: string|null, synced_at: ISO string|null, auto_sync }`. `folder: null` means never synced.
  - `config` → `{ config, sha }` (the data repo's `config.json`, cached for offline use).
- Never send the token anywhere except `https://api.github.com`.

### 8.2 GitHub client (`src/editor/github.js`)

Plain `fetch` with headers `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.

- The editor reads and writes only `config.json`, `drafts/*.json` and `published/*.json` at the data repo root. Nothing else.
- `getRepo()` → default branch.
- `listFolder(folder)` → `GET /repos/{o}/{r}/contents/{folder}?ref={branch}`; 404 → `[]`.
- `getFile(path)` → content (base64 → bytes → `TextDecoder('utf-8')` → JSON) and `sha`.
- `putFile(path, json, sha|null, message)` → `PUT /contents/{path}`; content = UTF-8 bytes via `TextEncoder`, then base64 (handle non-ASCII correctly; unit test with `"Caffè"`). Returns new `sha`. 409 or 422 with a sha mismatch → throw `ConflictError`.
- `deleteFile(path, sha, message)`.
- `moveFile(fromPath, toPath, json, expectedFromSha, message)`: single commit via Git Data API: `GET /git/ref/heads/{branch}` → `GET /git/commits/{sha}` → verify via `getFile(fromPath)` that the sha equals `expectedFromSha` (else `ConflictError`) → `POST /git/trees` with `base_tree` and entries `[{ path: toPath, mode: "100644", type: "blob", content }, { path: fromPath, mode: "100644", type: "blob", sha: null }]` → `POST /git/commits` → `PATCH /git/refs/heads/{branch}`. Returns the new blob sha of `toPath` (read it back with `getFile`).
- `dispatchRebuild()` → `POST /repos/{o}/{r}/actions/workflows/site.yml/dispatches` with `{ ref: branch }`. Optional; needs Actions write permission; on 403, show "Token lacks Actions permission".
- Commit messages: `Sync: <title>`, `Publish: <title>`, `Unpublish: <title>`, `Delete: <title>`, `Config: update`.

### 8.3 Sync semantics

- Every edit saves the local record immediately (`dirty: true`).
- **Sync**: if `folder` is null → create in `drafts/`. Else `putFile` to `<folder>/<id>.json` with the stored sha. Before sync: run `validateTrip`. Block and show errors inline if invalid. For published trips, apply the `old_paths` rule (§5.3) before writing. New trips are written with `v: SCHEMA_VERSION`.
- **Publish** (draft): run Sync first if dirty, then `moveFile(drafts → published)`. **Unpublish**: the reverse.
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
   - Top bar: back, title, sync status, **Sync**, **Publish**/**Unpublish**, overflow menu (Copy live link, Preview, Set as active trip, Make guide from this log, Delete).
   - Header fields, in this order: **Title**; **Kind** (segmented Guide/Log) with **Slug** beside it (auto from title until edited; the computed URL path is shown as small text under the slug); **Trip note** (auto-growing textarea, Markdown hint); **PhotoField** (search a Wikipedia article title with `findWikipediaPhoto`, preview the lead image and credit, accept or clear it; the Find button sits beside the field); a collapsible **Location** toggle (same `details-toggle` style as the stop form's address toggle) that shows a summary (`city, region, country`) when collapsed and is open by default only when the trip has no country. Location fields: **Country** (text input with a `<datalist>` of all ISO countries from `src/editor/app/countries.js`, built with `Intl.DisplayNames`; choosing a known name also fills the country code), country code, region, city. Location is prefilled from the first stop when empty; leave region blank to omit it from the URL.
   - **Sections:** each with drag handle, letter, title input, style toggle (Route/List), section note (auto-growing textarea, collapsed to one line until focused), stop count, collapse toggle, overflow menu (Move up/down, Delete section).
   - **Stops:** cards with drag handle, number (or letter for off-route stops), name, time, compact rating; tap to expand into the **compact stop form**, in this order:
     1. name, then the **note** (Markdown) directly under it;
     2. two columns: **time** on one side and **rating** (five 44 px tappable stars; tapping the current value clears it) to the left of it. Time = preset chips from `config.time_presets` (default 10, 30, 45, 1 h) plus a small numeric **minutes** input for custom values; custom minutes are rounded to 15-minute blocks when rendered (e.g. 105 → `1 h 45 min`);
     3. an **Off the route** checkbox (only for stops in `route` sections);
     4. an **Address and location** toggle, collapsed by default, hiding address, city, region, country, country code, lat/lng (with "Use my location" and a map picker modal for dragging a pin) and the read-only **place_id** (with Clear) which sits next to the address;
     5. **leg to next** (route sections).
   - **Add stop** button at the end of each section, opening the Capture sheet in "search" mode (no GPS required).
   - **Reorder mode** toggle: collapses all stop cards to one line for fast dragging.
   - **Preview**: full-screen modal with an `<iframe srcdoc>` rendered by `renderTripPage` from `src/shared/render/trip.js`, using the preview assets listed in `build.json` (absolute URLs built from `location.origin`) and the cached config.
4. **Capture** (bottom sheet or full-screen on mobile; matches the approved mockup):
   - "Adding to: <trip>" with a trip picker (defaults to the active trip; "New trip…" creates a log titled with the city of the first result).
   - Location line: "Near <first result's area> · ±<accuracy> m".
   - The search box also accepts pasted coordinates (`43.7110, 10.3994`, parsed by `parseCoordinates` in `places.js`): they are reverse-geocoded and shown as a pin result instead of calling Places text search (which rejects coordinates). Use this to start a guide at a point with no business.
   - Up to 10 suggestions as large radio cards (name, type, distance in m). The selected card expands to show time chips, the five-star rating input and a note field.
   - "Not listed? Search a place" (Places text search biased to the current location) and **Drop pin at my location**.
   - Primary button: **Add as stop N**.
   - On add: fill all stop fields from the place (or reverse geocode for a pin), set `coords_source`, set `captured_at` to now with offset, place the stop per §8.6, save locally, close, toast "Added. Sync when ready." with **Sync** action.
5. **Settings:** edits the data repo's `config.json` (load, form for every field in §5.2, Save = `putFile` with sha, conflict handling as trips). Also: active trip, Change repo/token, **Rebuild site** (`dispatchRebuild`), app version and commit from `build.json`.

### 8.5 Drag and drop (SortableJS)

- One Sortable on the sections container (`group: "sections"`, `handle: ".drag-section"`).
- One Sortable per section's stop list, all sharing `group: "stops"` so stops move across sections.
- Options for both: `animation: 150`, `forceFallback: true`, `fallbackOnBody: true`, `delay: 150`, `delayOnTouchOnly: true`, `scroll: true`, `bubbleScroll: true`, `ghostClass`, `chosenClass`, `dragClass` styled visibly.
- **Preact integration gotcha:** Sortable mutates the DOM. In `onEnd`, first put the DOM node back where it was (`from.insertBefore(item, from.children[oldIndex] ?? null)`), then update state (move the stop between section arrays by index), and let Preact re-render. Key every list item by `id`.
- Every stop card also has **Move to…** in its menu: choose section, then *Top* or *Bottom*. Same for keyboard users.
- **Undo:** keep the previous trip state for the last structural change (move, delete, add section). Show a toast "Moved. Undo" for 6 s.
- Pin numbers in Preview and map pickers reflect the new order immediately.

### 8.6 Capture placement rules (`src/editor/capture.js`)

- `kind: "log"`: find the section whose `auto_date` equals today's local date (`YYYY-MM-DD` in device time zone). If none, create one at the end: `{ title: "Day N", style: "list", auto_date: today }`, where N = number of sections with non-null `auto_date` + 1. Append the stop.
- `kind: "guide"`: append to the last section, creating `{ title: "", style: "route" }` if there are none.
- Unit-test both, including the date boundary.

### 8.7 Places helpers (`src/editor/places.js`)

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
- `sw.js`: precache the shell (index, JS, CSS, manifest, icons, `build.json`, preview assets). Cache-first for shell files, network-only for `api.github.com` and Google domains. Delete old caches on activate. Show an "Update available, reload" toast when a new SW is waiting.
- `navigator.storage.persist()` on first run.
- Settings shows a one-line tip: "Install to your home screen so the device keeps your offline drafts."

### 8.9 Demo mode (localhost only)

- `src/editor/demo.js`: `createFakeGithub()` implements the same interface as `github.js` (`getRepo`, `listFolder`, `getFile`, `putFile`, `deleteFile`, `moveFile`, `dispatchRebuild`) over a JSON object kept in `localStorage`, with real sha and conflict behavior. `seedDemo(data)` fills it from `demo/data.json` (§6.2 step 8); `clearDemo()` resets it.
- `settings.demo = true` makes `gh()` in `app/state.js` return the fake client; Setup's **Use sample data** button (visible only on `localhost`/`127.0.0.1`) seeds it and skips the token. Settings → Change repo/token leaves demo mode.
- Tests cover the fake client (including conflicts).

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

Triggers: push to `main` touching `src/shared/**`, `src/site/**`, `src/build/build-site.mjs`, `src/build/bundle.mjs`, `package.json` or `package-lock.json`; and `workflow_dispatch`. Editor-only changes never release. Permissions `contents: write`; `concurrency: release` without cancelling. Env: `DATA_REPO` from `vars.DATA_REPO`, `DATA_REPO_TOKEN` from `secrets.DATA_REPO_TOKEN`.

Steps: checkout with `fetch-depth: 0` and tags; setup-node 24 with npm cache; `npm ci`; `npm test`; **pick the version**: if HEAD already has a `v*` tag, skip everything; otherwise `MM` = `major.minor` of `package.json`, `LAST` = highest numeric patch among tags `v$MM.*`, tag = `v$MM.$((LAST+1))` (start at `.0`); `git tag` and push it; then, only if both `DATA_REPO` and `DATA_REPO_TOKEN` are set, with `GH_TOKEN=DATA_REPO_TOKEN`: `gh variable set TRIPBOOK_REF -R $DATA_REPO -b <tag>` and `gh workflow run site.yml -R $DATA_REPO`; otherwise print a `::notice::` saying the site was not rebuilt and to run `scripts/setup-auto-release.sh`. (A workflow's own `GITHUB_TOKEN` cannot set variables or dispatch workflows in another repo, hence the personal token.)

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

`npm test` runs `node --test "test/*.test.js"`. Nine files, all of which must pass; no network calls (mock `fetch`; stub `places.js`). Cases per file:

- `shared.test.js` (one file for all `src/shared` modules except render):
  - slug: diacritics (`Città` → `citta`), spaces, punctuation, trimming.
  - paths: both example paths; region omitted; country slug override; draft prefix; listing prefixes; collision detection.
  - schema: valid examples pass; each rule fails with a readable message; unknown fields preserved; `v: 2` fails with the exact release message; `photo` (https only) and `off_route` validation; `mergeConfig`.
  - maps-links: shortlist max 20 and order; null when no place_ids; directions chunking at 11 stops with a shared boundary stop; place_id alignment; 2048-char cap; `openInMaps` uses route stops for the directions fallback.
  - markdown: links, bold, lists; `<script>` escaped; headings and images flattened; `stripMarkdown`.
  - rating: star counts, gradient offset (`80%` for 4), unique ids, aria labels, `isLow`.
  - visible: guide default hides low stops and numbers the rest 1..n without gaps; `showLow: true` includes and renumbers; multi-section labels `A1`, `B1`; totals and counts follow visibility; unrated stops never hidden; off-route stops get letters across the trip, take no number, are excluded from `routeStops`, and are ignored in `list` sections.
  - format: `formatMinutes`, `shortAddress`, `locationText`.
- `render.test.js`:
  - Pisa page: stop names, numbers, dotted legs, trip note, section note, compact star markup for the rated stop; the off-route stop has class `off-route` and letter `A` and no leg connectors around it; the stats `(N stops · time)` appear in the trip note; no section tabs; no "without a Google place" text.
  - Santa Barbara log page: **no `captured_at` values, no `auto_date` values and no 4-digit years from those dates appear in the HTML**; Butterfly Beach is visible (no `hidden` attribute); the switch is present, checked, labelled `Show low-rated places (1)`; the empty "Waterfront" note produces no empty wrapper element.
  - Draft guide page: contains `noindex` and no gtag; the "Tourist-trap café" row exists with `hidden` and `data-low`; the switch is present and unchecked; visible numbers are 1, 2, 3; the default directions link does not include the café's coordinates.
  - Pisa page has no switch; analytics only when the ID is set, never on drafts; the embedded `#trip-data` contains `minutes` and `off_route`; `og:image` appears only with a photo; listing cards show thumbnails and the credits block; user text is escaped.
- `trip-md.test.js`: Pisa Markdown has the title, note, numbered stops with Google Maps links, the 5/5 rating, and the off-route stop under "Also recommended (not on the route):"; the layover guide puts "Tourist-trap café" only under `## Not recommended`; the Santa Barbara log lists Butterfly Beach inline; no ISO dates, no `place_id`, no `captured_at`; empty fields leave no empty labels; `llms.txt` lists both published trips with absolute `.md` URLs and never the draft; `llms-full.txt` contains both; JSON-LD parses, has visible stops only, no `rating` key and no dates; `robots.txt` with `ai_crawlers: "disallow"` lists each agent and the llms files are not written.
- `build-site.test.js`: build `examples/data` into a temp dir via `buildSite`; assert the expected files exist (both trip pages, the draft page, `/index.html`, `/italy/index.html`, `/usa/california/index.html`, `sitemap.xml` without `lastmod`, `robots.txt`, hashed assets); the index and sitemap do not mention the draft; **the output contains no `.json` file at all**; each published trip has `index.md` and the draft does not; `llms.txt` and `llms-full.txt` exist; redirects for `old_paths`; collisions and validation errors fail the build.
- `build-editor.test.js`: build into a temp dir via `buildEditor`; `index.html` references the hashed bundle; `build.json` has version and preview assets; `sw.js` lists the shell files; `manifest.webmanifest` has `start_url "/"`; the normal build has no `demo/` and the `--demo` build has `demo/data.json` that is not in the shell list.
- `github.test.js` (mock `fetch`): base64 round trip with non-ASCII; 409 and sha-mismatch 422 → `ConflictError`; `moveFile` sends one tree with an add and a delete; paths have no `data/` prefix; sync, publish and conflict logic from `sync.js`; the fake client from `demo.js` (create, update, conflict, move, delete).
- `editing.test.js`: slug follows the title until edited; moving stops across sections and reordering sections; `autofillLocation`; `makeGuide` (new id, "Guide: " prefix, dates cleared).
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
- Implement `src/shared/` except `render/`: `schema.js`, `slug.js`, `paths.js`, `maps-links.js`, `maps-loader.js`, `markdown.js`, `format.js`, `rating.js`, `visible.js`, `wikipedia.js`.
- Write the example data (§11).
- Write `shared.test.js` (§12) and `wikipedia.test.js`.

**Done when:** `npm test` passes.

### Phase 2 — Site build and public site

- Implement `src/shared/render/*` (including `trip-md.js`, `llms.js`, `jsonld.js`, `photo.js`, `icons.js`), `src/site/site.css`, `src/site/trip.js` (including the low-rating switch, §7.9, and off-route pins, §7.9a), `src/build/bundle.mjs`, `src/build/build-site.mjs` per §6.1 and §7.
- Write `render.test.js`, `trip-md.test.js` and `build-site.test.js`.
- Run `npm run build:example`. Inspect the generated HTML files by reading them (do not start a server). Check the structure matches §7.

**Done when:** `npm test` and `npm run build:example` pass; the date-leak and toggle assertions pass.

### Phase 3 — Editor foundations: build, storage, GitHub, sync

- `src/build/build-editor.mjs` (§6.2, including `--demo`) with a minimal app so it builds.
- `src/editor/github.js`, `src/editor/store.js`, `src/editor/sync.js`, `src/editor/demo.js`, sync semantics (§8.1–§8.3) and demo mode (§8.9).
- Screens: Setup, Trips list (with sync badges, the conflict modal, the "local changes not synced" banner), the Settings shell.
- App shell: header, simple hash router (`#/`, `#/trip/<id>`, `#/settings`, `#/setup`), toast system, modal system.
- `github.test.js`, `build-editor.test.js`.

**Done when:** tests pass; `npm run build:editor` passes; the built `index.html` references the hashed bundle.

### Phase 4 — Trip editor and drag and drop

- Trip editor screen (§8.4 item 3) with the compact stop form (note, time and rating columns, off-route checkbox, collapsible address), PhotoField, `src/editor/editing.js`, the star input, section controls with notes, SortableJS (§8.5), Move to…, Undo, Reorder mode, Preview (shared renderer and `build.json` preview assets).
- Location auto-fill from the first stop, and the URL path preview.
- Make guide from this log: copy to a new draft (new `id`, `kind: "guide"`, title prefixed "Guide: ", `auto_date` and `captured_at` cleared, section styles kept, all stops kept since guides hide low-rated ones by default), then open it.

**Done when:** tests pass; builds pass; no console errors when rendering the editor with an empty trip (add a small render smoke test using Preact's `render` into a minimal DOM if feasible without new deps; otherwise skip it; the editor is exercised by hand in demo mode, §8.9).

### Phase 5 — Capture

- `src/editor/places.js` (including `parseCoordinates`), `src/editor/capture.js`, the Capture screen (§8.4 item 4), the active trip, the **Add place here** button.
- `capture.test.js`.

**Done when:** tests pass; builds pass.

### Phase 6 — Settings, analytics, PWA

- Settings editing the data repo's `config.json` (§8.4 item 5), Rebuild button, version display.
- Analytics slot (§7.7) driven by config.
- Manifest, icons (`npm run icons`, commit the PNGs), service worker, update toast, `storage.persist`.

**Done when:** tests pass; editor build output contains `manifest.webmanifest`, `sw.js` with precache list and version, and icons.

### Phase 7 — Workflows, template, scripts, docs

- `.github/workflows/editor.yml` (§9.1), `.github/workflows/release.yml` (§9.3), `templates/data-repo/*` (§9.2, §9.4), `.env.example`, all scripts (§10). Make the bash scripts executable. Run `bash -n` on each.
- `AGENTS.md`: under 60 lines: commands, layout, the rules that are easy to break (privacy, escaping, `#trip-data`, shared numbering, secrets, service-worker cache, never run the deploy scripts), and the workflow (tests, keep this spec updated, no push unless asked).
- Documentation (take real screenshots of the Pisa example with a real Maps key *without committing the key*; save as `docs/images/trip-desktop.jpg` and `trip-mobile.jpg`):
  - `README.md`: short and public-facing. Title and one-liner; both screenshots at the top; **What it does** (logs and guides, capture on the go, editing with drag and drop, notes and ratings, off-route recommendations, drafts and publishing, reader features, Markdown/`llms.txt`/JSON-LD, privacy); **How it works** (ASCII diagram of editor → data repo → pinned tripbook release → Pages site; stack in one line); **Run it locally** (`npm install`, `npm test`, `npm run build:example && npm run serve`, `npm run build:editor:demo && npm run serve:editor`, "Use sample data"); **Run your own** (link to DEPLOY); a documentation list; license.
  - `docs/DEVELOPMENT.md`: setup, command table, the example site and local Maps key (never commit it), trying the editor without GitHub (§8.9) and service-worker caveats, test table, code layout, conventions, how releases reach the site.
  - `docs/DATA-MODEL.md`: trip and config fields, ratings and off-route semantics, URL rules, what the site build writes, privacy rules.
  - `docs/DEPLOY.md`: a numbered, copy-pasteable guide, in this order: prerequisites (Pages from private repos, a domain, Google Cloud, Node/`gh`); `gh auth login` and `gh auth refresh -s workflow`; verify the domain in GitHub; push tripbook (public); the local `.env`; DNS (two CNAMEs, **DNS only**, and why); Google Cloud (enable Maps JavaScript, Places API (New), Geocoding; referrer-restricted key; Map ID; budget alert); `setup-editor-pages.sh`; first release; `create-data-repo.sh`; wait for certificates and enforce HTTPS on both Pages sites; create the fine-grained token; open the editor, run Setup and install it; set the auto-release secret with `setup-auto-release.sh`; optional analytics and `ai_crawlers`; "Day to day"; keeping tripbook private (not possible with the pinned-checkout design unless using a deploy key or token); troubleshooting table (Pages 404, SSL error from the Cloudflare proxy, map placeholder, 401/403, "uses schema vN", checkout failing because tripbook is private or the tag is not pushed, `config.json` presets overriding new defaults, stale service worker, sync conflicts).

**Done when:** tests and builds pass; `bash -n` passes on every script; docs exist and follow the order above.

### Phase 8 — Final verification

Run and fix until all are true:
- `npm ci && npm test && npm run build:example && npm run build:editor` passes from a clean `node_modules`.
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
