# Signed native releases

## Approved outcome

Ship Capsule as an Apple silicon macOS 14+ app installed in Applications,
with a signed and notarized DMG and verified in-app updates. Local development
uses Capsule Dev, a distinct bundle, icon, preferences, cache and login item.
Provider session readers remain enabled; agent chat remains suspended.

## Design

- Preserve production identity com.antick.capsule and its Application Support
  directory. Use com.antick.capsule.dev and Capsule Dev for development.
  Unbundled executables default to development. A build channel is independent
  of optimization, so a release-optimized dev build remains safe.
- Pin Sparkle 2.10.0 (released 2026-09-13, more than seven days old). Keep the
  updater's machine-facing integration in CapsuleSystem and expose its state
  to the existing Updates screen. Development never starts Sparkle.
- Use Developer ID Application signing, hardened runtime, timestamped releases,
  Apple notarization, stapled tickets, and Ed25519 signed update archives.
- Publish Apple silicon DMG/ZIP/checksums to GitHub Releases and an HTTPS
  appcast through GitHub Pages. No Intel artifact or legacy updater is shipped.
- Public release creation requires a matching main-branch tag, version/build,
  changelog, green checks, complete credentials and verified artifacts. Publish
  the update feed after release assets, never before. Serialize releases.
- Keys stay in Keychain/protected CI secrets. CI uses a temporary keychain,
  explicitly signs all embedded code, and cleans up credentials even on failure.
- Preserve downloaded update safety through Sparkle; never implement an app
  replacement script. Installation waits for a restart action (or app exit once
  Sparkle has prepared the installation).

## Implementation and acceptance checklist

1. Add channel identity and reusable branding; verify separate stores and bundles.
2. Integrate Sparkle and exercise state transitions, download, restart, failure,
   disabled checks, development isolation and release-note rendering.
3. Package all executable code as arm64; sign from nested helpers outward;
   notarize and verify both app and DMG; ship third-party license notices.
4. Automate credential setup, appcast/checksums, tag validation and publishing.
5. Run test targets sequentially and script tests; inspect both packaged apps.
6. Exercise a signed/notarized A-to-B upgrade on a separate feed and identity,
   prove settings survive, and reject a tampered archive.
7. Commit implementation, publish the authorized first release, install the
   downloaded production app, and verify the public feed and installed app.

## Recovery

Never move a published tag or overwrite a released binary. Stop offering a bad
release by restoring the previous feed; repair it in a higher build/version.
Keep secure backups of Apple and Sparkle private keys. Rotate one signing
identity at a time using Sparkle's documented key rotation procedure.
