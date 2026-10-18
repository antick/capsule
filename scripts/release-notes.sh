#!/bin/sh
# Lifts one version's section out of CHANGELOG.md. The changelog entry is the
# release notes: it becomes the GitHub release body, which is also where the
# app's Settings → Updates reads "What's new" from.
#
#   scripts/release-notes.sh [version]           print the notes
#   scripts/release-notes.sh --check [version]   only verify they exist
#   CHANGELOG=path scripts/release-notes.sh ...  read another file (tests)
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
check=false
if [ "${1:-}" = "--check" ]; then
  check=true
  shift
fi
version=${1:-$("$root/scripts/version.sh")}
changelog=${CHANGELOG:-$root/CHANGELOG.md}

# The heading may carry a title after the version ("## 0.1.0 — first
# release"), so it is matched on the version, with or without a "v".
notes=$(awk -v version="$version" '
  BEGIN { escaped = version; gsub(/\./, "\\.", escaped) }
  /^##[ \t]/ {
    if (found) exit
    if ($0 ~ "^##[ \t]+v?" escaped "([ \t]|$)") { found = 1; next }
  }
  found { print }
' "$changelog" | sed -e :a -e '/^[[:space:]]*$/{$d;N;ba' -e '}' | sed '/./,$!d')

if [ -z "$notes" ]; then
  echo "" >&2
  echo "CHANGELOG.md has no \"## $version\" section." >&2
  echo "" >&2
  echo "  Add a heading \"## $version\" to CHANGELOG.md, with what changed" >&2
  echo "  under it, commit that, then run this again." >&2
  echo "" >&2
  exit 1
fi

if [ "$check" = true ]; then
  echo "CHANGELOG.md has notes for $version."
else
  printf '%s\n' "$notes"
fi
