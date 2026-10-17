## Purpose

Delta against `../../../init-capsule-desktop/specs/usage-dock/spec.md`. The
dock's layout, interaction, severity, and state behavior are unchanged. What
changes is that the silhouette is now a real window surface rather than
painted pixels, and that content drawn into layers has to declare its own
accessibility.

## MODIFIED Requirements

### Requirement: Card and rail share one connected surface
The system SHALL draw the rail, the tail, and the open card as one continuous
surface with no seam and no detached tooltip, and that surface SHALL be the
window's own material rather than a filled region inside a transparent window.

#### Scenario: Card open on the right edge
- **GIVEN** the rail is on the right edge
- **WHEN** the Claude card is open
- **THEN** rail, tail, and card read as one shape
- **AND** no gap or seam appears at the join

#### Scenario: Card closed
- **GIVEN** no card is open
- **WHEN** the user looks at the dock
- **THEN** only the rail silhouette is drawn

### Requirement: Default three-meter right-edge HUD matches the reference
The system SHALL match `../../../init-capsule-desktop/references/hud-reference.jpg`
for the default right-edge, three-meter, Claude-card-open state, and SHALL be
checked against it by a rendered snapshot rather than by eye alone.

#### Scenario: Reference comparison
- **GIVEN** demo data, right-edge placement, and the Claude card open
- **WHEN** the dock is rendered to a snapshot
- **THEN** meter order, ring thickness, card geometry, and type match the reference

#### Scenario: Snapshot coverage
- **GIVEN** the snapshot suite
- **WHEN** it runs
- **THEN** it covers every dock style, every edge, both themes, and the card open and closed

## ADDED Requirements

### Requirement: The dock surface draws system vibrancy behind its silhouette
The system SHALL render the dock's surface as a system material clipped to the
dock's silhouette, so the desktop and windows behind it tint the dock.

#### Scenario: Over a light window
- **GIVEN** a white document window sits behind the dock
- **WHEN** the user looks at the dock
- **THEN** the dock surface picks up that lightness while meters stay legible

#### Scenario: Over a dark desktop
- **GIVEN** a dark wallpaper sits behind the dock
- **WHEN** the user looks at the dock
- **THEN** the dock surface reads dark while meters stay legible

#### Scenario: Vibrancy is clipped to the shape
- **GIVEN** the dock is in Capsule style, floating clear of the screen edge
- **WHEN** the user looks at the gap between the dock and the edge
- **THEN** no material is drawn in the gap

#### Scenario: Reduced transparency
- **GIVEN** the user has turned on Reduce Transparency in Accessibility settings
- **WHEN** the user looks at the dock
- **THEN** the dock surface is opaque
- **AND** meters and card text stay legible

### Requirement: Dock content is reachable by assistive technology
The system SHALL expose each meter, each card, and each card action as an
accessibility element with a role, a label, and its current value, because
layer-drawn content supplies none by default.

#### Scenario: VoiceOver over a meter
- **GIVEN** VoiceOver is running
- **WHEN** the user moves the VoiceOver cursor onto a meter
- **THEN** the provider name and current percent are announced

#### Scenario: VoiceOver over an unauthenticated meter
- **GIVEN** a provider has no credentials
- **WHEN** the user moves the VoiceOver cursor onto its meter
- **THEN** it is announced as not connected
- **AND** no percent is announced

#### Scenario: VoiceOver over a stale meter
- **GIVEN** a provider's last fetch failed and its meter shows the last known percent
- **WHEN** the user moves the VoiceOver cursor onto it
- **THEN** the last known percent is announced as stale

#### Scenario: Assistive technology reaches the dock at all
- **GIVEN** the dock is a non-activating panel that never takes key focus
- **WHEN** the user navigates to Capsule with VoiceOver
- **THEN** the dock's elements are reachable
