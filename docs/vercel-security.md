# Retired deployment CLI

Landing deployment is suspended. The unused deployment-only Vercel CLI,
its isolated dependency graph, dedicated install/check tasks and compatibility
tests have been removed. The retained static page builds directly with Astro.

Earlier exact dependency migrations passed local compatibility tests and made
the isolated lockfile audit pass. They could not replace older Undici and
busboy implementations bundled inside the published CLI distribution. Removing
the unused distribution removes that dependency surface from retained code.
Previous migrations and their verification remain in git history.

The landing source, exact dependency pins, lockfile, type checks, build, tests
and audit remain in place. Its optional `SITE_URL` behavior, no-script policy,
CSP and security headers are unchanged. `apps/landing/vercel.json` retains
`git.deploymentEnabled: false`. Workflow security lint, full-history secret
scanning, app release scripts and GitHub Pages update hosting remain enabled.

Any future Vercel deployment requires a newly reviewed exact-pinned dependency
and lockfile, releases at least seven days old, ignored install scripts and
the existing provenance, exotic-dependency and strict-build restrictions.
Review the entire published distribution, including bundled code, and restore
appropriate compatibility checks before use. Do not replace the retired CLI
with an unpinned on-demand command or a global installation.

Repository settings do not establish live provider deployment prevention.
Infrastructure state and any remaining remote alerts require separate review;
removing local files does not close GitHub alerts before a default-branch merge.
