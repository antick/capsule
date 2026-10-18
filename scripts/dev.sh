#!/bin/sh
# Build and open only Capsule Dev; never target the installed production app.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
app=$("$root/scripts/bundle-macos.sh" "${1:-debug}" development)
python3 "$root/scripts/restart-dev.py" "$app"
