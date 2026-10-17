## Purpose

The native shell is Capsule the AppKit application: how it runs as a single
process, how a ported reader earns the right to replace its TypeScript
original, how a user's existing settings survive the change of host, and how
updates reach an installed copy once Sparkle replaces `electron-updater`.

Baseline for the unchanged behavior this capability sits beside:
`../../../init-capsule-desktop/specs/desktop-shell/spec.md`.

## ADDED Requirements

### Requirement: Capsule runs as a single application process
The system SHALL run the dock, settings, and all readers inside one
application process, with no embedded browser engine and no bundled
JavaScript runtime.

#### Scenario: Inspecting the running app
- **GIVEN** Capsule is running with the dock visible
- **WHEN** the user lists Capsule's processes in Activity Monitor
- **THEN** exactly one Capsule process is present
- **AND** no helper, renderer, or GPU process belongs to it

#### Scenario: Inspecting the installed bundle
- **GIVEN** the Capsule application bundle
- **WHEN** its contents are examined
- **THEN** it contains no Node, Chromium, or Electron framework

### Requirement: A ported reader matches its extracted fixtures exactly
The system SHALL accept a Swift reader as a replacement for its TypeScript
original only when the Swift reader produces, for every extracted fixture
input, output identical to the fixture's recorded output.

#### Scenario: Parity holds
- **GIVEN** the fixture corpus for a provider's usage mapping
- **WHEN** the Swift reader runs every input in that corpus
- **THEN** every output equals the recorded output
- **AND** the reader may replace the TypeScript original

#### Scenario: Parity fails on one input
- **GIVEN** the same corpus
- **WHEN** the Swift reader differs on a single input
- **THEN** the parity check fails and names that fixture
- **AND** the TypeScript original remains the shipping implementation

#### Scenario: Corpus has grown since the port
- **GIVEN** a fixture was added for a newly discovered provider response shape
- **WHEN** the parity check runs
- **THEN** the new fixture is included
- **AND** a Swift reader that does not handle it fails the check

### Requirement: Both implementations run the same fixture corpus
The system SHALL hold extracted fixtures in a single language-neutral location
consumed by both the TypeScript and the Swift test suites.

#### Scenario: Fixture corrected once
- **GIVEN** a provider changed its response shape and the fixture is updated
- **WHEN** both suites run
- **THEN** both read the updated fixture
- **AND** neither suite carries its own copy of that data

### Requirement: Existing settings carry over on first native launch
The system SHALL migrate a schema v7 settings file written by the previous
Electron build into the native store once, and SHALL record that the migration
happened so it does not repeat.

#### Scenario: Upgrading user with saved settings
- **GIVEN** the previous build stored the dock on the left edge, Tray style, dark theme, and auto-hide off
- **WHEN** the native app launches for the first time
- **THEN** the dock appears on the left edge in Tray style and dark theme with auto-hide off
- **AND** onboarding is not shown

#### Scenario: Second launch
- **GIVEN** settings were already migrated
- **WHEN** the native app launches again
- **THEN** it reads its own store
- **AND** does not read the Electron settings file

#### Scenario: Settings changed after migration
- **GIVEN** settings were migrated and the user then moved the dock to the right edge
- **WHEN** the app relaunches
- **THEN** the dock is on the right edge
- **AND** the migrated left-edge value does not return

### Requirement: Unusable prior settings fall back to defaults
The system SHALL fall back to default settings and show onboarding when the
prior settings file is absent, unparseable, or of a schema older than v7,
rather than inferring values from it.

#### Scenario: No prior install
- **GIVEN** no Capsule settings file exists
- **WHEN** the native app launches
- **THEN** default settings apply
- **AND** onboarding is shown

#### Scenario: Corrupt file
- **GIVEN** the settings file contains truncated JSON
- **WHEN** the native app launches
- **THEN** default settings apply
- **AND** onboarding is shown
- **AND** the app does not fail to launch

#### Scenario: Pre-v7 schema
- **GIVEN** the settings file declares schema version 5
- **WHEN** the native app launches
- **THEN** default settings apply rather than a partial migration

### Requirement: Updates are delivered over a signed appcast feed
The system SHALL check for, download, and install updates through a Sparkle
appcast whose entries are signed with Capsule's EdDSA key, and SHALL refuse an
entry whose signature does not verify.

#### Scenario: A newer release is published
- **GIVEN** the appcast advertises a signed version newer than the installed one
- **WHEN** Capsule checks for updates
- **THEN** Settings → Updates reports that version as available with its release notes

#### Scenario: Signature does not verify
- **GIVEN** the appcast advertises a version whose signature fails to verify
- **WHEN** Capsule checks for updates
- **THEN** the update is not offered or installed
- **AND** Settings → Updates reports the check as failed

#### Scenario: Feed unreachable
- **GIVEN** the appcast cannot be fetched
- **WHEN** Capsule checks for updates
- **THEN** Settings → Updates reports the check as failed
- **AND** the dock keeps showing usage

#### Scenario: Already current
- **GIVEN** the appcast advertises no version newer than the installed one
- **WHEN** the user checks for updates from Settings
- **THEN** Settings → Updates reports that Capsule is up to date

### Requirement: The existing update preferences keep their meaning
The system SHALL keep `autoUpdateCheck` governing whether Capsule looks for
updates on its own, and `autoUpdateDownload` governing whether a found update
is fetched without being asked for.

#### Scenario: Automatic checking off
- **GIVEN** the user turned automatic update checks off
- **WHEN** Capsule launches
- **THEN** no update check is made until the user asks for one

#### Scenario: Automatic download off
- **GIVEN** automatic checks are on and automatic download is off
- **WHEN** a newer version is found
- **THEN** it is reported as available and not downloaded until the user asks

### Requirement: The update signing key stays outside the repository
The system SHALL hold the Sparkle private signing key only in release
credentials, never in the repository or in a built artifact.

#### Scenario: Auditing the tree
- **GIVEN** the repository at any commit
- **WHEN** it is searched for the signing key
- **THEN** the private key is absent
- **AND** only the public key appears, in the application's `Info.plist`
