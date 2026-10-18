#!/bin/sh
# Runs each test target in its own process, one after another. The dock's
# tests drive real windows on the main thread; run all together in one
# process, suites interleave on it. One process per target is also what a
# local `swift test` does with current toolchains, so CI tests what passes
# here, and a failure names its target. Within a target the tests run one
# at a time, so a crash is pinned to the test that was running.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
for target in CapsuleCoreTests CapsuleUsageTests CapsuleHUDTests CapsuleActivityTests CapsuleSystemTests \
  CapsuleDockTests CapsuleShellTests CapsuleSnapshotTests; do
  echo "== $target"
  swift test --no-parallel --filter "$target"
done
