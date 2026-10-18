#!/bin/sh
# Checks the release-notes extraction the release depends on.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

expect() {
  if [ "$2" = "$3" ]; then
    echo "ok   $1"
  else
    echo "FAIL $1"
    echo "  expected: $(printf '%s' "$3" | tr '\n' '|')"
    echo "  got:      $(printf '%s' "$2" | tr '\n' '|')"
    failures=$((failures + 1))
  fi
}

cat > "$tmp/CHANGELOG.md" <<'MD'
# Changelog

## 0.2.0 — the native app

### Added

- A dock.

## v0.1.1

- A fix.
## 0.1.0

MD

notes() { CHANGELOG="$tmp/CHANGELOG.md" "$root/scripts/release-notes.sh" "$@" 2>/dev/null || true; }

expect "a titled heading is matched on its version" "$(notes 0.2.0)" "### Added

- A dock."
expect "a v-prefixed heading matches" "$(notes 0.1.1)" "- A fix."
expect "an empty section has no notes" "$(notes 0.1.0)" ""
expect "a missing version has no notes" "$(notes 9.9.9)" ""
expect "a version is not matched as a prefix" "$(notes 0.1)" ""
printf '## 0.0.9\n\n- Last.\n' > "$tmp/last.md"
expect "the last section reads to the end" "$(CHANGELOG="$tmp/last.md" "$root/scripts/release-notes.sh" 0.0.9 2>/dev/null)" "- Last."
printf '## 0.1.10\n\n- Ten.\n' > "$tmp/ten.md"
expect "a longer version is not matched" "$(CHANGELOG="$tmp/ten.md" "$root/scripts/release-notes.sh" 0.1.1 2>/dev/null || true)" ""
printf '## 0x1x0\n\n- No.\n' > "$tmp/dots.md"
expect "dots are literal" "$(CHANGELOG="$tmp/dots.md" "$root/scripts/release-notes.sh" 0.1.0 2>/dev/null || true)" ""
expect "--check passes when notes exist" "$(notes --check 0.2.0)" "CHANGELOG.md has notes for 0.2.0."

[ "$failures" -eq 0 ] || exit 1
