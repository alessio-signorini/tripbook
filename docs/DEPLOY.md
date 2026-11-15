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

## 3. Verify your domain in GitHub

Settings → Pages → Verified domains → add your domain and create the TXT record GitHub shows. This stops other accounts from claiming your subdomains.

## 4. Push the code

```sh
gh repo create <you>/tripbook --public --source . --push
```

## 5. DNS

Create two records with your DNS provider (Cloudflare or any other):

```
CNAME  edit.trips  ->  <you>.github.io
CNAME  trips       ->  <you>.github.io
```

Set both to **DNS only** (grey cloud in Cloudflare). Cloudflare's free proxy certificate covers only one subdomain level, and GitHub cannot issue or renew its own certificate while the proxy is in front.

## 6. Editor site

```sh
scripts/setup-editor-pages.sh --domain edit.trips.<your-domain>
```

## 7. First release

```sh
scripts/release.sh 0.1.0
```

This tags `v0.1.0`. The trips site is always built from a tagged release.

## 8. Google Cloud

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

## 9. Data repo

```sh
scripts/create-data-repo.sh --domain trips.<your-domain> --maps-key <key> --map-id <id> --author <name>
```

This creates the private `trips` repo from `templates/data-repo/`, sets `TRIPBOOK_REPO` and `TRIPBOOK_REF`, enables Pages and starts the first build.

## 10. HTTPS

Wait for both certificates (Settings → Pages in each repo), then enforce HTTPS:

```sh
gh api -X PUT repos/<you>/tripbook/pages -F https_enforced=true
gh api -X PUT repos/<you>/trips/pages -F https_enforced=true
```

## 11. Token for the editor

Create a fine-grained token at <https://github.com/settings/personal-access-tokens/new>:

- Repository access: only the data repo.
- Permissions: Contents = Read and write. Optional: Actions = Read and write (for the Rebuild button).

## 12. Open the editor

Open `https://edit.trips.<your-domain>` on your phone and desktop, run Setup with `<you>/trips` and the token, then install it to your home screen so the device keeps your offline drafts.

## 13. Optional settings

In the editor's Settings: add a Google Analytics ID (used on published trips and listing pages only, never on drafts or the editor). Set `ai_crawlers` to `disallow` if you do not want AI crawlers (this also stops `llms.txt` and `llms-full.txt` from being written).

## 14. Day to day

- Editing trips needs nothing else; Sync and Publish rebuild the site.
- Pushing code to `tripbook` redeploys the editor only.
- To change the trips site's look or behavior, run `scripts/release.sh <next version>`; it moves `TRIPBOOK_REF` and rebuilds.

## 15. Troubleshooting

- **Pages 404**: wait for the first deploy and check the Actions tab of the repo.
- **SSL error on a subdomain**: the Cloudflare proxy is on. Switch the record to DNS only.
- **Map shows a placeholder**: the Maps key is empty, or its referrer restriction does not include the site. Check `config.json` and the key's restrictions.
- **401 or 403 from GitHub**: the token expired, or lacks Contents read/write on the data repo.
- **Build error "uses schema vN"**: the trips use a newer schema than the pinned release. Run `scripts/release.sh <version>` from an up-to-date tripbook.
- **Sync conflict**: the file changed on GitHub since you loaded it (another device, or a manual edit). *Load theirs* replaces your local copy with GitHub's; *Overwrite* replaces GitHub's with yours. Nothing is merged.
