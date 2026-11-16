# Shared by the scripts in this folder. Loads <repo root>/.env (if present).
# Only the keys below are read, values are never executed, and variables already
# set in the environment win over the file.

load_env() {
  local root file line key value
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  file="$root/.env"
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    key="${key//[[:space:]]/}"
    value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
    case "$key" in
      EDITOR_DOMAIN|SITE_DOMAIN|DATA_REPO|MAPS_KEY|MAP_ID|AUTHOR)
        [ -n "${!key:-}" ] || export "$key=$value" ;;
    esac
  done < "$file"
}

# "trips.example.com" -> "<your gh user>/trips.example.com"; "owner/name" is returned as is.
normalize_repo() {
  case "$1" in
    */*) echo "$1" ;;
    '') echo "" ;;
    *) echo "$(gh api user -q .login)/$1" ;;
  esac
}
