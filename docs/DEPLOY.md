# Deploying your own Tripbook

You end up with two sites: an **editor** (for example `edit.trips.example.com`) and a **trips site** (for example `trips.example.com`), built from a private data repo. Do the steps in order.

## 1. Requirements

- A GitHub plan that allows GitHub Pages from private repositories (the data repo is private).
- A domain you control and can add DNS records to.
- A Google Cloud account.
- Node 24 and the [GitHub CLI](https://cli.github.com/) (the devcontainer has both).

## 2. GitHub CLI

```sh
gh auth login
gh auth refresh -s workflow
```

The `workflow` scope lets `create-data-repo.sh` push the workflow file.

## 3. Your settings (`.env`)

The scripts read your domains and data repo from a git-ignored `.env` file, so you don't repeat them as flags:

```sh
cp .env.example .env
```

Fill in `EDITOR_DOMAIN` (for example `edit.trips.<your-domain>`), `SITE_DOMAIN` (`trips.<your-domain>`) and `DATA_REPO` (`<you>/trips`, or any name such as `<you>/trips.<your-domain>`). `MAPS_KEY`, `MAP_ID` and `AUTHOR` are optional and are written into the data repo's `config.json`. A flag always wins over `.env`.

## 4. Verify your domain in GitHub

Settings → Pages → Verified domains → add your domain and create the TXT record GitHub shows. This stops other accounts from claiming your subdomains.

## 5. Push the code

```sh
gh repo create <you>/tripbook --public --source . --push
```

## 6. DNS

Create two records with your DNS provider (Cloudflare or any other):

```
CNAME  edit.trips  ->  <you>.github.io
CNAME  trips       ->  <you>.github.io
```

Set both to **DNS only** (grey cloud in Cloudflare). Cloudflare's free proxy certificate covers only one subdomain level, and GitHub cannot issue or renew its own certificate while the proxy is in front.

## 7. Editor site

```sh
scripts/setup-editor-pages.sh
```

## 8. First release

```sh
scripts/release.sh 0.1.0
```

This tags `v0.1.0`. The trips site is always built from a tagged release.

## 9. Google Cloud

1. Create a project.
2. Enable **Maps JavaScript API**, **Places API (New)** and **Geocoding API**.
3. Create an API key restricted to those three APIs and to these HTTP referrers:
   - `https://trips.<your-domain>/*`
   - `https://edit.trips.<your-domain>/*`
   - `http://localhost:8080/*`
   - `http://localhost:8081/*`
4. Create a Map ID (type JavaScript).
5. Set a budget alert.

The key is a browser key restricted by referrer, so it is not a secret.

## 10. Data repo

```sh
scripts/create-data-repo.sh
```

This reads `SITE_DOMAIN`, `DATA_REPO`, `MAPS_KEY`, `MAP_ID` and `AUTHOR` from `.env` (or take them as `--domain`, `--repo`, `--maps-key`, `--map-id`, `--author` flags). It creates the private data repo from `templates/data-repo/`, sets `TRIPBOOK_REPO` and `TRIPBOOK_REF`, enables Pages and starts the first build.

## 11. HTTPS

Wait for both certificates (Settings → Pages in each repo), then enforce HTTPS:

```sh
gh api -X PUT repos/<you>/tripbook/pages -F https_enforced=true
gh api -X PUT repos/<DATA_REPO>/pages -F https_enforced=true
```

## 12. Token for the editor

Create a fine-grained token at <https://github.com/settings/personal-access-tokens/new>:

- Repository access: only the data repo.
- Permissions: Contents = Read and write. Optional: Actions = Read and write (for the Rebuild button).

## 13. Automatic releases

Create a second fine-grained token at <https://github.com/settings/personal-access-tokens/new>: only the data repo, with **Variables = Read and write** and **Actions = Read and write**. Then run:

```sh
scripts/setup-auto-release.sh
```

It stores `DATA_REPO` (variable) and `DATA_REPO_TOKEN` (secret, which you paste) on the tripbook repo. From then on, every push to `main` that changes site-building code (`src/shared`, `src/site`, the site build scripts, `package.json`) runs the tests, tags the next patch version (`v0.1.1`, `v0.1.2`, …), points the data repo's `TRIPBOOK_REF` at it and rebuilds the site. Editor-only changes redeploy the editor and do not release. Without the token the tag is still created, and the run prints a notice.

## 14. Open the editor

Open `https://edit.trips.<your-domain>` on your phone and desktop, run Setup with `<you>/trips` and the token, then install it to your home screen so the device keeps your offline drafts.

## 15. Optional settings

In the editor's Settings: add a Google Analytics ID (used on published trips and listing pages only, never on drafts or the editor). Set `ai_crawlers` to `disallow` if you do not want AI crawlers (this also stops `llms.txt` and `llms-full.txt` from being written).

## 16. Day to day

- Editing trips needs nothing else; Sync and Publish rebuild the site.
- Pushing code to `tripbook` redeploys the editor only.
- Changes to the trips site's look or behavior go live by themselves: push to `main` and the release workflow does the rest (step 13). To release by hand, use `scripts/release.sh <version>` or `gh workflow run release.yml`.

## 17. Troubleshooting

- **Pages 404**: wait for the first deploy and check the Actions tab of the repo.
- **SSL error on a subdomain**: the Cloudflare proxy is on. Switch the record to DNS only.
- **Map shows a placeholder**: the Maps key is empty, or its referrer restriction does not include the site. Check `config.json` and the key's restrictions.
- **401 or 403 from GitHub**: the token expired, or lacks Contents read/write on the data repo.
- **Build error "uses schema vN"**: the trips use a newer schema than the pinned release. Run `scripts/release.sh <version>` from an up-to-date tripbook.
- **Sync conflict**: the file changed on GitHub since you loaded it (another device, or a manual edit). *Load theirs* replaces your local copy with GitHub's; *Overwrite* replaces GitHub's with yours. Nothing is merged.
