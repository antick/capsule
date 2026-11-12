# Deployment CLI dependency verification

Checked 12 November 2026 UTC. Landing deployment remains suspended.

## Release selection

Vercel is exact-pinned to **65.11.0**, published 3 November 2026 at
19:38:50 UTC. It is the newest stable release at least seven days old at
verification time. Skip 65.12.0 (5 November, 23:40 UTC), 65.12.1 (6 November)
and 65.14.0 (9 November). Registry: https://registry.npmjs.org/vercel .

Undici 8.12.4 was published 5 November at 08:55:59 UTC and was already seven
days old when selected on 12 November at 08:57 UTC. It requires Node >=22.19.0;
this repository pins Node 24.22.0. Glob 14.0.3 and Minimatch 11.0.4 are the
newest eligible versions. Skip Glob 14.0.4 and 14.0.5, Minimatch 11.0.5 through
11.0.8, and tar 7.5.23 because they are younger than seven days.

## Consumer migrations

Upgrade the root CLI first, then update the existing lockfile with pnpm
12.13.0 and ignored scripts. Preserve the seven-day minimum, exotic dependency
blocking, strict build policy and existing documented trust-policy exception.
No audit exclusions or severity reductions are applied.

- Move only NFT 1.10.0 to Glob 14.0.3 and Python analysis 0.15.3 to Minimatch
  11.0.4. Glob 14 and Minimatch 11 use matcher objects in place of regex-based
  internals; do not put Minimatch 11 under Glob 13. NFT uses public async glob;
  Python analysis uses the retained `match(list, pattern)` export. Tests verify
  real dynamic asset tracing, absolute ignore rules, dotfiles and cancellation.
- Move only Python analysis 0.15.3, backends 24.0.1, Express 24.0.1 and Hono
  24.0.1 to Zod 4.6.7. Installed 4.6.7 accepts the single-argument record form,
  despite its removal in the initial Zod 4 guide. Public Pipfile, lockfile,
  project and UV schemas pass valid and invalid configuration tests. Retain
  the compatible Zod 4.1.11 selector for older nested CLI config packages.
- Move only Vercel 65.11.0, its optional CLI support package 65.11.0, and Node
  builder 29.0.1 to Undici 8.12.4. Remove the superseded Undici 5 selector.
  Vulnerable busboy 2 disappears naturally because Undici 8 owns multipart
  parsing. Do not override busboy independently or change unrelated maintained
  Undici major lines used by Blob and Sandbox.

Undici 7 removes legacy interceptors and `throwOnError`; Undici 8 removes legacy
handler wrappers and nonstandard Blob objects, bridges global dispatchers and
enables HTTP/2 by default. The inspected Node dev-server imports only public
`Headers` and `request`, for local HTTP response streaming. The tests cover
request/fetch, multipart serialization/parsing, redirects, cancellation, custom
agents, authenticated local CONNECT tunneling and TLS rejection/custom CA trust.
Undici 8 forwards plain HTTP proxy targets by default; the CONNECT fixture
explicitly sets `proxyTunnel: true`. No application ProxyAgent callsite changed.

Exact selectors and package-specific comments live in `pnpm-workspace.yaml`.
Existing patched tar, TOML, YAML, Ajv and route-parser pins remain on their
compatible major lines. Latest js-yaml 5 and path-to-regexp 9 are separate
transitive major migrations with no remaining advisory in the retained lines.

| Package | Exact selected pin | Publication UTC |
| --- | --- | --- |
| vercel | 65.11.0 | 2026-11-03T19:38:50.927Z |
| undici | 8.12.4 | 2026-11-05T08:55:59.361Z |
| glob | 14.0.3 | 2026-10-28T04:08:39.624Z |
| minimatch | 11.0.4 | 2026-11-02T04:50:40.232Z |
| zod | 4.6.7 | 2026-10-12T16:29:37.778Z |
| tar | 7.5.22 | 2026-07-24T15:48:51.111Z |
| smol-toml | 1.9.1 | 2026-10-09T10:21:39.612Z |
| js-yaml | 4.3.2 | 2026-08-26T20:42:48.747Z |
| ajv | 8.20.0 | 2026-04-24T15:22:16.529Z |
| path-to-regexp | 6.3.0 | 2024-09-12T01:09:36.065Z |
| path-to-regexp | 8.4.2 | 2026-04-01T21:17:05.201Z |

Publication times come from each package's `https://registry.npmjs.org/` time
metadata. Exact manifest and override pins are checked against the seven-day
minimum; the package manager also enforces the minimum on transitive resolution.

## Verification and limits

The fresh baseline audit reported **21 advisories: 7 high, 11 moderate and
3 low**. The root-only CLI upgrade still reported 21 advisories. The later targeted
consumer migrations produce the result below. The final deployment graph
reports **zero advisories** at the unchanged
low-severity threshold. No findings remain for the scoped packages. Unique audit
advisories and previously observed alert instances are different counts.

`mise run vercel:check` checks the frozen ignored-scripts install, eighteen
consumer compatibility tests, CLI startup/help and the dependency audit. The
suite includes a disposable `vercel build --prod` with isolated home/config
and no credential environment, inspecting static HTML and Build Output API v3.
The retained landing page is checked with unset and placeholder `SITE_URL`,
including type checking, builds, seven tests and its dependency audit. Strict
peer installs, workflow lint and full-history secret scanning are also checked.
No native Swift code changed, so no native rebuild was required.

An audit-clean lockfile does not cover bundled dependency copies. Vercel's
shipped JavaScript includes older embedded Undici source, which package-manager
overrides cannot replace. Reachability and security of those copies remain
unverified. Authenticated pull, production builds, deployment, provider flows,
HTTP/2 production transport and other-platform fallback execution are not
verified by these local tests. CLI help verifies startup/help only. Workflow
lint runs in its default offline mode.

Official CLI release notes are available at
https://vercel.com/docs/cli/release-notes and cover 65.2.0 through 65.11.0,
including the native transition in 65.10.0. GitHub endpoint 404 responses do
not establish missing official coverage. The installed 65.11.0 launcher uses
the native binary on this macOS arm64 host and still permits an explicit
Node.js fallback. Separate isolated-home tests assert each launch mode via
version output and verify a real static build's HTML and v3 output config.
Downloads are disabled in these fixtures; no credentials or production project
are used. Automatic fallback after a missing or unstartable binary and execution
of the separate optional support package on other platforms remain unverified.
Independent review is still required. No publication or deployment is implied.
Roll back with reverting commits while retaining deployment suspension.

Official migration and behavior sources:

- https://vercel.com/docs/cli/release-notes
- https://github.com/vercel/vercel/releases
- https://vercel.com/docs/cli/build
- https://github.com/isaacs/node-glob/blob/main/changelog.md
- https://github.com/isaacs/minimatch/blob/main/README.md
- https://zod.dev/v4/changelog
- https://github.com/nodejs/undici/releases/tag/v6.0.0
- https://github.com/nodejs/undici/releases/tag/v7.0.0
- https://github.com/nodejs/undici/releases/tag/v8.0.0
- https://github.com/nodejs/undici/blob/main/README.md
