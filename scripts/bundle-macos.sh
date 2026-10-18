#!/bin/sh
# Build optimization and app identity are separate: default is always Dev.
# taskpolicy -b scripts/bundle-macos.sh [debug|release] [development|production]
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
. "$root/scripts/release/config.sh"
config=${1:-debug}
channel=${2:-development}
case "$config" in debug|release) ;; *) release_fail "Expected debug or release" ;; esac
case "$channel" in development|production) ;; *) release_fail "Expected development or production" ;; esac
cd "$root"
[ "$(uname -m)" = "$CAPSULE_ARCH" ] || release_fail "Capsule builds require an Apple silicon Mac."
bin=$(swift build -c "$config" --arch "$CAPSULE_ARCH" --show-bin-path)
swift build -c "$config" --arch "$CAPSULE_ARCH" --product CapsuleApp >&2
name=$(plist_value CFBundleName)
identifier=$(plist_value CFBundleIdentifier)
icon=AppIcon
if [ "$channel" = development ]; then
  name="$name Dev"
  identifier="$identifier.dev"
  icon=AppIconDev
fi
app="$root/.build/bundles/$channel/$name.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources" "$app/Contents/Frameworks"
cp "$bin/CapsuleApp" "$app/Contents/MacOS/CapsuleApp"
cp "$CAPSULE_PLIST" "$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $identifier" "$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName $name" "$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $name" "$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile $icon" "$app/Contents/Info.plist"
cp Support/CapsuleApp/Resources/* "$app/Contents/Resources/"
cp LICENSE "$app/Contents/Resources/LICENSE.txt"
framework="$root/.build/artifacts/sparkle/Sparkle/Sparkle.xcframework/macos-arm64_x86_64/Sparkle.framework"
[ -d "$framework" ] || release_fail "Resolved Sparkle framework is missing."
ditto "$framework" "$app/Contents/Frameworks/Sparkle.framework"
cp .build/checkouts/Sparkle/LICENSE "$app/Contents/Resources/Sparkle-LICENSE.txt"
# SPM's executable needs a bundle-relative runtime search path.
install_name_tool -add_rpath @executable_path/../Frameworks "$app/Contents/MacOS/CapsuleApp" 2>/dev/null ||
  otool -l "$app/Contents/MacOS/CapsuleApp" | grep -q '@executable_path/../Frameworks'
identity=${CAPSULE_SIGN_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null |
  awk '/Developer ID Application/ { print $2; exit }')}
if [ "$channel" = production ]; then
  [ -n "$identity" ] && [ "$identity" != - ] || release_fail "Production requires Developer ID signing."
  timestamp=--timestamp
else
  identity=${identity:--}
  timestamp=--timestamp=none
fi
python3 scripts/release/sign-bundle.py "$app" "$identity" "$timestamp"
echo "$app"
