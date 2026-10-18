# Native release verification — 0.2.0, build 2

Local verification on 2026-10-18, Apple silicon, Xcode 27.1:

- All eight Swift test targets passed, run one at a time: Core, Usage, HUD,
  Activity, System, Dock, Shell and Snapshot. Snapshots cover every dock/card
  state and settings page; the native Updates screen was also inspected.
- Release script tests, feed metadata tests and Sparkle signature tests passed.
- Both the app and DMG were accepted by Apple's notary service, stapled, and
  accepted by Gatekeeper as Notarized Developer ID. The ZIP was extracted and
  its app independently verified. All six Mach-O binaries are arm64 only.
- A separate older Developer ID signed/notarized app (0.1.99, build 1) used a
  separately signed localhost feed offering the production ZIP.
- Changing one byte of that ZIP caused the installed updater to report:
  “The update is improperly signed and could not be validated.” No replacement
  occurred. Restoring the original ZIP allowed the same app to retry.
- Download reached Ready; Restart and install replaced the app with 0.2.0,
  build 2 and relaunched it. The JSON settings before and after were identical.
- Claude, Codex, Grok and Cursor usage remained visible after launch/upgrade.
- Capsule Dev ran alongside Capsule with com.antick.capsule.dev, a blue icon
  and a separate Application Support directory. Update checks and downloads
  were disabled in its Settings screen. Production settings stayed unchanged.

These are local artifact and real-app checks. Hosted workflow results, public
feed availability, and installation from the final GitHub download are separate
release gates; do not infer those from a successful local build.
