#!/bin/sh
# Cuts the tag that triggers the release workflow. The tag is derived from
# the version in Info.plist, so the tag and the built app cannot disagree.
#
#   scripts/tag-release.sh          create the tag
#   scripts/tag-release.sh --push   create it and push it
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

fail() {
  echo "" >&2
  echo "$1" >&2
  shift
  for step in "$@"; do echo "  $step" >&2; done
  echo "" >&2
  exit 1
}

version=$(scripts/version.sh)
case "$version" in
  *[!0-9.]* | "" | .* | *.) fail "Info.plist has no release version (found \"$version\")." \
    "Set CFBundleShortVersionString to something like 0.1.0 in Support/CapsuleApp/Info.plist." ;;
esac
tag="v$version"

[ -z "$(git status --porcelain)" ] || fail "The working tree has uncommitted changes." \
  "Commit or stash them, then run this again."

branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = main ] || fail "Releases are cut from main; you are on $branch." "git switch main"

# Caught here rather than in CI: a missing section costs nothing to fix
# before the tag exists, and a re-tag once it does.
scripts/release-notes.sh --check "$version"

[ -z "$(git tag --list "$tag")" ] || fail "$tag already exists." \
  "Bump CFBundleShortVersionString in Support/CapsuleApp/Info.plist, commit that, then run this again."

git tag -a "$tag" -m "Capsule $version"
echo "Tagged $tag."

if [ "${1:-}" = "--push" ]; then
  git push origin "$tag"
  echo "Pushed $tag. The Release workflow builds and publishes it."
else
  echo ""
  echo "Push it to start the release:"
  echo ""
  echo "  git push origin $tag"
  echo ""
fi
