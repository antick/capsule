# Deployment CLI security status

Checked 12 November 2026 UTC. Landing deployment remains suspended.

## Selected release

Vercel is exact-pinned to **65.11.0**, published 3 November 2026 at
19:38:50 UTC. It is the newest stable release at least seven days old at
verification time. Skip 65.12.0 (5 November, 23:40 UTC), 65.12.1 (6 November)
and 65.14.0 (9 November). The pinned Node 24.22.0 satisfies its Node >=20
requirement. Registry evidence: https://registry.npmjs.org/vercel .

The official release endpoint for this tag and its raw CLI changelog returned
404 during verification. Internal builders change major versions, so release
note coverage is incomplete. The local static build and consumer tests below
provide bounded compatibility evidence. Official CLI build contract:
https://vercel.com/docs/cli/build . Release index:
https://github.com/vercel/vercel/releases .

## Targeted dependency changes

Upgrade the root CLI first, then regenerate the existing lockfile with pnpm
12.13.0 and ignored scripts. Preserve the seven-day minimum, exotic dependency
blocking, strict build policy and existing documented trust-policy exception.
No audit exclusions or severity reductions are applied.

Glob 14 and Minimatch 11 must move together: Glob 13 expects regex-based
internals that Minimatch 11 replaced with matcher objects. Override only
`@vercel/nft@1.10.0>glob` to 14.0.3 and
`@vercel/python-analysis@0.15.3>minimatch` to 11.0.4. NFT uses the public async
glob API; Python analysis uses the retained `match(list, pattern)` export.
Remove the superseded Minimatch 10 selector and unused Zod 4 selector, since
Vercel now pins Zod 4.6.7 itself. Keep unrelated major lines unchanged.

Official migration sources:
https://github.com/isaacs/node-glob/blob/main/changelog.md and
https://github.com/isaacs/minimatch/blob/main/README.md . Glob 14 changes
internal pattern methods and absolute ignore semantics and removes `debug`.
The affected consumers do not use those removed APIs. Tests cover their actual
file discovery, absolute ignore paths and dynamic asset tracing.

Exact override pins and live registry publication dates:

| Package | Pin | Publication UTC |
| --- | --- | --- |
| tar | 7.5.22 | 2026-07-24T15:48:51.111Z |
| minimatch | 11.0.4 | 2026-11-02T04:50:40.232Z |
| glob | 14.0.3 | 2026-10-28T04:08:39.624Z |
| ajv | 8.20.0 | 2026-04-24T15:22:16.529Z |
| js-yaml | 4.3.2 | 2026-08-26T20:42:48.747Z |
| smol-toml | 1.9.1 | 2026-10-09T10:21:39.612Z |
| path-to-regexp | 6.3.0 | 2024-09-12T01:09:36.065Z |
| path-to-regexp | 8.4.2 | 2026-04-01T21:17:05.201Z |
| undici | 5.29.0 | 2025-03-19T18:00:34.079Z |

Glob 14.0.4 and 14.0.5, Minimatch 11.0.5 through 11.0.8, and tar 7.5.23
are newer but younger than seven days. Keep js-yaml on its patched 4.x line;
upstream declares 4.x and no advisory remains there. A js-yaml 5 or route-parser
9 migration is outside these fixes. smol-toml and tar retain their eligible
patched pins. No findings remain for minimatch, glob, smol-toml, js-yaml or tar.

## Verification

`mise run vercel:check` performs a frozen ignored-scripts install, twelve
compatibility tests, CLI startup/help checks and the low-severity audit.
Compatibility tests load packages through their actual installed consumers.
They cover sync/async tar extraction and traversal/symlink escape rejection,
TOML round trips, YAML unsafe-tag rejection, schema validation, route matching,
local HTTP response streaming, Python include/exclude matching, glob ignore,
dotfiles and abort behavior, real Node file tracing of dynamic assets, and
Python Pipfile dependency records through the analyzer's public schema.

A disposable static project builds using `vercel build --prod` with isolated
home/config and no credential environment. Tests inspect its HTML and Build
Output API version 3 config. This does not verify authenticated pull, the
production project or deployment. Help output verifies startup and help only.

The retained landing page passes type checking, builds, seven tests and its
dependency audit, with both unset and placeholder `SITE_URL`. Workflow lint
reports no findings in its default offline mode. Full-history secret scanning
passes. No native Swift code changed, so no native rebuild was required.

## Remaining upstream blockers

The fresh baseline is **21 advisories: 0 critical, 7 high, 11 moderate, 3 low**.
The final graph has **19: 0 critical, 7 high, 9 moderate, 3 low**. The two
removed findings affect glob and minimatch. Observed alert instances and unique
audit advisories are different counts; this report uses fresh audit output.

`vercel:check` and `security` still exit nonzero at the unchanged audit gate.
Do not treat this branch as merge-ready.

- Vercel 65.11.0 and its Node builder still declare Undici 5.29.0 and 5.28.4.
  The retained exact 5.28.4 selector resolves the builder to 5.29.0. All
  currently reported Undici fixes require at least 6.29.1, outside those
  declarations. Undici 5 internally depends on busboy 2.1.1; the busboy fix
  requires 3.2.2 or newer. No maintained same-major fix is available in the
  live registry. Newer Vercel 65.14.0 still declares Undici 5.29.0. Independently
  replacing the transport or its multipart parser would bypass upstream major
  contracts. The CLI also ships bundled older Undici source; lockfile overrides
  cannot replace bundled code. Transport authentication, proxy, TLS, streaming
  and multipart integration need upstream migration coverage beyond a local
  static build. No blanket transport override is included.
- Python analysis 0.15.3, backends, Express and Hono still pin Zod 3.22.4.
  The advisory requires Zod >=4.6.6. Python analysis uses single-argument
  `z.record(...)` at dist/index.js:1440-1476; Zod 4 removed that signature.
  Replacing it without migrating upstream source breaks Pipfile parsing.
  Official migration guide: https://zod.dev/v4/changelog .

A future upstream release must satisfy the release-age policy and pass these
checks before it can resolve the remaining gate failures. Roll back this work
with reverting commits; keep the audit enforcement and deployment suspension.

## Remaining advisories

| Package | Severity | Fixed range | Advisory |
| --- | --- | --- | --- |
| undici | moderate | >=6.23.0 | https://github.com/advisories/GHSA-g9mf-h72j-4rw9 |
| undici | moderate | >=6.24.0 | https://github.com/advisories/GHSA-2mjp-6q6p-2qxm |
| undici | high | >=6.24.0 | https://github.com/advisories/GHSA-vrm6-8vpv-qv8q |
| undici | high | >=6.24.0 | https://github.com/advisories/GHSA-v9p9-hfj2-hcw8 |
| undici | moderate | >=6.24.0 | https://github.com/advisories/GHSA-4992-7rv2-5pvq |
| undici | moderate | >=6.27.0 | https://github.com/advisories/GHSA-p88m-4jfj-68fv |
| undici | low | >=6.27.0 | https://github.com/advisories/GHSA-g8m3-5g58-fq7m |
| undici | moderate | >=6.28.0 | https://github.com/advisories/GHSA-8xcm-r25x-g524 |
| undici | moderate | >=6.28.0 | https://github.com/advisories/GHSA-m8rv-5g2x-5cg5 |
| undici | moderate | >=6.28.0 | https://github.com/advisories/GHSA-v3r7-h72x-cjcm |
| undici | low | >=6.27.0 | https://github.com/advisories/GHSA-35p6-xmwp-9g52 |
| undici | low | >=6.28.1 | https://github.com/advisories/GHSA-r53p-7pc4-xj5r |
| @fastify/busboy | high | >=3.2.1 | https://github.com/advisories/GHSA-x8mw-p69m-v3mx |
| @fastify/busboy | moderate | >=3.2.2 | https://github.com/advisories/GHSA-gxm5-99cw-xjw9 |
| zod | high | >=4.6.6 | https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 |
| undici | high | >=6.29.1 | https://github.com/advisories/GHSA-2m5v-pch6-74hx |
| undici | high | >=6.29.1 | https://github.com/advisories/GHSA-qrxm-fqhp-jwvm |
| undici | moderate | >=6.29.1 | https://github.com/advisories/GHSA-9fm3-97px-rjf6 |
| undici | high | >=6.27.0 | https://github.com/advisories/GHSA-vxpw-j846-p89q |
