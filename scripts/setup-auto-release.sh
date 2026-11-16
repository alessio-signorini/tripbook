#!/usr/bin/env bash
# One-time setup so that pushing site-building code to main releases it and rebuilds your site.
set -euo pipefail

. "$(dirname "$0")/lib.sh"
load_env

usage() {
  cat <<'EOF'
Usage: scripts/setup-auto-release.sh [--data-repo <owner/name>] [--code-repo <owner/name>]

Stores two things on the tripbook repo, read by .github/workflows/release.yml:
  - the repository variable DATA_REPO (default: DATA_REPO from .env)
  - the repository secret DATA_REPO_TOKEN (you paste it when asked)

Create the token first (fine-grained, only your data repo):
  https://github.com/settings/personal-access-tokens/new
  Repository permissions: Variables = Read and write, Actions = Read and write.

  --code-repo <o/name>   The tripbook repo (default: the current repo, via gh)
  -h, --help             Show this help

Safe to re-run (it replaces the token).
EOF
}

CODE_REPO=""
DATA="${DATA_REPO:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --data-repo) DATA="${2:?--data-repo needs a value}"; shift 2 ;;
    --code-repo) CODE_REPO="${2:?--code-repo needs a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$DATA" ] || { echo "--data-repo is required (or set DATA_REPO in .env)" >&2; usage >&2; exit 2; }

echo "==> Checking GitHub CLI login"
gh auth status >/dev/null
[ -n "$CODE_REPO" ] || CODE_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "    tripbook: $CODE_REPO   data repo: $DATA"

echo "==> Setting variable DATA_REPO on $CODE_REPO"
gh variable set DATA_REPO -R "$CODE_REPO" -b "$DATA"

echo "==> Setting secret DATA_REPO_TOKEN on $CODE_REPO (paste the token, then press Enter)"
gh secret set DATA_REPO_TOKEN -R "$CODE_REPO"

cat <<EOF

Done. From now on, a push to main that changes site-building code (src/shared, src/site,
the site build scripts or package files) runs the tests, tags the next patch version,
points $DATA at it and rebuilds the site. Editor-only changes do not release.
Run it by hand any time: gh workflow run release.yml -R $CODE_REPO
EOF
