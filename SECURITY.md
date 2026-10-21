# Security

## Reporting a vulnerability

Please report vulnerabilities through
[GitHub's private vulnerability reporting](https://github.com/antick/capsule/security/advisories/new).
Do not open a public issue, and never include provider credentials, session
files or API keys, yours or anyone else's. You should hear back within a week.

Only the latest release is supported; fixes ship as a new release through
Settings → Updates and Homebrew.

## What Capsule protects

Capsule reads the logins your AI tools already keep on your Mac, so it treats
them with care:

- Credentials and readings never leave the Mac except in each provider's own
  usage request, sent to that provider.
- API keys you paste are kept in an owner-only file and never shown again.
- Activity detection only reads local session records. Capsule installs no
  hooks, sends no prompts and never drives an agent.
- Update checks talk to GitHub only, and send no credentials or readings.

## How releases are built

- Every release is built by the Release workflow from a `v*` tag on `main`,
  Developer ID signed, notarized by Apple, and verified with Gatekeeper before
  anything is published.
- Updates are signed with Sparkle's Ed25519 key, and the feed is published only
  after its downloads are public. A modified archive is rejected.
- Signing secrets live in the protected `release` environment, which only
  version tags may use, and are removed from the runner after use.
- Published tags and release assets are never moved or replaced.

## How this repository is kept safe

- Every GitHub Action is pinned to a full commit, and every workflow starts
  with no permissions, granting each job only what it needs. No workflow runs
  on `pull_request_target`, so pull requests from forks never see a secret.
- The Security workflow lints the workflows with
  [zizmor](https://docs.zizmor.sh) and scans the whole git history with
  [gitleaks](https://github.com/gitleaks/gitleaks), on every change and weekly.
- Every dependency is pinned to an exact version published at least 7 days
  earlier. Tools come from `mise.lock` with checksums; the landing page's
  packages come from `pnpm-lock.yaml` with integrity hashes, may not run
  install scripts, and are audited on every change. Dependabot proposes updates
  with the same 7-day cooldown.
- The landing page at [capsule.potion.sh](https://capsule.potion.sh) is static,
  runs no JavaScript, and is served with a strict Content-Security-Policy. It is
  deployed only from a published release; Vercel never builds a branch or a
  pull request.

Run `mise run security` to repeat the workflow and secret checks locally.
