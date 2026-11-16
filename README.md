# Tripbook

Tripbook is a personal tool to log the places you visit and to publish shareable trip logs and city guides. An installable phone/desktop editor saves your trips as JSON in a private GitHub repo, and GitHub Actions turns them into a fast static website. There is no backend: GitHub is the database and Google Maps draws the maps.

<!-- Screenshots: add editor (phone), capture sheet and trip page (desktop and mobile) here. -->

## Features

- **Logs and guides.** A *log* records a trip; a *guide* recommends places. Same data, same page.
- **Notes everywhere.** The trip, every section and every stop have Markdown notes.
- **Ratings and the low-rated toggle.** Stops carry 1–5 stars. Readers can show or hide places rated 1–2 (hidden by default on guides, shown on logs); maps, numbers and Google Maps links follow the toggle.
- **Drafts at live URLs.** Drafts are built at unlisted `/drafts/...` URLs with `noindex`, so you can share them before publishing.
- **Capture on the go.** "Add place here" finds nearby places, or drops a pin, and files the stop under today's "Day N".
- **Made for LLMs too.** Every published trip also has a Markdown version, plus `/llms.txt`, `/llms-full.txt` and JSON-LD.
- **Private by construction.** No dates or times are ever rendered on the public site.

## Architecture

Two repositories, two sites, pinned releases:

```
 phone / desktop
 ┌──────────────┐  GitHub REST API   ┌─────────────────────────┐
 │ Editor (PWA) │ ─────────────────▶ │ trips (private data repo)│
 │ edit.…       │   token on device  │ config.json              │
 └──────▲───────┘                    │ drafts/*.json            │
        │ deploys on push            │ published/*.json         │
 ┌──────┴───────┐                    │ .github/workflows/site.yml
 │ tripbook     │                    └────────────┬────────────┘
 │ (public, MIT)│  checked out at TRIPBOOK_REF     │ build + deploy
 │ editor, site │ ◀────────────────────────────────┘
 │ build, tools │                                  ▼
 └──────────────┘                    ┌─────────────────────────┐
                                     │ Trips site (Pages)      │
                                     │ trips.…  (only _site/)  │
                                     └─────────────────────────┘
```

- Pushing code to `tripbook` redeploys the **editor** only.
- The **trips site** is built in the data repo from a pinned tripbook release (the `TRIPBOOK_REF` variable). Site-building changes reach the site through a release: pushing them to `main` tags one and rebuilds the site automatically (see `docs/DEPLOY.md`), or run `scripts/release.sh` by hand.
- The site build refuses trips that use a newer schema than the pinned release supports.

## Local development

Requires Node 24 (the devcontainer provides it).

```sh
npm install
npm test                          # unit and build tests
npm run build:example && npm run serve          # example site on http://localhost:8080
npm run build:editor  && npm run serve:editor   # editor on http://localhost:8081
```

`examples/data` holds sample trips (two published, one draft). The example Maps key is empty, so maps show a placeholder.

## How content works

- A trip lives in `drafts/<id>.json` or `published/<id>.json`; the folder is its status and the file name is its stable `id`.
- URLs are `/<country>/<region?>/<city?>/<slug>/`, for example `/italy/pisa/4-hours-layover/`. Drafts use the same path under `/drafts/`; publishing makes the draft URL disappear. If you rename a published trip's location or slug, the old URL redirects.
- Country names in URLs come from `config.json` `country_slugs` (for example `US` becomes `usa`).
- Editing is local first. **Sync** commits to the trip's folder; **Publish** and **Unpublish** move the file in one commit. If a file changed elsewhere you choose *Load theirs* or *Overwrite*; nothing is merged.

## Privacy

`captured_at`, `created_at` and `updated_at` exist only in the JSON. The public site never shows dates or times, and sitemaps carry no `lastmod`. Only the build output (`_site/`) is published; your JSON files and config are never served.

## Run your own

Use the hosted editor if someone shares one, or fork this repo and deploy your own. Either way you create your own data repo and follow [docs/DEPLOY.md](docs/DEPLOY.md) step by step.

## License

[MIT](LICENSE)
