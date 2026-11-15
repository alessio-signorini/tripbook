# Trips data

This private repo is the database for your [tripbook](https://github.com/alessio-signorini/tripbook) trips site. The editor app writes here through the GitHub API; GitHub Actions turns it into a static website.

## Folders

- `drafts/<id>.json`: trips that are built at unlisted URLs under `/drafts/` and are hidden from the index, sitemap and search engines.
- `published/<id>.json`: public trips, listed on the site.
- `config.json`: site settings (title, author, `base_url`, Google Maps key and Map ID, analytics ID, defaults, `ai_crawlers`).

Folder is the status. The file name is the trip `id` and never changes. Only the build output is published; none of these files are served.

## Editing

Use the editor (Sync, Publish and Unpublish commit here for you). To change settings, edit `config.json` in the editor's Settings screen or directly on GitHub. Every push to `drafts/`, `published/` or `config.json` rebuilds the site.

## Which tripbook builds the site

The workflow checks out tripbook at the tag in the repository variable `TRIPBOOK_REF` (from `TRIPBOOK_REPO`). To move to a newer release, run `scripts/release.sh <version>` in the tripbook repo, or edit the `TRIPBOOK_REF` variable under Settings → Secrets and variables → Actions → Variables and run the **Site** workflow.
