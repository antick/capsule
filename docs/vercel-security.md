# Deployment CLI security status

Checked 30 October 2026 UTC (31 October India time). Vercel 65.2.0 was published
22 October at 23:33:51 UTC, the newest stable release at least seven days old.
Skipped 65.3.1, 65.4.0, 65.5.0, 65.7.0 and 65.8.0 because they are younger.
Publication evidence: https://registry.npmjs.org/vercel (time metadata).

Upgrade from 64.0.2 and refresh all compatible transitive ranges with pnpm
12.13.0, retaining minimumReleaseAge 10080, ignored scripts, exotic dependency
blocking, strict builds and the documented existing trust-policy exception.
Audit decreases from 51 to 41 advisories: 1 critical, 18 high, 18 moderate, 4 low.
This is partial remediation, and deployment remains blocked by the audit gate.

## Upstream constraints

The latest eligible CLI pins undici 5.29.0; @vercel/node 27.0.1 pins undici
5.28.4. The remaining fixes require undici >=6.29.1 and busboy >=3.2.2,
whereas undici 5 requires busboy ^2.0.0. @vercel/python-analysis 0.15.2 and
@vercel/backends 22.0.1 pin zod 3.22.4; its advisory requires >=4.6.6.
Forcing these new majors violates their declared contracts. Offline help and
static-site tests cannot establish compatibility of all deployment builders.

@vercel/container 22.0.1 pins tar 7.5.11 (critical fix >=7.5.19, all listed
fixes >=7.5.21). Other exact upstream constraints include path-to-regexp
6.1.0 / 8.3.0, smol-toml 1.5.2, minimatch 10.1.1, js-yaml 4.1.1 and ajv
8.6.3. Compatible range updates cannot replace exact upstream pins. Same-major
overrides could address some findings but do not solve the incompatible-major
constraints; no override or advisory suppression is included.

## Reproduce

Run `mise run vercel:check`: frozen install with scripts disabled, offline
version and build/pull/deploy help checks, then a nonzero audit with no severity
exclusions. `mise run security` includes this check. Landing CI includes it
when `.github/vercel/**` changes; weekly Security CI checks new advisories.
Deployment checks the graph before its step that receives production secrets.

No pull, authenticated Vercel build, deployment or public-site mutation was run.
CLI flags are verified offline; complete Vercel build integration needs project
configuration normally fetched by authenticated `vercel pull`.

## Remaining advisories

| Package | Severity | Fixed range | Advisory |
| --- | --- | --- | --- |
| undici | moderate | >=5.28.5 | https://github.com/advisories/GHSA-c76h-2ccp-4975 |
| path-to-regexp | high | >=6.3.0 | https://github.com/advisories/GHSA-9wv6-86v2-598j |
| undici | moderate | >=6.23.0 | https://github.com/advisories/GHSA-g9mf-h72j-4rw9 |
| undici | low | >=5.29.0 | https://github.com/advisories/GHSA-cxrh-j4jr-qwg3 |
| minimatch | high | >=10.2.1 | https://github.com/advisories/GHSA-3ppc-4f35-3m26 |
| minimatch | high | >=10.2.3 | https://github.com/advisories/GHSA-7r86-cg39-jmmj |
| minimatch | high | >=10.2.3 | https://github.com/advisories/GHSA-23c5-xmqv-rm74 |
| ajv | moderate | >=8.18.0 | https://github.com/advisories/GHSA-2g4f-4pwh-qvx6 |
| undici | moderate | >=6.24.0 | https://github.com/advisories/GHSA-2mjp-6q6p-2qxm |
| undici | high | >=6.24.0 | https://github.com/advisories/GHSA-vrm6-8vpv-qv8q |
| undici | high | >=6.24.0 | https://github.com/advisories/GHSA-v9p9-hfj2-hcw8 |
| undici | moderate | >=6.24.0 | https://github.com/advisories/GHSA-4992-7rv2-5pvq |
| smol-toml | moderate | >=1.6.1 | https://github.com/advisories/GHSA-v3rj-xjv7-4jmq |
| path-to-regexp | high | >=8.4.0 | https://github.com/advisories/GHSA-j3q9-mxjg-w52f |
| path-to-regexp | moderate | >=8.4.0 | https://github.com/advisories/GHSA-27v5-c462-wpq7 |
| tar | moderate | >=7.5.16 | https://github.com/advisories/GHSA-vmf3-w455-68vh |
| undici | moderate | >=6.27.0 | https://github.com/advisories/GHSA-p88m-4jfj-68fv |
| undici | high | >=6.27.0 | https://github.com/advisories/GHSA-vxpw-j846-p89q |
| undici | low | >=6.27.0 | https://github.com/advisories/GHSA-g8m3-5g58-fq7m |
| js-yaml | moderate | >=4.2.0 | https://github.com/advisories/GHSA-h67p-54hq-rp68 |
| js-yaml | high | >=4.3.0 | https://github.com/advisories/GHSA-52cp-r559-cp3m |
| tar | moderate | >=7.5.18 | https://github.com/advisories/GHSA-w8wr-v893-vjvp |
| tar | critical | >=7.5.19 | https://github.com/advisories/GHSA-23hp-3jrh-7fpw |
| tar | high | >=7.5.18 | https://github.com/advisories/GHSA-8x88-c5mf-7j5w |
| tar | moderate | >=7.5.17 | https://github.com/advisories/GHSA-gvwx-54wh-qm9j |
| undici | moderate | >=6.28.0 | https://github.com/advisories/GHSA-8xcm-r25x-g524 |
| undici | moderate | >=6.28.0 | https://github.com/advisories/GHSA-m8rv-5g2x-5cg5 |
| undici | moderate | >=6.28.0 | https://github.com/advisories/GHSA-v3r7-h72x-cjcm |
| undici | low | >=6.27.0 | https://github.com/advisories/GHSA-35p6-xmwp-9g52 |
| js-yaml | high | >=4.3.1 | https://github.com/advisories/GHSA-5p4m-2wfm-xmqj |
| tar | high | >=7.5.21 | https://github.com/advisories/GHSA-r292-9mhp-454m |
| js-yaml | high | >=4.3.2 | https://github.com/advisories/GHSA-2883-xcg3-v3hh |
| smol-toml | high | >=1.7.1 | https://github.com/advisories/GHSA-7w5x-hrqm-74c2 |
| undici | low | >=6.28.1 | https://github.com/advisories/GHSA-r53p-7pc4-xj5r |
| @fastify/busboy | high | >=3.2.1 | https://github.com/advisories/GHSA-x8mw-p69m-v3mx |
| smol-toml | moderate | >=1.9.0 | https://github.com/advisories/GHSA-r4xh-jqrq-34v2 |
| @fastify/busboy | moderate | >=3.2.2 | https://github.com/advisories/GHSA-gxm5-99cw-xjw9 |
| zod | high | >=4.6.6 | https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 |
| undici | high | >=6.29.1 | https://github.com/advisories/GHSA-2m5v-pch6-74hx |
| undici | high | >=6.29.1 | https://github.com/advisories/GHSA-qrxm-fqhp-jwvm |
| undici | moderate | >=6.29.1 | https://github.com/advisories/GHSA-9fm3-97px-rjf6 |
