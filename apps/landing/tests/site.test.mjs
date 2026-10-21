import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// These read the built site in dist/, so run them after `astro build`.
const html = readFileSync("dist/index.html", "utf8");
const version = readFileSync("../../Support/CapsuleApp/Info.plist", "utf8").match(
  /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
)[1];
const pages = readdirSync("dist").filter((name) => name.endsWith(".html"));

test("the download link names the files this version's release publishes", () => {
  const dmg = `https://github.com/antick/capsule/releases/download/v${version}/Capsule-${version}-arm64.dmg`;
  assert.ok(html.includes(`href="${dmg}"`), `Missing ${dmg}`);
  assert.match(html, /brew install --cask antick\/tap\/capsule/);
  assert.match(html, new RegExp(`Version ${version.replaceAll(".", "\\.")}`));
});

test("every page runs no script and has no inline code, as the CSP requires", () => {
  for (const page of pages) {
    const source = readFileSync(join("dist", page), "utf8");
    assert.doesNotMatch(source, /<script\b/i, `${page} has a script`);
    assert.doesNotMatch(source, /<style\b/i, `${page} has an inline stylesheet`);
    assert.doesNotMatch(source, /\sstyle="/i, `${page} has a style attribute`);
    assert.doesNotMatch(source, /\son[a-z]+="/i, `${page} has an event handler`);
  }
});

test("the CSP allows only this site's own files", () => {
  const { headers } = JSON.parse(readFileSync("vercel.json", "utf8"));
  const all = headers.find(({ source }) => source === "/(.*)").headers;
  const csp = all.find(({ key }) => key === "Content-Security-Policy").value;
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-|https?:|\*/);
  for (const key of ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy"]) {
    assert.ok(all.some((header) => header.key === key), `Missing ${key}`);
  }
});

test("pages load nothing from other sites", () => {
  for (const page of pages) {
    const source = readFileSync(join("dist", page), "utf8");
    for (const [, url] of source.matchAll(/<(?:img|link|source)\b[^>]*?(?:src|srcset|href)="(https?:[^"]+)"/g)) {
      assert.match(url, /^https:\/\/capsule\.potion\.sh\//, `${page} loads ${url}`);
    }
  }
});

test("the landing page has one heading, working anchors and alt text", () => {
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/capsule\.potion\.sh\/"/);
  for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(html.includes(`id="${target}"`), `Missing anchor: ${target}`);
  }
  for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
    assert.match(tag, /\salt[\s=>]/, `Image without alt: ${tag}`);
  }
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/_astro\/[^"?#]+)"/g)) {
    assert.ok(existsSync(join("dist", asset)), `Missing asset: ${asset}`);
  }
});

test("the site has a 404 page, robots.txt and a sitemap", () => {
  assert.ok(pages.includes("404.html"));
  assert.match(readFileSync("dist/404.html", "utf8"), /<meta name="robots" content="noindex"/);
  assert.match(readFileSync("dist/robots.txt", "utf8"), /Sitemap: https:\/\/capsule\.potion\.sh\/sitemap\.xml/);
  assert.match(readFileSync("dist/sitemap.xml", "utf8"), /<loc>https:\/\/capsule\.potion\.sh\/<\/loc>/);
});
