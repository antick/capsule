#!/bin/sh
# Builds the native app and wraps it in Capsule.app next to the binary,
# ad-hoc signed, so LaunchServices reads its Info.plist (LSUIElement, the
# side-by-side bundle identifier). Prints the bundle's path.
#
#   taskpolicy -b scripts/bundle-macos.sh [debug|release]
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
config=${1:-debug}
cd "$root"

swift build -c "$config" --product CapsuleApp >&2
bin=$(swift build -c "$config" --show-bin-path)
app="$bin/Capsule.app"

rm -rf "$app"
mkdir -p "$app/Contents/MacOS"
cp "$bin/CapsuleApp" "$app/Contents/MacOS/CapsuleApp"
cp Support/CapsuleApp/Info.plist "$app/Contents/Info.plist"
mkdir -p "$app/Contents/Resources"
cp Support/CapsuleApp/Resources/* "$app/Contents/Resources/"

# Signed with a Developer ID, so every build carries the same identity: a
# network filter's rule and the keychain's "Always Allow" then survive
# rebuilds instead of asking again each time. CAPSULE_SIGN_IDENTITY names one;
# otherwise the first Developer ID Application identity in the keychain is
# used, by its hash since several can share a name; ad hoc when there is none.
identity=${CAPSULE_SIGN_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null |
  awk '/Developer ID Application/ { print $2; exit }')}
if [ -z "$identity" ] || [ "$identity" = "-" ]; then
  codesign --force --sign - "$app" >&2
elif [ "$config" = release ]; then
  codesign --force --options runtime --timestamp --sign "$identity" "$app" >&2
else
  # A local build needs no secure timestamp, so building needs no network.
  codesign --force --options runtime --timestamp=none --sign "$identity" "$app" >&2
fi
echo "$app"
