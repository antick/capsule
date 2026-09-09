/**
 * Lifts this version's section out of CHANGELOG.md.
 *
 * electron-builder puts the result in the GitHub release body *and* in
 * `latest-mac.yml`, which is where Settings → Updates reads "What's new" from.
 * So the changelog entry is the release notes — there is no second place to
 * write them, and no way for the two to drift apart.
 *
 *   node scripts/release-notes.mjs           write the file for a build
 *   node scripts/release-notes.mjs --check   only verify the section exists
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file rather than the working directory: the desktop
// package runs it from apps/desktop, and the tag script from the repo root.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHANGELOG = join(ROOT, "CHANGELOG.md");
const MANIFEST = join(ROOT, "apps/desktop/package.json");
const OUTPUT = join(ROOT, "apps/desktop/build/release-notes.md");

export function releaseNotesFor(changelog, version) {
  const lines = changelog.split("\n");
  // The heading may carry a title after the version ("## 0.1.0 — first
  // release"), so it is matched on the version rather than on the whole line.
  const start = lines.findIndex((line) =>
    new RegExp(`^##\\s+v?${version.replace(/\./g, "\\.")}(\\s|$)`).test(line),
  );
  if (start === -1) {
    return null;
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return body || null;
}

const checkOnly = process.argv.includes("--check");
const { version } = JSON.parse(readFileSync(MANIFEST, "utf8"));
const notes = releaseNotesFor(readFileSync(CHANGELOG, "utf8"), version);

if (!notes) {
  const message = `CHANGELOG.md has no "## ${version}" section.`;
  if (checkOnly) {
    console.error(`\n${message}\n`);
    console.error(`  Add a heading "## ${version}" to CHANGELOG.md, with what`);
    console.error("  changed under it, commit that, then run this again.\n");
    process.exit(1);
  }
  console.warn(`::warning title=No release notes::${message}`);
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `See the changelog for what changed in ${version}.\n`);
  process.exit(0);
}

if (checkOnly) {
  console.log(`CHANGELOG.md has notes for ${version}.`);
  process.exit(0);
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${notes}\n`);
console.log(`Wrote apps/desktop/build/release-notes.md (${version}).`);
