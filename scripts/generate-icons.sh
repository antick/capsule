#!/bin/sh
# Rebuild bundle assets from the same native drawing used in the app.
set -eu
cd "$(dirname "$0")/.."
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cat Sources/CapsuleCore/Branding.swift Sources/CapsuleCore/Shell.swift > "$work/main.swift"
sed '/^import CapsuleCore$/d' Sources/CapsuleHUD/BrandIcon.swift >> "$work/main.swift"
cat scripts/render-icons.swift >> "$work/main.swift"
swift -swift-version 6 "$work/main.swift" "$work"
iconutil -c icns "$work/AppIcon.iconset" -o Support/CapsuleApp/Resources/AppIcon.icns
cp "$work/AppIcon.png" Support/CapsuleApp/Resources/AppIcon.png
cp "$work"/trayTemplate*.png Support/CapsuleApp/Resources/
swift -swift-version 6 "$work/main.swift" "$work" --development
iconutil -c icns "$work/AppIcon.iconset" -o Support/CapsuleApp/Resources/AppIconDev.icns
