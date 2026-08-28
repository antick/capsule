## Purpose

Screen placement is how Capsule sits in leftover macOS chrome: display edges, empty Dock flanks, and unused Stage Manager strip space. The rail must stay in those gutters as displays, Dock, and Stage Manager change.

## ADDED Requirements

### Requirement: Default placement is the right display edge
The system SHALL place the rail on the right edge of the current display on first launch.

#### Scenario: First launch
- **GIVEN** the user has never chosen a placement
- **WHEN** Capsule starts
- **THEN** the rail is flush with the right edge of the display that contains the menu bar of the current space

### Requirement: Left-edge placement
The system SHALL place the rail flush with the left display edge when the user selects left-edge placement.

#### Scenario: User selects left edge
- **GIVEN** the rail is on the right edge
- **WHEN** the user selects left-edge placement
- **THEN** the rail moves flush to the left edge
- **AND** meters remain stacked vertically
- **AND** an open detail card grows to the right of the rail

### Requirement: Dock-adjacent placement uses empty Dock flanks
The system SHALL place a horizontal rail in the empty space to the left or the right of the macOS Dock when the user selects Dock-adjacent placement, without covering Dock icons.

#### Scenario: Bottom Dock with empty right flank
- **GIVEN** the macOS Dock is on the bottom and centered
- **AND** there is unused space to the right of the Dock icons
- **WHEN** the user selects Dock-adjacent, right flank
- **THEN** the rail sits in that right-hand empty region above the Dock
- **AND** it does not overlap Dock icons or the menu bar

#### Scenario: Bottom Dock with empty left flank
- **GIVEN** the macOS Dock is on the bottom and centered
- **WHEN** the user selects Dock-adjacent, left flank
- **THEN** the rail sits in the left-hand empty region above the Dock

#### Scenario: Dock on the left or right side of the screen
- **GIVEN** the macOS Dock is oriented vertically on the left or right
- **WHEN** the user selects Dock-adjacent placement
- **THEN** the rail sits in leftover space along that same edge
- **AND** it does not overlap Dock icons

### Requirement: Stage Manager gutter placement uses leftover strip space
The system SHALL place the rail in the unused space above or below Stage Manager's left-side window thumbnails when the user selects Stage Manager gutter placement.

#### Scenario: Stage Manager on, bottom gutter
- **GIVEN** Stage Manager is enabled
- **AND** window thumbnails occupy the middle of the left strip
- **WHEN** the user selects Stage Manager gutter, bottom
- **THEN** the rail sits in the empty region below those thumbnails inside the left strip
- **AND** it does not cover the thumbnails or the current stage window

#### Scenario: Stage Manager on, top gutter
- **GIVEN** Stage Manager is enabled
- **WHEN** the user selects Stage Manager gutter, top
- **THEN** the rail sits in the empty region above the thumbnails inside the left strip

### Requirement: Stage Manager placement falls back when Stage Manager is off
The system SHALL move the rail to the left display edge when Stage Manager gutter placement is selected but Stage Manager is not enabled, and SHALL restore the gutter position when Stage Manager is turned back on.

#### Scenario: User disables Stage Manager
- **GIVEN** the rail is in the Stage Manager bottom gutter
- **WHEN** Stage Manager is turned off
- **THEN** the rail moves to the left display edge
- **AND** the user's stored preference remains Stage Manager gutter

#### Scenario: User re-enables Stage Manager
- **GIVEN** the stored preference is Stage Manager gutter
- **AND** the rail is on the left edge because Stage Manager was off
- **WHEN** Stage Manager is turned on
- **THEN** the rail returns to the chosen Stage Manager gutter

### Requirement: Dock autohide still keeps Dock-adjacent rails in the flank
The system SHALL keep a Dock-adjacent rail in the same flank when the Dock is set to autohide, using the Dock's revealed size as the reserved strip so the rail does not sit under where the Dock will appear.

#### Scenario: Autohide Dock
- **GIVEN** Dock-adjacent right-flank placement
- **AND** the Dock autohides
- **WHEN** the Dock is hidden
- **THEN** the rail remains in the right-flank region and leaves room for the Dock to reveal without covering the rail

### Requirement: Placement is recomputed on display and chrome changes
The system SHALL recompute rail position when the display arrangement, resolution, or scale changes, when the Dock orientation/size/autohide changes, or when Stage Manager is toggled.

#### Scenario: Display resolution change
- **GIVEN** the rail is on the right edge
- **WHEN** the display resolution or scaling changes
- **THEN** the rail stays flush to the right edge of the same display without sitting off-screen

#### Scenario: External display unplugged
- **GIVEN** the rail is on an external display
- **WHEN** that display is disconnected
- **THEN** the rail moves to the right edge of the remaining built-in display

### Requirement: Rail stays in the visible work area
The system SHALL keep the rail and an open detail card inside the visible work area of the target display (not under the menu bar, and not off-screen).

#### Scenario: Expanded card on a short display
- **GIVEN** the rail is near the top of the right edge
- **AND** opening the card would overflow the top of the work area
- **WHEN** the card opens
- **THEN** the card is shifted down so it remains fully visible
- **AND** the join still points at the active meter

### Requirement: Chosen placement is persisted
The system SHALL persist the user's placement preset (including flank or gutter variant) and restore it on the next launch.

#### Scenario: Relaunch
- **GIVEN** the user selected Dock-adjacent, left flank
- **WHEN** Capsule quits and starts again
- **THEN** the rail is restored to Dock-adjacent, left flank

### Requirement: User can change placement from settings
The system SHALL expose the placement presets in settings and apply a newly selected preset immediately without requiring a restart.

#### Scenario: Switch from right edge to Dock-adjacent
- **GIVEN** the HUD is visible on the right edge
- **WHEN** the user picks Dock-adjacent, right flank in settings
- **THEN** the HUD moves to that flank immediately
