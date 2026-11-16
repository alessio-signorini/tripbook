#!/usr/bin/env bash
# Enable GitHub Pages (from Actions) for the tripbook repo and set the editor's custom domain.
set -euo pipefail

. "$(dirname "$0")/lib.sh"
load_env

usage() {
  cat <<'EOF'
Usage: scripts/setup-editor-pages.sh --domain <host> [--repo <owner/name>]

Run once in the tripbook repo after pushing it to GitHub.

  --domain <host>     Custom domain for the editor, e.g. edit.trips.example.com
                      (default: EDITOR_DOMAIN from .env; required one way or the other)
  --repo <owner/name> Repo to configure (default: the current repo, via gh)
  -h, --help          Show this help

Safe to re-run.
EOF
}

REPO=""
DOMAIN="${EDITOR_DOMAIN:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="${2:?--repo needs a value}"; shift 2 ;;
    --domain) DOMAIN="${2:?--domain needs a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$DOMAIN" ] || { echo "--domain is required (or set EDITOR_DOMAIN in .env)" >&2; usage >&2; exit 2; }

echo "==> Checking GitHub CLI login"
gh auth status >/dev/null

if [ -z "$REPO" ]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi
OWNER="${REPO%%/*}"
echo "    Repo: $REPO"

echo "==> Enabling Pages from GitHub Actions"
if gh api -X POST "repos/$REPO/pages" -f build_type=workflow >/dev/null 2>&1; then
  echo "    Pages created"
else
  gh api -X PUT "repos/$REPO/pages" -f build_type=workflow >/dev/null
  echo "    Pages already existed; build type set to workflow"
fi

echo "==> Setting custom domain $DOMAIN"
gh api -X PUT "repos/$REPO/pages" -f cname="$DOMAIN" >/dev/null

echo "==> Running the Editor workflow"
gh workflow run editor.yml -R "$REPO"

LABEL="${DOMAIN%%.*}"
cat <<EOF

Next steps
  1. Create this DNS record (DNS only / grey cloud in Cloudflare, not proxied):
       CNAME  $LABEL  ->  $OWNER.github.io
  2. When GitHub has issued the certificate (Settings -> Pages), enforce HTTPS:
       gh api -X PUT repos/$REPO/pages -F https_enforced=true
EOF
