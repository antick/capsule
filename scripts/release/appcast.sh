#!/bin/sh
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
. "$root/scripts/release/config.sh"
cd "$root"
version=$(scripts/version.sh)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
zip="Capsule-$version-arm64.zip"
cp "$CAPSULE_ARTIFACTS/$zip" "$work/"
# Embedded plain-text notes are rendered by Capsule, never executed as HTML.
scripts/release-notes.sh | sed -E 's/^#{1,6} +//; s/^- /• /' > "$work/Capsule-$version-arm64.txt"
set -- --account capsule
if [ -n "${SPARKLE_KEY_FILE:-}" ]; then set -- --ed-key-file "$SPARKLE_KEY_FILE"; fi
bin="$root/.build/artifacts/sparkle/Sparkle/bin"
"$bin/generate_appcast" "$@" --maximum-deltas 0 --embed-release-notes \
  --download-url-prefix "https://github.com/$CAPSULE_REPOSITORY/releases/download/v$version/" \
  --link "https://github.com/$CAPSULE_REPOSITORY/releases/tag/v$version" "$work" >&2
mkdir -p "$CAPSULE_ARTIFACTS/site"
cp "$work/appcast.xml" "$CAPSULE_ARTIFACTS/appcast.xml"
cp "$work/appcast.xml" "$CAPSULE_ARTIFACTS/site/appcast.xml"
"$bin/sign_update" "$@" --verify "$CAPSULE_ARTIFACTS/appcast.xml" >&2
python3 scripts/release/validate-appcast.py "$CAPSULE_ARTIFACTS/appcast.xml"
