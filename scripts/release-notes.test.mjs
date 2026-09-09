import assert from "node:assert/strict";
import { test } from "node:test";
import { releaseNotesFor } from "./release-notes.mjs";

const CHANGELOG = `# Changelog

All notable changes to Capsule are documented in this file.

## 0.2.0 — second release

### Added

- A thing.

## 0.1.0 — first release

### Added

- The first thing.

## An older entry with no version

- Something from before versions.
`;

test("takes the section for the version asked for", () => {
  assert.equal(
    releaseNotesFor(CHANGELOG, "0.1.0"),
    "### Added\n\n- The first thing.",
  );
});

test("stops at the next heading rather than running to the end", () => {
  assert.equal(releaseNotesFor(CHANGELOG, "0.2.0"), "### Added\n\n- A thing.");
});

test("reads the last section when nothing follows it", () => {
  assert.equal(
    releaseNotesFor("# Changelog\n\n## 1.0.0\n\n- Shipped.\n", "1.0.0"),
    "- Shipped.",
  );
});

test("accepts a heading written with a leading v", () => {
  assert.equal(releaseNotesFor("## v1.2.3\n\n- Done.\n", "1.2.3"), "- Done.");
});

test("does not match a version that is only a prefix of another", () => {
  assert.equal(releaseNotesFor("## 0.1.10\n\n- Ten.\n", "0.1.1"), null);
});

test("treats the dots as literal, not as any character", () => {
  assert.equal(releaseNotesFor("## 0x1x0\n\n- No.\n", "0.1.0"), null);
});

test("returns nothing for a missing version", () => {
  assert.equal(releaseNotesFor(CHANGELOG, "9.9.9"), null);
});

test("returns nothing for a heading with an empty body", () => {
  assert.equal(
    releaseNotesFor("## 0.1.0\n\n## 0.0.9\n\n- Old.\n", "0.1.0"),
    null,
  );
});
