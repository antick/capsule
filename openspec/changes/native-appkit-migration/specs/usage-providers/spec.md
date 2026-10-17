## Purpose

Delta against `../../../init-capsule-desktop/specs/usage-providers/spec.md`.
What each provider reports, how credentials are reused, how failures degrade,
and how reset copy is formatted are all unchanged — that invariance is the
point of the migration, and it is enforced by the fixture gate in
`../native-shell/spec.md`. Only the hosting of the readers changes.

## MODIFIED Requirements

### Requirement: Tokens never leave the process that reads them
The system SHALL keep provider credentials inside the application process and
SHALL never place them in the snapshots the dock's drawing and settings code
receive.

Previously this was stated as keeping tokens out of the renderer, since the
renderer was a separate process that could not be trusted with them. There is
now one process, so the boundary is internal: credentials are read, used for a
request, and discarded without entering the types the UI sees.

#### Scenario: Snapshot contents
- **GIVEN** a provider has authenticated and returned usage
- **WHEN** the dock renders that provider's meter and card
- **THEN** the snapshot it drew from contains percents, labels, and reset times
- **AND** contains no token, header, or credential path

#### Scenario: No credential leaves the app
- **GIVEN** Capsule is reading usage for every enabled provider
- **WHEN** the app's outbound requests are examined
- **THEN** credentials appear only in requests to that provider's own usage service

#### Scenario: Diagnostics
- **GIVEN** a provider request fails with an authentication error
- **WHEN** the failure is recorded or surfaced in Settings
- **THEN** the record names the provider and the failure
- **AND** contains no token

## ADDED Requirements

### Requirement: Providers are read without a helper process or interpreter
The system SHALL read usage and local activity using only the application
process and the operating system's own networking and file APIs, without
spawning a helper, a script runtime, or a bundled interpreter.

#### Scenario: Refresh while watching processes
- **GIVEN** Capsule is running with every provider enabled
- **WHEN** a refresh interval elapses and all providers are fetched
- **THEN** no child process is spawned by Capsule

#### Scenario: Manual refresh
- **GIVEN** the user asks a single provider to refresh now
- **WHEN** that fetch runs
- **THEN** no child process is spawned by Capsule

### Requirement: A failing reader cannot stop the others
The system SHALL isolate each provider's read so that a hang, a crash in
parsing, or an unreachable endpoint for one provider leaves the other
providers' meters refreshing normally.

#### Scenario: One endpoint hangs
- **GIVEN** Claude, Codex, and Grok are enabled
- **AND** the Claude usage endpoint stops responding
- **WHEN** the refresh interval elapses twice
- **THEN** Codex and Grok meters show freshly fetched values
- **AND** the Claude meter shows its last known value marked stale

#### Scenario: One response is malformed
- **GIVEN** a provider returns a body that does not parse
- **WHEN** that read completes
- **THEN** that provider's meter is marked unavailable
- **AND** no other provider's meter changes
- **AND** Capsule keeps running

#### Scenario: Local session files are unreadable
- **GIVEN** a provider's local session directory cannot be read
- **WHEN** activity is rescanned
- **THEN** that provider reports no active agents
- **AND** other providers' activity is unaffected
