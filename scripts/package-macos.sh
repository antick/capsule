#!/bin/sh
# Builds a release Capsule.app and packs it for publishing: a zip and a dmg
# under .build/release-artifacts. Signs with CAPSULE_SIGN_IDENTITY when set,
# and notarises when NOTARY_PROFILE names a notarytool keychain profile.
#
#   taskpolicy -b scripts/package-macos.sh
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

app=$(scripts/bundle-macos.sh release)
version=$(scripts/version.sh)
out="$root/.build/release-artifacts"
mkdir -p "$out"
zip="$out/Capsule-$version-arm64.zip"
dmg="$out/Capsule-$version-arm64.dmg"
rm -f "$zip" "$dmg"

ditto -c -k --keepParent "$app" "$zip"

if [ -n "${NOTARY_PROFILE:-}" ]; then
  xcrun notarytool submit "$zip" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$app"
  # Re-pack so the zip carries the stapled ticket too.
  rm -f "$zip"
  ditto -c -k --keepParent "$app" "$zip"
fi

hdiutil create -volname "Capsule" -srcfolder "$app" -ov -format UDZO "$dmg" >&2
if [ -n "${NOTARY_PROFILE:-}" ]; then
  xcrun notarytool submit "$dmg" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$dmg"
fi

echo "$zip"
echo "$dmg"
