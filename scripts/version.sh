#!/bin/sh
# Prints the app's version. It lives in one place, the bundle's Info.plist,
# so a release can never be built from a different version than it claims.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$root/Support/CapsuleApp/Info.plist"
