# Deployment CLI security status

Checked 30 October 2026 UTC (31 October India time). Vercel 65.2.0 was published
22 October at 23:33:51 UTC, the newest stable release at least seven days old.
Skipped 65.3.1, 65.4.0, 65.5.0, 65.7.0 and 65.8.0 because they are younger.
Publication evidence: https://registry.npmjs.org/vercel (time metadata).

Upgrade from 64.0.2 and refresh compatible transitive ranges with pnpm 12.13.0.
Preserve minimumReleaseAge 10080, ignored scripts, exotic dependency blocking,
strict builds and the documented existing trust-policy exception.

## Compatible overrides

Exact version selectors replace vulnerable upstream pins within their existing
major lines. Dates below come from each package's npm registry time metadata.
None skips a newer release within the same major. Undici remains on its latest
5.x release; newer majors require separate migration. These overrides remove all
tar, minimatch, Ajv, YAML, TOML and route-parser findings, plus Zod 4 findings.

| Package | Pin | Publication UTC |
| --- | --- | --- |
| tar | 7.5.22 | 24 July 2026 |
| minimatch | 10.2.6 | 27 July 2026 |
| ajv | 8.20.0 | 24 April 2026 |
| js-yaml | 4.3.2 | 26 August 2026 |
| smol-toml | 1.9.1 | 9 October 2026 |
| path-to-regexp | 6.3.0 | 12 September 2024 |
| path-to-regexp | 8.4.2 | 1 April 2026 |
| zod | 4.6.7 | 12 October 2026 |
| undici | 5.29.0 | 19 March 2025 |

## Verification

`mise run vercel:check` installs the frozen lockfile without scripts, runs eight
compatibility tests, performs CLI startup/help smoke checks and audits without
severity exclusions. Tests load dependencies through actual installed consumers.
Container uses standard tar.extract with file/cwd, both sync and async. Tests
extract valid gzip archives and verify traversal and symlink escapes cannot write
outside the destination. Other tests exercise TOML parse/stringify, YAML load and
unsafe-tag rejection, glob matching, Ajv compilation and validation, v6/v8 route
matching and invalid patterns, Zod 4 validation, and the Node builder's Undici Headers/request response streaming against a local HTTP server. TOML now returns objects with
null prototypes; inspected container call sites use property access, optional
chaining and serialization, which remain supported.

A disposable static project builds using `vercel build --prod` with an isolated
home/config directory and no credential environment. Tests inspect the generated
static HTML and Build Output API version 3 config. This verifies local static
build integration; it does not verify authenticated pull, the production project,
its Astro adapter integration, or deployment. CLI help checks alone establish
startup/help smoke behavior, not execution of every advertised flag.

## Remaining upstream blockers

Audit falls from 51 initially, through 41 after the CLI upgrade and 21 after compatible overrides, to **19**:
**0 critical, 7 high, 9 moderate, 3 low**. All remaining paths are listed below.
The gate intentionally fails and prevents deployment before credential use.
No incompatible major override or advisory suppression is included.

- Vercel 65.2.0 and the patched @vercel/node graph now both use Undici 5.29.0.
  A targeted override replaces the Node builder's exact 5.28.4 pin and removes
  GHSA-c76h-2ccp-4975 and GHSA-cxrh-j4jr-qwg3. Inspected dev-server.mjs
  uses Headers, request, statusCode and response body streaming/text/arrayBuffer.
  Remaining fixes require >=6.29.1. Undici 5 declares busboy ^2.0.0, resolved
  2.1.1, while the busboy fixes require >=3.2.2. These are undeclared major
  migrations; representative static builds do not establish compatibility of
  Undici transport or multipart parsing across all builders.
- @vercel/python-analysis 0.15.2, @vercel/backends 22.0.1, @vercel/express
  22.0.1 and @vercel/hono 22.0.1 pin Zod 3.22.4. The remaining advisory
  requires >=4.6.6, a major migration distinct from the applied Zod 4 update.

Landing CI checks this graph when `.github/vercel/**` changes. Weekly Security
CI and `mise run security` also run it. Thus `mise run security` currently fails
on the dependency audit even though workflow lint and secret scanning pass.

## Remaining advisories and paths

| Package | Severity | Fixed range | Advisory |
| --- | --- | --- | --- |
| undici | moderate | >=6.23.0 | https://github.com/advisories/GHSA-g9mf-h72j-4rw9 |
| undici | moderate | >=6.24.0 | https://github.com/advisories/GHSA-2mjp-6q6p-2qxm |
| undici | high | >=6.24.0 | https://github.com/advisories/GHSA-vrm6-8vpv-qv8q |
| undici | high | >=6.24.0 | https://github.com/advisories/GHSA-v9p9-hfj2-hcw8 |
| undici | moderate | >=6.24.0 | https://github.com/advisories/GHSA-4992-7rv2-5pvq |
| undici | moderate | >=6.27.0 | https://github.com/advisories/GHSA-p88m-4jfj-68fv |
| undici | high | >=6.27.0 | https://github.com/advisories/GHSA-vxpw-j846-p89q |
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

Exact dependency paths reported by `pnpm audit --json`:

```text
.>vercel>@vercel/backends>zod
.>vercel>@vercel/elysia>@vercel/node>undici
.>vercel>@vercel/elysia>@vercel/node>undici>@fastify/busboy
.>vercel>@vercel/express>@vercel/cervel>@vercel/backends>zod
.>vercel>@vercel/express>@vercel/node>undici
.>vercel>@vercel/express>@vercel/node>undici>@fastify/busboy
.>vercel>@vercel/express>zod
.>vercel>@vercel/fastify>@vercel/node>undici
.>vercel>@vercel/fastify>@vercel/node>undici>@fastify/busboy
.>vercel>@vercel/h3>@vercel/node>undici
.>vercel>@vercel/h3>@vercel/node>undici>@fastify/busboy
.>vercel>@vercel/hono>@vercel/node>undici
.>vercel>@vercel/hono>@vercel/node>undici>@fastify/busboy
.>vercel>@vercel/hono>zod
.>vercel>@vercel/koa>@vercel/node>undici
.>vercel>@vercel/koa>@vercel/node>undici>@fastify/busboy
.>vercel>@vercel/nestjs>@vercel/node>undici
.>vercel>@vercel/nestjs>@vercel/node>undici>@fastify/busboy
.>vercel>@vercel/node>undici
.>vercel>@vercel/node>undici>@fastify/busboy
.>vercel>@vercel/python-analysis>zod
.>vercel>@vercel/python>@vercel/python-analysis>zod
.>vercel>undici
.>vercel>undici>@fastify/busboy
```
