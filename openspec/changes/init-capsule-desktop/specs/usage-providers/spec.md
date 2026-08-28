## Purpose

Usage providers supply Capsule with live quota snapshots for each AI product: primary percent for the ring, labeled buckets for the card, reset times, and auth/error status. Capsule does not invent usage; it adapts existing local credentials and official usage windows.

## ADDED Requirements

### Requirement: Provider snapshot has a primary percent and named buckets
The system SHALL represent each provider as a snapshot with a provider identity, a primary percent used for the meter, an ordered list of buckets (each with label, percent used, and reset time), and a status of ok, unauthenticated, error, or unavailable.

#### Scenario: Claude snapshot shape
- **GIVEN** a successful Claude fetch
- **WHEN** the snapshot is produced
- **THEN** it includes provider identity `claude`
- **AND** a primary percent equal to the current-session bucket
- **AND** a `Current session` bucket
- **AND** an `All models` bucket

### Requirement: Claude reports current session and all-models windows
The Claude provider SHALL map the subscription five-hour window to `Current session` and the seven-day all-models window to `All models`.

#### Scenario: Claude five-hour and seven-day
- **GIVEN** Claude usage reports five-hour utilization 73% resetting in 51 minutes
- **AND** seven-day utilization 7% resetting Thursday 12:00 AM local time
- **WHEN** the snapshot is produced
- **THEN** `Current session` is 73% with that relative reset
- **AND** `All models` is 7% with that absolute reset

#### Scenario: Claude extra buckets are not shown on the card
- **GIVEN** Claude also reports a model-scoped weekly window
- **WHEN** the Claude card is rendered
- **THEN** only `Current session` and `All models` appear on the card

### Requirement: ChatGPT reports its primary and secondary windows
The ChatGPT provider SHALL map its primary quota window and secondary quota window onto two card buckets with the provider's own labels.

#### Scenario: ChatGPT windows present
- **GIVEN** ChatGPT credentials are valid
- **AND** the provider returns a primary window at 21% and a secondary window
- **WHEN** the snapshot is produced
- **THEN** the meter primary percent is the primary window
- **AND** the card shows two buckets using ChatGPT's labels, not Claude's

### Requirement: Third provider slot is a real adapter
The system SHALL include a third provider identity that implements the same snapshot contract as Claude and ChatGPT, so the default three-meter HUD can be filled without a one-off UI fork.

#### Scenario: Third provider enabled
- **GIVEN** the third provider is enabled and returns 52% primary usage
- **WHEN** the rail is shown
- **THEN** the third meter shows 52% using the same meter and card components as Claude and ChatGPT

### Requirement: Demo provider supplies reference data without credentials
The system SHALL provide a demo provider that returns the reference screenshot values so the HUD can be developed and visually accepted without live accounts.

#### Scenario: Demo data
- **GIVEN** demo mode is on
- **WHEN** snapshots are requested
- **THEN** Claude is 73% session / 7% all-models, ChatGPT is 21%, and the third provider is 52%
- **AND** Claude session reset copy can render as `Resets in 51 min` and all-models as `Resets Thu 12:00 AM` for the pinned demo clock

### Requirement: Existing local credentials are reused
The system SHALL authenticate Claude and ChatGPT from credentials already present on the machine (Claude Code / Anthropic OAuth, ChatGPT or Codex local auth) rather than requiring the user to paste API keys into Capsule as the default path.

#### Scenario: Claude Code already signed in
- **GIVEN** a valid Claude Code or Anthropic OAuth token exists locally
- **WHEN** Capsule fetches Claude usage
- **THEN** the fetch succeeds without a Capsule-specific login prompt

#### Scenario: No local ChatGPT credentials
- **GIVEN** ChatGPT is enabled
- **AND** no local ChatGPT/Codex credentials exist
- **WHEN** Capsule fetches ChatGPT usage
- **THEN** the snapshot status is unauthenticated
- **AND** settings show that ChatGPT is not connected

### Requirement: Tokens never leave the privileged process
The system SHALL keep raw access tokens out of the HUD renderer; the renderer MUST receive only usage snapshots and connection status.

#### Scenario: Renderer payload
- **GIVEN** a successful Claude fetch
- **WHEN** the HUD receives an update
- **THEN** the payload contains percents, labels, reset times, and status
- **AND** it does not contain access tokens or refresh tokens

### Requirement: Unauthenticated is not reported as zero percent
The system SHALL set snapshot status to unauthenticated when credentials are missing or rejected, and MUST NOT present that state as 0% used.

#### Scenario: Missing Claude credentials
- **GIVEN** Claude is enabled and no credentials exist
- **WHEN** a snapshot is produced
- **THEN** status is unauthenticated
- **AND** primary percent is omitted rather than 0

### Requirement: Failed fetch keeps the last good snapshot
The system SHALL retain the last successful snapshot when a later fetch errors, and SHALL flag the snapshot as stale/error.

#### Scenario: Network failure
- **GIVEN** Claude last succeeded at 73%
- **WHEN** the next fetch fails because the network is down
- **THEN** consumers still see 73%
- **AND** status is error or stale

### Requirement: Percents are clamped
The system SHALL clamp each bucket percent to the inclusive range 0–100 before any HUD consumer sees it.

#### Scenario: Provider reports 112
- **GIVEN** a provider returns utilization 112
- **WHEN** the snapshot is produced
- **THEN** the percent used is 100

#### Scenario: Provider reports a negative
- **GIVEN** a provider returns utilization -4
- **WHEN** the snapshot is produced
- **THEN** the percent used is 0

### Requirement: Relative reset copy uses the shared formatter
The system SHALL format a reset that is less than 24 hours away as `Resets in {n} min` when under one hour, and as `Resets in {h}h {m} min` when one hour or more, using the shared date utility (no inline formatting).

#### Scenario: Fifty-one minutes remaining
- **GIVEN** a bucket resets in 51 minutes
- **WHEN** reset copy is formatted for a relative bucket
- **THEN** the string is `Resets in 51 min`

#### Scenario: Two hours ten minutes remaining
- **GIVEN** a bucket resets in 2 hours and 10 minutes
- **WHEN** reset copy is formatted for a relative bucket
- **THEN** the string is `Resets in 2h 10 min`

### Requirement: Absolute reset copy uses the shared formatter
The system SHALL format a reset 24 hours or more away as `Resets {weekday} {time}` where time is 12-hour local time with minutes and AM/PM, using the shared date utility.

#### Scenario: Thursday midnight
- **GIVEN** a bucket resets Thursday at 12:00 AM in the user's locale
- **WHEN** reset copy is formatted for an absolute bucket
- **THEN** the string is `Resets Thu 12:00 AM`

### Requirement: Snapshots refresh on an interval
The system SHALL refresh enabled providers on the configured polling interval and immediately after Capsule starts, the machine wakes from sleep, or network connectivity returns.

#### Scenario: Interval poll
- **GIVEN** the polling interval is 60 seconds
- **WHEN** 60 seconds pass after the last successful poll
- **THEN** enabled providers are fetched again

#### Scenario: Wake from sleep
- **GIVEN** the machine was asleep
- **WHEN** it wakes
- **THEN** enabled providers are fetched without waiting for the next interval

### Requirement: Users can enable and disable providers
The system SHALL fetch and show only providers the user has enabled, and SHALL persist that set.

#### Scenario: Disable ChatGPT
- **GIVEN** Claude, ChatGPT, and the third provider are enabled
- **WHEN** the user disables ChatGPT
- **THEN** ChatGPT is not fetched
- **AND** the rail shows two meters
- **AND** the preference survives relaunch
