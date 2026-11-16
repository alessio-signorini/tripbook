# Deploying Tripbook

This guide takes you from a fresh fork to a working setup, in order. Plan for about an hour, most of it waiting for DNS and certificates.

You end up with:

| | Where | What it is |
|---|---|---|
| **Editor** | `edit.trips.example.com` | The installable app you use on your phone and desktop. Deployed from this repo (tripbook). |
| **Trips site** | `trips.example.com` | The public website. Built from your private **data repo**. |
| **Data repo** | `you/trips.example.com` (any name) | Private. Holds `config.json`, `drafts/*.json` and `published/*.json`. The editor writes here. |

A push to tripbook redeploys the **editor**. The **trips site** is built in the data repo from a tagged tripbook release, and tripbook can create those releases for you (step 13).

Throughout, replace `example.com` with your domain and `you` with your GitHub user.

## 1. Requirements

- A GitHub plan that allows **GitHub Pages from private repositories** (the data repo is private).
- A domain you control and can add DNS records to.
- A Google Cloud account.
- Node 24 and the [GitHub CLI](https://cli.github.com/) (the devcontainer has both).

## 2. Get the code and log in

```sh
gh repo fork alessio-signorini/tripbook --clone   # or: gh repo create you/tripbook --public --source . --push
cd tripbook
npm ci
gh auth login
gh auth refresh -s workflow
```

The `workflow` scope lets `create-data-repo.sh` push a workflow file.

> **tripbook must be public.** The data repo's workflow checks tripbook out to build the site, and GitHub gives a workflow in one private repo no access to another. If you need it private, see [Keeping tripbook private](#keeping-tripbook-private).

## 3. Your settings (`.env`)

The scripts read your domains and data repo from a git-ignored `.env`, so you never retype them:

```sh
cp .env.example .env
```

| Variable | Example | Used for |
|---|---|---|
| `EDITOR_DOMAIN` | `edit.trips.example.com` | The editor's custom domain |
| `SITE_DOMAIN` | `trips.example.com` | The trips site's custom domain |
| `DATA_REPO` | `you/trips.example.com` | The private data repo. The owner may be left out. Dots are allowed. |
| `MAPS_KEY`, `MAP_ID`, `AUTHOR` | | Optional. Written into the data repo's `config.json` (step 10). |

A flag on a script, or a real environment variable, always beats `.env`.

## 4. Verify your domain in GitHub (recommended)

Settings → Pages → **Verified domains** → add your domain and create the TXT record GitHub shows. This stops other accounts from claiming your subdomains.

## 5. DNS

Create two records with your DNS provider:

```
CNAME  edit.trips  ->  you.github.io
CNAME  trips       ->  you.github.io
```

Set both to **DNS only** (grey cloud in Cloudflare). Cloudflare's free proxy certificate covers only one subdomain level, and GitHub cannot issue or renew its own certificate while a proxy is in front.

## 6. Editor site

```sh
scripts/setup-editor-pages.sh
```

This turns on Pages (from Actions) for tripbook, sets `EDITOR_DOMAIN` as its custom domain and runs the **Editor** workflow.

## 7. First release

```sh
scripts/release.sh 0.1.0
```

This runs the tests, tags `v0.1.0` and pushes the tag. The trips site is always built from a tagged release, never from a moving branch. Check it arrived: `git ls-remote --tags origin`.

## 8. Google Cloud

1. Create a project.
2. Enable **Maps JavaScript API**, **Places API (New)** and **Geocoding API**.
3. Create an API key restricted to those three APIs and to these HTTP referrers:
   - `https://trips.example.com/*`
   - `https://edit.trips.example.com/*`
   - `http://localhost:8080/*`
   - `http://localhost:8081/*`
4. Create a **Map ID** (type JavaScript).
5. Set a budget alert.

The key is a browser key restricted by referrer, so it is not a secret. Put it in `.env` as `MAPS_KEY` (and the Map ID as `MAP_ID`) for the next step.

## 9. DNS check

Wait until both names resolve (`dig +short trips.example.com` returns GitHub's addresses) before continuing; certificates are issued only after that.

## 10. Data repo

```sh
scripts/create-data-repo.sh
```

It reads `SITE_DOMAIN`, `DATA_REPO`, `MAPS_KEY`, `MAP_ID` and `AUTHOR` from `.env` (or take them as `--domain`, `--repo`, `--maps-key`, `--map-id`, `--author`). It creates the private repo from `templates/data-repo/`, sets the variables `TRIPBOOK_REPO` and `TRIPBOOK_REF` (the latest `v*` tag), turns on Pages, sets the custom domain and starts the first build. It never overwrites an existing repo.

## 11. HTTPS

When both certificates are issued (Settings → Pages in each repo), enforce HTTPS:

```sh
gh api -X PUT repos/you/tripbook/pages -F https_enforced=true
gh api -X PUT repos/you/trips.example.com/pages -F https_enforced=true
```

Open `https://trips.example.com`. It shows an empty index until you publish a trip.

## 12. Editor token and first run

Create a fine-grained token at <https://github.com/settings/personal-access-tokens/new>:

- Repository access: **only the data repo**.
- Permissions: **Contents = Read and write**. Optional: **Actions = Read and write**, for the editor's Rebuild button.

Open `https://edit.trips.example.com` on your phone and desktop, enter `you/trips.example.com` and the token in Setup, and press **Test connection**. Then install the app to your home screen so the device keeps your offline drafts. The token never leaves the device except to `api.github.com`.

## 13. Automatic releases (do this once)

Without this step, a change to the site's look or behavior is tagged as a release but the site keeps building from the old one.

Create a second fine-grained token: only the data repo, **Variables = Read and write** and **Actions = Read and write**. Then:

```sh
scripts/setup-auto-release.sh
```

It stores `DATA_REPO` (variable) and `DATA_REPO_TOKEN` (secret, which you paste) on the tripbook repo. From then on, every push to `main` that changes site-building code (`src/shared`, `src/site`, the site build scripts, `package.json`) runs the tests, tags the next patch version (`v0.1.1`, `v0.1.2`, …), points the data repo's `TRIPBOOK_REF` at it and rebuilds the site. Editor-only changes redeploy the editor and do not release.

**The token needs all of these**, and the repository access must include the data repo: *Variables: Read and write* (sets `TRIPBOOK_REF`; Actions or Contents access does not cover it), *Actions: Read and write* (starts the Site workflow) and *Metadata: Read*. Without Variables the Release run fails with `HTTP 403: Resource not accessible by personal access token (.../actions/variables)`: the tag is created but the site stays on the old release.

**Test it:** push a commit to `main` that touches site code (`src/shared/`, `src/site/`, `package.json`, …). Re-running a failed Release, or running it manually, does nothing when `HEAD` already has a `v*` tag, so you need a new commit. Then check:

```sh
gh run watch -R you/tripbook                      # Release succeeds, new tag (e.g. v0.1.8)
gh variable list -R you/trips.example.com         # TRIPBOOK_REF is the new tag
gh run list -R you/trips.example.com -L 1         # a new Site run (workflow_dispatch)
```

If Release failed, pin the site by hand: `gh variable set TRIPBOOK_REF -R you/trips.example.com -b v0.1.x && gh workflow run site.yml -R you/trips.example.com`.

## 14. Optional settings

In the editor's **Settings** (they are saved to the data repo's `config.json`): site title, author, Google Analytics ID (published trips and listing pages only, never drafts or the editor), time presets, default kind, `ai_crawlers` (`disallow` also stops `llms.txt` and `llms-full.txt` from being written). Saving commits `config.json`, which rebuilds the site automatically (about a minute); **Rebuild site** is only needed to re-run the build without a change.

## Day to day

- **Writing:** use the editor. **Sync** commits to the trip's folder; **Publish** and **Unpublish** move the file between `drafts/` and `published/` in one commit (publishing a new trip is also one commit, so only one rebuild). Every commit rebuilds the site (about a minute).
- **Drafts** are live at an unlisted `/drafts/...` URL with `noindex`, ready to share before publishing.
- **Code changes:** push to `main`. The editor redeploys by itself. Site-building changes are released automatically (step 13).
- **Manual release:** `scripts/release.sh <version>`, or run the **Release** workflow from the Actions tab.
- **Where is `_site/`?** It is built on the Actions runner and deployed to Pages; it is never committed. To inspect it, run `npm run build:example` locally or download the `github-pages` artifact from a run.

## Keeping tripbook private

Make the data repo's workflow check tripbook out with a token: create a fine-grained read-only token for tripbook (Contents = Read), store it in the data repo as the secret `TRIPBOOK_TOKEN`, and add `token: ${{ secrets.TRIPBOOK_TOKEN }}` to the tripbook checkout step in `.github/workflows/site.yml`. The automatic release workflow also works with a private tripbook.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Pages shows 404 | Wait for the first deploy and check the Actions tab. |
| SSL error on a subdomain | The Cloudflare proxy is on. Switch the record to DNS only. |
| Site workflow fails: `Repository not found` | tripbook is private, or `TRIPBOOK_REPO` is wrong. Make tripbook public (step 2). |
| Site workflow fails fetching `v0.1.x` | The tag exists only on your machine. Push it: `git push origin v0.1.x`. |
| A change does not show on the site | The site is pinned to an older release. Check `gh variable list -R you/trips.example.com`. Set up step 13, or run `scripts/release.sh <version>`. |
| Release workflow fails at "Point the data repo at the release", `HTTP 403 ... actions/variables` | `DATA_REPO_TOKEN` lacks *Variables: Read and write* (or *Actions: Read and write*), or its repository access does not include the data repo. Fix the token, re-run `scripts/setup-auto-release.sh` if its value changed, then push a new site-code commit (step 13). Meanwhile pin the site by hand (see step 13). |
| Release workflow fails: `expected the "[HOST/]OWNER/REPO" format` | The `DATA_REPO` variable on tripbook has no owner. The workflow now adds the owner of the tripbook repo; set it as `owner/name` if the data repo belongs to someone else. |
| Release is skipped | `HEAD` already has a `v*` tag. Push a new commit that touches site code. |
| A trip edit is not on the page | The page is cached for 10 minutes (`max-age=600`). Hard-refresh or add `?x=1` to the URL. |
| `release.sh` says "Data repo not found" | `DATA_REPO` in `.env` is wrong. It is `owner/name` (the owner may be left out). |
| Map shows a placeholder | The Maps key is empty, or its referrer restriction does not include the site. Check `config.json` and the key. |
| 401 or 403 from GitHub in the editor | The token expired or lacks Contents read/write on the data repo. |
| Build error "uses schema vN" | Your trips use a newer schema than the pinned release. Release a newer tripbook (step 13). |
| Sync conflict | The file changed on GitHub since you loaded it. *Load theirs* replaces your copy with GitHub's; *Overwrite* does the reverse. Nothing is merged. |
| Editor looks stale after an update | Reload; accept the "Update available" banner. In a stubborn browser, clear the site's data. |
