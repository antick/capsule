#!/bin/sh
# Public artifacts are always signed, notarized and verified. No unsigned fallback.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
. "$root/scripts/release/config.sh"
cd "$root"
: "${NOTARY_PROFILE:?Set NOTARY_PROFILE to your validated notarytool profile}"
app=$(scripts/bundle-macos.sh release production)
version=$(scripts/version.sh)
out="$CAPSULE_ARTIFACTS"
mkdir -p "$out"
zip="$out/Capsule-$version-arm64.zip"
dmg="$out/Capsule-$version-arm64.dmg"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
rm -f "$zip" "$dmg"
ditto -c -k --keepParent "$app" "$zip"
scripts/release/notarize.sh "$zip"
xcrun stapler staple "$app" >&2
python3 scripts/release/verify-bundle.py "$app" >&2
rm "$zip"
ditto -c -k --keepParent "$app" "$zip"
mkdir "$work/image"
ditto "$app" "$work/image/Capsule.app"
ln -s /Applications "$work/image/Applications"
hdiutil create -volname Capsule -srcfolder "$work/image" -ov -format UDZO "$dmg" >&2
identity=${CAPSULE_SIGN_IDENTITY:-$(security find-identity -v -p codesigning | awk '/Developer ID Application/ { print $2; exit }')}
[ -n "$identity" ] && [ "$identity" != - ] || release_fail "Developer ID required for DMG signing."
codesign --force --timestamp --sign "$identity" "$dmg" >&2
scripts/release/notarize.sh "$dmg"
xcrun stapler staple "$dmg" >&2
xcrun stapler validate "$dmg" >&2
spctl --assess --type open --context context:primary-signature --verbose=4 "$dmg" >&2
# Verify the archive users and Sparkle will actually receive.
ditto -x -k "$zip" "$work/extracted"
python3 scripts/release/verify-bundle.py "$work/extracted/Capsule.app" >&2
(cd "$out" && shasum -a 256 "Capsule-$version-arm64.zip" "Capsule-$version-arm64.dmg" > SHA256SUMS)
printf '%s\n' "$zip" "$dmg" "$out/SHA256SUMS"
