## Purpose

The desktop shell is Capsule the application: overlay window, click-through, always-on-top behavior, settings, onboarding, launch-at-login, and persistence. It is how the HUD lives on macOS without acting like a normal document window.

## ADDED Requirements

### Requirement: App identity is Capsule
The system SHALL present the application name as `Capsule` in the macOS menu, About panel, and login-item label.

#### Scenario: About panel
- **GIVEN** Capsule is running
- **WHEN** the user opens About Capsule
- **THEN** the app name shown is `Capsule`

### Requirement: Overlay stays above other app windows
The system SHALL keep the HUD overlay above ordinary application windows on the current space while Capsule is running.

#### Scenario: Switching to another app
- **GIVEN** the HUD is visible
- **WHEN** the user focuses Safari
- **THEN** the HUD remains visible on top of Safari

### Requirement: Overlay does not appear as a Dock app icon
The system SHALL run as a menu-bar / accessory-style app so Capsule does not occupy a regular macOS Dock slot (the HUD is the presence).

#### Scenario: Launch
- **GIVEN** Capsule starts
- **WHEN** the user looks at the macOS Dock
- **THEN** Capsule is not present as a standard bouncing app icon

### Requirement: Overlay is visible across Spaces
The system SHALL show the HUD on every macOS Space of the target display, including when the user switches desktops.

#### Scenario: Space switch
- **GIVEN** the HUD is visible on Space 1
- **WHEN** the user switches to Space 2 on the same display
- **THEN** the HUD is still visible in the same placement

### Requirement: Pointer events pass through transparent pixels
The system SHALL ignore mouse events on fully transparent regions of the overlay so apps behind Capsule remain clickable, and SHALL receive mouse events on the rail and open card.

#### Scenario: Click beside the rail
- **GIVEN** the rail is on the right edge
- **AND** the card is closed
- **WHEN** the user clicks a window that is visible to the left of the rail
- **THEN** that window receives the click
- **AND** Capsule does not steal focus

#### Scenario: Click the rail
- **GIVEN** the rail is visible
- **WHEN** the user clicks a meter
- **THEN** Capsule handles the click (pin/unpin)

### Requirement: Hovering the HUD does not steal keyboard focus
The system SHALL not take key-window focus when the pointer merely hovers the rail or card.

#### Scenario: Typing in another app
- **GIVEN** the user is typing in a terminal
- **WHEN** the pointer hovers a Capsule meter and the detail card opens
- **THEN** the terminal keeps keyboard focus

### Requirement: Overlay hides during native fullscreen
The system SHALL hide the HUD while another app is in native macOS fullscreen on that display, and SHALL show it again when fullscreen exits.

#### Scenario: Enter fullscreen
- **GIVEN** the HUD is visible
- **WHEN** the user puts a video player into native fullscreen on that display
- **THEN** the HUD is hidden for that display

#### Scenario: Exit fullscreen
- **GIVEN** the HUD was hidden for fullscreen
- **WHEN** fullscreen ends
- **THEN** the HUD is shown again in the stored placement

### Requirement: Overlay window grows to fit an open card
The system SHALL resize and reposition the overlay window so the rail stays flush to the chosen edge while the detail card is fully on-screen.

#### Scenario: Card opens on the right edge
- **GIVEN** the collapsed overlay is a thin right-edge strip
- **WHEN** the Claude card opens
- **THEN** the window expands left far enough to contain the card, tail, and shadow
- **AND** the rail remains flush to the right edge

#### Scenario: Card closes
- **GIVEN** the overlay is expanded for a card
- **WHEN** the card closes
- **THEN** the window shrinks back to the collapsed rail bounds

### Requirement: Launch at login is user-controlled
The system SHALL offer a settings toggle that registers or removes Capsule as a macOS login item, and SHALL reflect the current login-item state.

#### Scenario: Enable login item
- **GIVEN** launch at login is off
- **WHEN** the user turns it on
- **THEN** Capsule starts automatically at the next macOS login

#### Scenario: Disable login item
- **GIVEN** launch at login is on
- **WHEN** the user turns it off
- **THEN** Capsule does not start at the next macOS login

### Requirement: Settings window is a separate regular window
The system SHALL open a normal, focusable settings window (not the overlay) for placement, providers, polling interval, launch-at-login, and demo mode.

#### Scenario: Open settings from the HUD
- **GIVEN** the HUD is visible
- **WHEN** the user opens Settings from the HUD context menu or a settings control
- **THEN** a standard window appears that can take focus
- **AND** the overlay remains visible

#### Scenario: Settings sections
- **GIVEN** the settings window is open
- **WHEN** the user inspects it
- **THEN** they can change placement, enable/disable providers, see connection status, toggle demo mode, set poll interval, and toggle launch at login

### Requirement: Onboarding appears when nothing can be shown
The system SHALL open onboarding/settings on first launch and whenever zero providers are connected and demo mode is off, so the user is not left with a blank screen.

#### Scenario: First launch with no credentials
- **GIVEN** Capsule has never been configured
- **AND** no provider credentials exist
- **AND** demo mode is off
- **WHEN** Capsule starts
- **THEN** onboarding or settings opens and explains how to connect providers or enable demo mode

### Requirement: User can quit Capsule
The system SHALL provide a Quit Capsule action from the settings window and from the HUD context menu.

#### Scenario: Quit from context menu
- **GIVEN** Capsule is running
- **WHEN** the user chooses Quit Capsule from the HUD context menu
- **THEN** the overlay and settings windows close and the process exits

### Requirement: Settings persist across launches
The system SHALL persist placement, enabled providers, demo mode, poll interval, and launch-at-login preference, and restore them on startup.

#### Scenario: Relaunch restores settings
- **GIVEN** the user enabled demo mode, disabled ChatGPT, set poll interval to 30 seconds, and chose left-edge placement
- **WHEN** Capsule quits and starts again
- **THEN** those values are still in effect

### Requirement: Context menu on the rail
The system SHALL show a context menu on right-click (or control-click) of the rail with at least Settings, placement shortcuts, and Quit Capsule.

#### Scenario: Right-click rail
- **GIVEN** the rail is visible
- **WHEN** the user right-clicks the rail
- **THEN** a menu appears that includes Settings and Quit Capsule
