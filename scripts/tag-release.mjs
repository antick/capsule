/**
 * Cuts the tag that triggers the release workflow.
 *
 * The version lives in one place — apps/desktop/package.json — and the tag is
 * derived from it, so a release can never be built from a different version
 * than the one it claims to be.
 *
 *   node scripts/tag-release.mjs          create the tag
 *   node scripts/tag-release.mjs --push   create it and push it
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MANIFEST = "apps/desktop/package.json";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message, ...steps) {
  console.error(`\n${message}\n`);
  for (const step of steps) {
    console.error(`  ${step}`);
  }
  console.error("");
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(MANIFEST, "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(
    `${MANIFEST} has no release version (found "${version}").`,
    `Set "version" to something like 0.1.0 in ${MANIFEST}.`,
  );
}
const tag = `v${version}`;

if (git("status", "--porcelain")) {
  fail(
    "The working tree has uncommitted changes.",
    "Commit or stash them, then run this again.",
  );
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") {
  fail(
    `Releases are cut from main; you are on ${branch}.`,
    "git switch main",
  );
}

const existing = git("tag", "--list", tag);
if (existing) {
  fail(
    `${tag} already exists.`,
    `Bump "version" in ${MANIFEST}, commit that, then run this again.`,
  );
}

git("tag", "-a", tag, "-m", `Capsule ${version}`);
console.log(`Tagged ${tag}.`);

if (process.argv.includes("--push")) {
  git("push", "origin", tag);
  console.log(`Pushed ${tag}. The Release workflow builds and publishes it.`);
} else {
  console.log(`\nPush it to start the release:\n\n  git push origin ${tag}\n`);
}
