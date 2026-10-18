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

# One version for both apps: the workspace's.
version=$(plutil -extract version raw -o - package.json)
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" "$app/Contents/Info.plist"

codesign --force --sign - "$app" >&2
echo "$app"
