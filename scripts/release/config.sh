#!/bin/sh
# Shared packaging policy. Source after setting root to the repository root.
CAPSULE_PLIST="$root/Support/CapsuleApp/Info.plist"
CAPSULE_ARCH=arm64
CAPSULE_TEAM_ID=2L85KT5GNL
CAPSULE_REPOSITORY=antick/capsule
CAPSULE_SPARKLE_VERSION=2.10.0
CAPSULE_NOTARY_TIMEOUT=30m
CAPSULE_ARTIFACTS="$root/.build/release-artifacts"
plist_value() { /usr/libexec/PlistBuddy -c "Print :$1" "$CAPSULE_PLIST"; }
release_fail() { echo "$*" >&2; exit 1; }
