# Releasing Capsule

Capsule ships only for Apple silicon, macOS 14 or newer. Every public build
is Developer ID signed, notarized by Apple, and contains only arm64 code,
including Sparkle's installer helpers. Signing credentials are mandatory.

## Everyday development

Run `taskpolicy -b scripts/dev.sh`. This builds and opens **Capsule Dev** with a
blue icon. `scripts/dev.sh release` uses optimized code with the same separate
development identity. An unbundled `swift run` also uses development storage.

Production uses `com.antick.capsule`, `/Applications/Capsule.app`, and
`~/Library/Application Support/Capsule`. Development uses
`com.antick.capsule.dev`, `.build/bundles/development/Capsule Dev.app`, and
`~/Library/Application Support/Capsule Dev`. Preferences, caches, logging and
login-item registration follow the separate identities. Both read existing
provider sessions, so running both can make independent usage requests.
Development never starts the updater. Neither build changes your normal HOME.

## One-time credentials and hosting

- Developer ID Application certificate and private key, exported as a
  password-protected PKCS#12 file. Team: `2L85KT5GNL`.
- Apple notarization API key, key ID, and issuer. A valid existing team key can
  be reused. Never commit private keys or paste them into logs.
- Sparkle Ed25519 key in login Keychain under account `capsule`. Generate with
  `.build/artifacts/sparkle/Sparkle/bin/generate_keys --account capsule` after
  `swift package resolve`. The public key alone belongs in Info.plist.
- GitHub Pages configured for Actions at `https://antick.github.io/capsule/`.
- GitHub environment `release`, restricted to `v*` tags, with these secrets:
  `MAC_CERTIFICATE` (base64 PKCS#12), `MAC_CERTIFICATE_PASSWORD`,
  `APPLE_API_KEY_P8`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`,
  `SPARKLE_PRIVATE_KEY` (Sparkle export, base64 text).
- The `github-pages` environment must permit deployment from release tags.
- `HOMEBREW_TAP_TOKEN` in the `release` environment: a fine-grained token with
  Contents read and write on `antick/homebrew-tap` only. The release job uses it
  to point `Casks/capsule.rb` at the new zip; without it the job warns and the
  cask stays where it was.

- GitHub environment `landing`, restricted to the `main` branch and `v*` tags,
  with `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. See
  [The landing page](#the-landing-page).

Use `gh secret set NAME --env release` with input from a protected local file
or stdin; never put secret values in shell history. Keep a secure backup of the
Apple certificate/private key, its password, and Sparkle key. GitHub secrets
cannot be downloaded later. The local Sparkle key remains in login Keychain.

CI imports the certificate into a temporary keychain, restores its prior
keychain search list and deletes temporary secrets even when a step fails.
The bundled Apple intermediate certificate is public, not a secret.

## Cut a release

1. Increase `CFBundleShortVersionString` and numeric `CFBundleVersion` in
   `Support/CapsuleApp/Info.plist`. Both must move forward. The next version
   after 0.2.1/build 3 might be 0.2.2/build 4.
2. Write that version's section in CHANGELOG.md; it supplies the GitHub and
   in-app release notes.
3. Run focused test targets sequentially with `taskpolicy -b swift test
   --filter <target>`, `scripts/test-scripts.sh`, and
   `python3 -m unittest discover -s scripts/release -p 'test_*.py'`.
4. Commit, push main, and verify its Check workflow.
5. Run `scripts/tag-release.sh`, then push the printed tag.

The Release workflow checks the tag/version/main ancestry and increasing build,
runs all test targets, builds, signs nested helpers, notarizes, staples and
checks Gatekeeper. It produces a DMG, ZIP, SHA256SUMS and signed appcast.xml.
It creates a draft, uploads the complete set, publishes the release, then
updates Pages and deploys the landing page. Nothing is published if an earlier check fails. The feed is
published only after its downloads are public. Never move a published tag.

DMG installation is drag-and-drop into Applications. No administrator installer
or Developer ID Installer certificate is required for this distribution format.

## The landing page

`apps/landing` is the static site at <https://capsule.potion.sh>, built with
Astro from the screenshots in `docs/images` and the version in Info.plist.
`mise run landing:dev` serves it locally and `mise run landing:check`
type-checks, builds, tests and audits it, as the Landing workflow does.

Automatic deploys follow a published release: the Release workflow's last job
calls `landing-deploy.yml`, which checks out the latest stable release tag,
confirms it is on `main`, checks the page, builds it with Vercel's CLI and
uploads the result. Run "Deploy landing page" by hand to redeploy the latest
release. For website-only updates, run it from main with `deploy_main: true`:

```sh
gh workflow run landing-deploy.yml --ref main -f deploy_main=true
```

This checks and deploys the exact main commit through the same `landing`
environment, without changing the app version or creating a release tag.
Vercel's Git integration is off in `apps/landing/vercel.json`, so
pushes and pull requests never deploy and Vercel never builds code itself.
The CLI comes from `.github/vercel`, locked and without install scripts.

One-time setup:

1. In Vercel, create a project named `capsule` without connecting a Git
   repository, and leave its Root Directory and build settings empty;
   `apps/landing/vercel.json` supplies them.
2. Add the domain `capsule.potion.sh` to the project and point a `CNAME` for
   `capsule` at the target Vercel shows.
3. Create a token at <https://vercel.com/account/tokens> scoped to the `capsule`
   project, with No Expiration. Read the org and project IDs from
   the project's settings.
4. Create the environment and its secrets:

   ```sh
   gh api -X PUT repos/antick/capsule/environments/landing \
     -F 'deployment_branch_policy[protected_branches]=false' \
     -F 'deployment_branch_policy[custom_branch_policies]=true'
   gh api -X POST repos/antick/capsule/environments/landing/deployment-branch-policies -f name=main -f type=branch
   gh api -X POST repos/antick/capsule/environments/landing/deployment-branch-policies -f name='v*' -f type=tag
   gh secret set VERCEL_TOKEN --env landing
   gh secret set VERCEL_ORG_ID --env landing
   gh secret set VERCEL_PROJECT_ID --env landing
   ```

`gh secret set` prompts for each value, so none lands in shell history.
A landing failure never affects the app release, which is public by then;
fix the page and run "Deploy landing page" again.

## Local release rehearsal

Save a validated notarytool profile named `capsule-notary` in Keychain using
Apple's `notarytool store-credentials` command. Existing API credentials can be
used; the setup does not need a new Apple login.

```sh
NOTARY_PROFILE=capsule-notary taskpolicy -b scripts/package-macos.sh
scripts/release/appcast.sh
```

The app is `.build/bundles/production/Capsule.app`; public files are under
`.build/release-artifacts`. `CAPSULE_SIGN_IDENTITY` can select an explicit
Developer ID certificate hash. `NOTARY_KEYCHAIN` optionally selects a custom
Keychain. `SPARKLE_KEY_FILE` optionally selects a protected Sparkle key file;
otherwise account `capsule` in login Keychain is used.

Verify the downloaded ZIP and DMG, not just the build output. Test an older,
signed/notarized app against a separate feed offering the new signed archive.
Use normal HOME and Keychain so provider access resembles the real installed
app. Verify the app restarts into the newer version and retains settings.
`scripts/release/prepare-upgrade-test.sh` creates a signed/notarized older copy
under `.build/upgrade-test` and a separate localhost feed. Serve its `site`
directory on port 18763, open that copy, and perform the update in Settings.
The resulting app is the unchanged production ZIP. Stop the local server after
the test. `scripts/release/test-signatures.sh` also proves that Sparkle rejects
a modified archive with its original signature.

## Updates and recovery

Capsule checks on launch after 15 seconds and daily when enabled. Downloads
only start on request unless background downloads are enabled. Once prepared,
the update installs on explicit restart or when Capsule quits. The feed and
archive are signed; system profiling is disabled. Requests still expose normal
network metadata to GitHub; provider credentials and readings are never sent.

For a faulty release, publish the previous release's already signed appcast.xml
as a new Pages deployment. Do not edit it after signing. Existing installations
are not downgraded: ship a higher version/build containing the fix. If Pages
fails after the GitHub release publishes, rerun only the failed feed job; do
not recreate or replace the release assets. For lost signing keys follow
Sparkle's documented key rotation, changing only one signing identity at a
time. With verification before extraction, rotating the Sparkle key requires
a Developer ID signed DMG update as described in Sparkle's documentation.

Sparkle 2.10.0 was published 2026-09-13 and satisfies the repository's seven-day
minimum age. It is exact-pinned in Package.swift and Package.resolved. Action
versions are pinned to immutable commits; the runner's supported Xcode 26.6
version is explicit. Update these pins deliberately and rerun release checks.
Dependabot proposes action and landing page updates weekly, each at least 7
days old.
