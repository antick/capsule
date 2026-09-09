# Releases and self-update

Capsule ships as a versioned macOS build and can install its own updates. The
settings window was rebuilt around that addition, and now follows the system
appearance in light and dark.

## Releasing

The version in `apps/desktop/package.json` is the single source of truth.
`pnpm release:tag` derives `vX.Y.Z` from it, refusing to tag a dirty tree, a
branch other than main, or a version already tagged. Pushing that tag runs the
Release workflow: checks, typecheck, tests, then electron-builder produces
arm64 and x64 DMGs and zips and publishes them to GitHub Releases along with
the `latest-mac.yml` feed the updater reads.

Code signing is optional and configured entirely through repository secrets. A
release built without them is unsigned; the app then reports that it cannot
replace itself and offers the release page instead of a download. No claim is
made that an unsigned build will pass Gatekeeper without the user's own
override.

## Updating

The main process owns one update state — a phase, the running and offered
versions, plain-text release notes, download progress, and the last check —
and pushes it to every window whenever it moves. The renderer never talks to
the updater directly and never decides what phase it is in.

A check runs 15 seconds after launch and once a day, both only while automatic
checking is on. A found release is downloaded on request, or straight away if
background downloading is on; either way installing is a restart. A check that
cannot reach the feed within thirty seconds is reported as a failure rather
than left showing "Checking".

A build that cannot swap itself — a development run, or one macOS will not
accept — is a distinct phase, not an error, because retrying it cannot help.
Release notes arrive from GitHub as HTML and are reduced to text rather than
rendered, so a release body cannot introduce markup into the app.

## Settings

The window follows macOS rather than carrying its own light/dark switch; the
dock keeps its separate theme setting. Both palettes are declared once, under
one set of token names, so no component chooses a colour per theme. The
sidebar is left unpainted for the macOS sidebar material and carries the
running version and the live update standing.

Appearance splits into Dock style, Theme, Dock size, Placement, and Behaviour;
General splits into Usage readings and System. Selectable options — themes,
dock styles, placements — share one card component so a chosen option looks
the same everywhere. Usage percentages in the settings list use theme-aware
tones; the dock's own severity colours are drawn for its black surface and are
unchanged.

## Verification

- Unit tests cover release URLs, phase tones and wording, byte and progress
  formatting, release-note flattening and truncation, the initial state for a
  build that cannot install, and the classification of update errors into
  transient failures versus builds that will never update themselves.
- The settings window was checked at its real size in both appearances against
  the built renderer, and the packaged app was built, launched, and captured to
  confirm the sidebar material, the layout, and a live update check reaching
  GitHub and reporting its failure.
- Not verified: installing a real update. That needs a signed, published
  release, which does not exist until the first tag is pushed.
