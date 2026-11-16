#!/usr/bin/env bash
# Tag a tripbook release and point the data repo's site build at it.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/release.sh <version> [--data-repo <owner/name>]

Tags a release (for example 0.2.0), pushes it, then sets TRIPBOOK_REF on the data
repo and triggers a site rebuild.

  <version>               Version without the leading v, e.g. 0.2.0
  --data-repo <o/name>    Data repo (default: <your gh user>/trips)
  -h, --help              Show this help

Requires a clean working tree on main, up to date with origin/main.
EOF
}

VERSION=""
DATA_REPO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --data-repo) DATA_REPO="${2:?--data-repo needs a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) [ -z "$VERSION" ] || { echo "Only one version allowed" >&2; exit 2; }; VERSION="$1"; shift ;;
  esac
done

[ -n "$VERSION" ] || { usage >&2; exit 2; }
case "$VERSION" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *) echo "Version must look like 0.2.0" >&2; exit 2 ;;
esac

echo "==> Checking repository state"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "Switch to the main branch first." >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean. Commit or stash your changes." >&2; exit 1; }
git fetch origin main --tags --quiet
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main is not up to date with origin/main." >&2; exit 1; }
if git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  echo "Tag v$VERSION already exists." >&2
  exit 1
fi

echo "==> Running tests"
npm test

echo "==> Tagging v$VERSION"
npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
git add package.json package-lock.json
if git diff --cached --quiet; then
  echo "    package.json already at $VERSION; tagging the current commit"
else
  git commit -m "Release v$VERSION"
fi
git tag "v$VERSION"
git push origin main --follow-tags

if [ -z "$DATA_REPO" ]; then
  DATA_REPO="$(gh api user -q .login)/trips"
fi

echo "==> Updating data repo $DATA_REPO"
if gh repo view "$DATA_REPO" >/dev/null 2>&1; then
  gh variable set TRIPBOOK_REF -R "$DATA_REPO" -b "v$VERSION"
  gh workflow run site.yml -R "$DATA_REPO"
  echo "Site rebuild started with tripbook v$VERSION."
else
  echo "Data repo not found; create-data-repo.sh will use this release"
fi
