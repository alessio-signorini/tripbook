# 🗺️ Tripbook

Tripbook is two small pieces and no backend. An **editor** (an installable web app) saves your trips as JSON files in a private GitHub repo, and **GitHub Actions** turns that repo into a fast static website. GitHub is the database; Google Maps draws the maps.

![screenshot](docs/images/trip-desktop.jpg)

## What it does

- **Logs and guides.** A *log* records a trip; a *guide* recommends places. Same data, same page.
- **Capture on the go.** "Add place here" finds nearby places (or drops a pin, or takes pasted coordinates) and files the stop under today's "Day N".
- **Edit anywhere.** Drag stops between sections, add notes (Markdown) and 1–5 star ratings, mark recommended places that are not on the walking route, work offline and sync later.
- **Drafts and publishing.** Drafts get an unlisted `noindex` URL you can share; publishing moves them to their public URL.
- **A good page for readers.** Interactive map, one tap to open the whole walking route in Google Maps, switches to hide low-rated or off-the-path places, and a mobile layout with a draggable bottom sheet.
- **Fast on phones.** Pages inline their CSS and self-host their one web font; the map loads after the list is on screen; the editor loads drag-and-drop and preview code only when needed.
- **Friendly to LLMs and search.** Every published trip also has a Markdown version, plus `/llms.txt`, `/llms-full.txt` and JSON-LD.
- **Private by construction.** Dates and times never appear on the public site; only the built pages are published, never your JSON.

## How it works

```
 phone / desktop            GitHub REST API          ┌──────────────────────────┐
 ┌──────────────┐ ───────────────────────────────▶  │ data repo (private)      │
 │ Editor (PWA) │   token stays on the device        │ config.json              │
 │ edit.…       │                                    │ drafts/  published/      │
 └──────▲───────┘                                    │ .github/workflows/site.yml
        │ deployed from this repo                    └────────────┬─────────────┘
 ┌──────┴───────┐       checked out at a release tag             │ build + deploy
 │ tripbook     │ ◀──────────────────────────────────────────────┘
 │ (this repo)  │                                                 ▼
 └──────────────┘                                      Trips site (GitHub Pages)
```

- **tripbook** (this repo) holds the editor, the site build and the templates. A push redeploys the editor.
- Your **data repo** holds your trips. Each change rebuilds the site from a **tagged tripbook release**, so the site only changes when you release (and tripbook can do that for you).
- Stack: plain JavaScript (Node 24, ES modules), Preact + htm for the editor, esbuild, SortableJS, no TypeScript, no framework on the site.
- Working on the code with an AI agent? Start with [AGENTS.md](AGENTS.md).

## Run it locally

Needs Node 24 (the devcontainer has it).

```sh
npm install
npm run check                                          # tests + both builds
npm run build:example && npm run serve                 # example site   -> http://localhost:8080
npm run build:editor:demo && npm run serve:editor      # editor, sample data -> http://localhost:8081
```

In the editor, open `#/setup` and press **Use sample data** to try everything without GitHub or a token. Maps show a placeholder until you add a Google Maps key (see [Development](docs/DEVELOPMENT.md)).

## Run your own

Fork this repo, create a data repo, and follow **[docs/DEPLOY.md](docs/DEPLOY.md)**. It covers domains, DNS, Google Cloud keys, tokens and automatic releases.

## Documentation

- [docs/DEPLOY.md](docs/DEPLOY.md): set up your own instance, step by step, plus troubleshooting
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): local development, tests, code layout, releases
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md): trip and config JSON, URLs, privacy rules, LLM output
- [docs/BUILD.md](docs/BUILD.md): the full build spec an AI coding agent can follow to regenerate this project

## License

[MIT](LICENSE)
