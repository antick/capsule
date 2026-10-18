#!/bin/sh
# Uses a disposable key to exercise Sparkle's actual signature verifier.
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
bin="$root/.build/artifacts/sparkle/Sparkle/bin"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
umask 077
openssl rand -base64 32 > "$work/key"
printf 'original update archive\n' > "$work/update.zip"
signature=$("$bin/sign_update" --ed-key-file "$work/key" -p "$work/update.zip")
"$bin/sign_update" --ed-key-file "$work/key" --verify "$work/update.zip" "$signature"
printf 'modified archive\n' >> "$work/update.zip"
if "$bin/sign_update" --ed-key-file "$work/key" --verify "$work/update.zip" "$signature" > "$work/result" 2>&1; then
  echo 'FAIL: tampered archive was accepted' >&2
  exit 1
fi
echo 'Verified: signed archive accepted; tampered archive rejected.'
