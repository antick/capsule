#!/bin/sh
# Local acceptance only: create an older signed/notarized copy and a separate feed.
# The public source plist and production artifacts are never modified.
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
. "$root/scripts/release/config.sh"
cd "$root"
: "${NOTARY_PROFILE:?Set a notarization profile}"
work="$root/.build/upgrade-test"
[ ! -e "$work/Capsule.app" ] || release_fail "An upgrade test already exists; preserve its evidence before rerunning."
mkdir -p "$work/site"
app="$work/Capsule.app"
ditto "$root/.build/bundles/production/Capsule.app" "$app"
python3 - "$app/Contents/Info.plist" <<'PY'
import plistlib,sys
p=sys.argv[1]
d=plistlib.load(open(p,'rb'))
build=int(d['CFBundleVersion'])
if build <= 1: raise SystemExit('Upgrade test requires production build > 1')
d['CFBundleVersion']=str(build-1)
d['CFBundleShortVersionString']='0.1.99'
d['SUFeedURL']='http://localhost:18763/appcast.xml'
d['NSAppTransportSecurity']={'NSAllowsLocalNetworking':True}
plistlib.dump(d,open(p,'wb'),sort_keys=False)
PY
identity=${CAPSULE_SIGN_IDENTITY:-$(security find-identity -v -p codesigning | awk '/Developer ID Application/ { print $2; exit }')}
[ -n "$identity" ] || release_fail "Developer ID required."
python3 scripts/release/sign-bundle.py "$app" "$identity" --timestamp
ditto -c -k --keepParent "$app" "$work/older.zip"
scripts/release/notarize.sh "$work/older.zip"
xcrun stapler staple "$app"
xcrun stapler validate "$app"
spctl --assess --type execute --verbose=4 "$app"
cp "$CAPSULE_ARTIFACTS/Capsule-$(scripts/version.sh)-arm64.zip" "$work/site/"
python3 - "$CAPSULE_ARTIFACTS/appcast.xml" "$work/site/appcast.xml" <<'PY'
from pathlib import Path
import re,sys
text=Path(sys.argv[1]).read_text()
text=re.sub(r'https://github.com/antick/capsule/releases/download/v[^/]+/', 'http://localhost:18763/',text)
Path(sys.argv[2]).write_text(text)
PY
.build/artifacts/sparkle/Sparkle/bin/sign_update --account capsule "$work/site/appcast.xml"
echo "Serve $work/site on localhost:18763 and open $app."
echo "Check, download, and restart using Settings. Verify build $(plist_value CFBundleVersion) and preserved settings."
