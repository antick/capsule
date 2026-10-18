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

# Signed with a Developer ID when one is named, so macOS lets the build
# replace itself and network filters recognise it across builds; ad hoc
# otherwise, which is enough to run it here.
identity=${CAPSULE_SIGN_IDENTITY:--}
if [ "$identity" = "-" ]; then
  codesign --force --sign - "$app" >&2
else
  codesign --force --options runtime --timestamp --sign "$identity" "$app" >&2
fi
echo "$app"
