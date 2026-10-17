## Purpose

Delta against `../../../init-capsule-desktop/specs/desktop-shell/spec.md`.
Every requirement in that baseline holds through this migration except the four
restated below, where moving from an Electron overlay window to an AppKit
non-activating panel changes behavior the user can observe.

## MODIFIED Requirements

### Requirement: Pointer events pass through transparent pixels
The system SHALL decide pass-through from the same silhouette geometry it draws
in the same frame, so that a point outside the drawn dock always reaches the
window behind it and a point inside the drawn dock always reaches Capsule.

Previously the renderer reported its opaque regions to the window owner, which
polled the cursor against the last report; the two could disagree for a frame
near a moving edge. The native panel hit-tests the live path, so the answer
cannot lag the drawing.

#### Scenario: Click beside the rail
- **GIVEN** the rail is on the right edge and the card is closed
- **WHEN** the user clicks a window visible to the left of the rail
- **THEN** that window receives the click
- **AND** Capsule does not steal focus

#### Scenario: Click the rail
- **GIVEN** the rail is visible
- **WHEN** the user clicks a meter
- **THEN** Capsule handles the click

#### Scenario: Click during the unroll animation
- **GIVEN** an auto-hiding dock is part way through unrolling
- **WHEN** the user clicks a point that the dock covers at that instant
- **THEN** Capsule receives the click
- **AND** a click just outside the dock's current outline reaches the window behind it

#### Scenario: Click inside the concave fillet
- **GIVEN** the dock is in Rail style, whose ends curve away from the screen edge
- **WHEN** the user clicks inside the curve, where no dock is drawn
- **THEN** the window behind Capsule receives the click

### Requirement: Hovering or clicking the HUD does not steal keyboard focus
The system SHALL never take key-window focus through the dock, whether the
pointer hovers it, clicks it, pins a card, or drags the dock to a new edge.

Previously this was stated for hover only. A non-activating panel cannot become
the key window by being clicked, so the guarantee now covers every pointer
interaction with the dock.

#### Scenario: Typing in another app while hovering
- **GIVEN** the user is typing in a terminal
- **WHEN** the pointer hovers a meter and the detail card opens
- **THEN** the terminal keeps keyboard focus

#### Scenario: Typing in another app while pinning
- **GIVEN** the user is typing in a terminal
- **WHEN** the user clicks a meter to pin its card
- **THEN** the terminal keeps keyboard focus
- **AND** the card stays pinned

#### Scenario: Dragging the dock
- **GIVEN** the user is typing in a terminal
- **WHEN** the user drags the dock to another screen edge
- **THEN** the terminal keeps keyboard focus

### Requirement: Launch at login is user-controlled
The system SHALL register and unregister Capsule as a login item through the
system's own login-item service, so the setting agrees with System Settings in
both directions.

Previously the login item was managed by the app framework's own helper. The
observable change is that Capsule appears under its own name in System
Settings → General → Login Items, and a change made there is reflected in
Capsule's settings.

#### Scenario: Enable login item
- **GIVEN** launch at login is off
- **WHEN** the user turns it on in Settings
- **THEN** Capsule is listed as a login item in System Settings
- **AND** Capsule starts on next login

#### Scenario: Disable login item
- **GIVEN** launch at login is on
- **WHEN** the user turns it off in Settings
- **THEN** Capsule is no longer listed as a login item

#### Scenario: Disabled outside Capsule
- **GIVEN** launch at login is on
- **WHEN** the user removes Capsule from Login Items in System Settings
- **THEN** Capsule's own setting shows launch at login as off

### Requirement: Settings persist across launches
The system SHALL persist settings in the native application's own store, and
SHALL adopt a previous Electron-era settings file once, as specified by
`../native-shell/spec.md`.

#### Scenario: Relaunch restores settings
- **GIVEN** the user set the left edge, Capsule style, and a 2-minute refresh
- **WHEN** Capsule is quit and relaunched
- **THEN** all three settings are as the user left them

#### Scenario: Relaunch after an upgrade from the Electron build
- **GIVEN** the user's settings were written by the previous Electron build
- **WHEN** the native build launches and is then relaunched
- **THEN** the settings are as the user left them in the previous build
