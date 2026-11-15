#!/usr/bin/env bash
# Create the private data repo from templates/data-repo and wire it to a tripbook release.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/create-data-repo.sh --domain <host> [options]

Run once, after scripts/release.sh has published the first release.

  --domain <host>       Domain of the trips site, e.g. trips.example.com (required)
  --owner <login>       GitHub owner (default: your gh user)
  --repo <name>         Repo name (default: trips)
  --code-repo <o/name>  The tripbook repo (default: the current repo, via gh)
  --code-ref <tag>      tripbook release to build with (default: latest v* tag)
  --maps-key <key>      Google Maps browser key, written to config.json
  --map-id <id>         Google Maps Map ID, written to config.json
  --author <name>       Author name, written to config.json
  -h, --help            Show this help

Never overwrites an existing repo.
EOF
}

OWNER=""; REPO="trips"; DOMAIN=""; CODE_REPO=""; CODE_REF=""; MAPS_KEY=""; MAP_ID=""; AUTHOR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --owner) OWNER="${2:?}"; shift 2 ;;
    --repo) REPO="${2:?}"; shift 2 ;;
    --domain) DOMAIN="${2:?}"; shift 2 ;;
    --code-repo) CODE_REPO="${2:?}"; shift 2 ;;
    --code-ref) CODE_REF="${2:?}"; shift 2 ;;
    --maps-key) MAPS_KEY="${2:?}"; shift 2 ;;
    --map-id) MAP_ID="${2:?}"; shift 2 ;;
    --author) AUTHOR="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$DOMAIN" ] || { echo "--domain is required" >&2; usage >&2; exit 2; }

echo "==> Checking GitHub CLI login and scopes"
gh auth status >/dev/null
SCOPES="$(gh api -i user 2>/dev/null | tr -d '\r' | grep -i '^x-oauth-scopes:' || true)"
case "$SCOPES" in
  *workflow*) ;;
  *) echo "The gh token needs the workflow scope. Run: gh auth refresh -s workflow" >&2; exit 1 ;;
esac

[ -n "$OWNER" ] || OWNER="$(gh api user -q .login)"
[ -n "$CODE_REPO" ] || CODE_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
if [ -z "$CODE_REF" ]; then
  CODE_REF="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"
  [ -n "$CODE_REF" ] || { echo "Run scripts/release.sh 0.1.0 first" >&2; exit 1; }
fi
echo "    Data repo: $OWNER/$REPO   tripbook: $CODE_REPO@$CODE_REF"

if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  echo "$OWNER/$REPO already exists. Not touching it." >&2
  exit 1
fi

SRC="$(cd "$(dirname "$0")/.." && pwd)/templates/data-repo"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> Preparing files in $TMP"
cp -R "$SRC/." "$TMP/"
DOMAIN="$DOMAIN" MAPS_KEY="$MAPS_KEY" MAP_ID="$MAP_ID" AUTHOR="$AUTHOR" CONFIG="$TMP/config.json" node -e '
const fs = require("fs");
const file = process.env.CONFIG;
const c = JSON.parse(fs.readFileSync(file, "utf8"));
c.base_url = "https://" + process.env.DOMAIN;
if (process.env.MAPS_KEY) c.google_maps_api_key = process.env.MAPS_KEY;
if (process.env.MAP_ID) c.google_maps_map_id = process.env.MAP_ID;
if (process.env.AUTHOR) c.author = process.env.AUTHOR;
fs.writeFileSync(file, JSON.stringify(c, null, 2) + "\n");
'

echo "==> Creating private repo $OWNER/$REPO"
git -C "$TMP" init -q -b main
git -C "$TMP" add -A
git -C "$TMP" commit -q -m "Initial data repo"
gh repo create "$OWNER/$REPO" --private --source "$TMP" --push

echo "==> Setting repository variables"
gh variable set TRIPBOOK_REPO -R "$OWNER/$REPO" -b "$CODE_REPO"
gh variable set TRIPBOOK_REF -R "$OWNER/$REPO" -b "$CODE_REF"

echo "==> Enabling Pages and setting domain $DOMAIN"
if ! gh api -X POST "repos/$OWNER/$REPO/pages" -f build_type=workflow >/dev/null 2>&1; then
  gh api -X PUT "repos/$OWNER/$REPO/pages" -f build_type=workflow >/dev/null
fi
gh api -X PUT "repos/$OWNER/$REPO/pages" -f cname="$DOMAIN" >/dev/null

echo "==> Running the Site workflow"
gh workflow run site.yml -R "$OWNER/$REPO"

LABEL="${DOMAIN%%.*}"
cat <<EOF

Next steps
  1. DNS record (DNS only / grey cloud, not proxied):
       CNAME  $LABEL  ->  $OWNER.github.io
  2. When the certificate is issued (Settings -> Pages), enforce HTTPS:
       gh api -X PUT repos/$OWNER/$REPO/pages -F https_enforced=true
  3. Create a fine-grained token: https://github.com/settings/personal-access-tokens/new
       Repository access: only $OWNER/$REPO
       Permissions: Contents = Read and write; optional Actions = Read and write (Rebuild button)
  4. Open your editor, choose "$OWNER/$REPO" and paste the token.
EOF
