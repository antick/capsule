#!/bin/sh
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
. "$root/scripts/release/config.sh"
: "${NOTARY_PROFILE:?A validated notarytool Keychain profile is required}"
artifact=$1
result=$(mktemp)
trap 'rm -f "$result"' EXIT
set -- --keychain-profile "$NOTARY_PROFILE"
if [ -n "${NOTARY_KEYCHAIN:-}" ]; then set -- "$@" --keychain "$NOTARY_KEYCHAIN"; fi
xcrun notarytool submit "$artifact" "$@" --wait --timeout "$CAPSULE_NOTARY_TIMEOUT" --output-format json > "$result"
python3 - "$result" <<'PY'
import json, sys
result = json.load(open(sys.argv[1]))
if result.get('status') != 'Accepted':
    raise SystemExit('Notarization was not accepted: ' + str(result.get('id')))
print('Apple notarization accepted: ' + result['id'], file=sys.stderr)
PY
