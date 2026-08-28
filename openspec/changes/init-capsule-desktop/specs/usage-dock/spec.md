## Purpose

The Capsule usage dock is the always-visible HUD: a dark rail of circular meters and a connected speech-bubble detail card. This capability defines appearance and interaction so the right-edge default matches the reference screenshot.

## ADDED Requirements

### Requirement: Rail shows one meter per enabled provider
The system SHALL render a single dark rail containing exactly one circular meter for each enabled provider, in the user's configured provider order.

#### Scenario: Three enabled providers
- **GIVEN** Claude, ChatGPT, and the third provider are enabled
- **WHEN** the dock is shown
- **THEN** the rail contains three meters in that order

#### Scenario: Single enabled provider
- **GIVEN** only Claude is enabled
- **WHEN** the dock is shown
- **THEN** the rail contains exactly one meter

#### Scenario: No enabled providers
- **GIVEN** no providers are enabled
- **WHEN** the dock would otherwise render
- **THEN** the rail is hidden and the settings/onboarding surface is offered instead

### Requirement: Meter shows icon, percent, and ring
Each meter SHALL display the provider icon inside a circular track, a severity-colored arc for the provider's primary percent, and the integer primary percent beneath the circle.

#### Scenario: Claude at 73 percent
- **GIVEN** Claude's primary bucket is 73% used
- **WHEN** the rail is visible
- **THEN** the Claude meter shows the Claude sparkle icon, an arc filling 73% of the ring, and the label `73%`

#### Scenario: Percent is rounded to an integer
- **GIVEN** a provider reports 21.4% used
- **WHEN** the meter renders
- **THEN** the label is `21%` and the arc length uses the same rounded integer

### Requirement: Ring color follows usage severity
The system SHALL color each meter ring from shared severity thresholds: low, mid, high, and critical.

#### Scenario: Low usage is green
- **GIVEN** ChatGPT primary usage is 21%
- **AND** 21% falls in the low band
- **WHEN** the meter renders
- **THEN** the ring is the low (green) color

#### Scenario: Mid usage is yellow
- **GIVEN** the third provider primary usage is 52%
- **AND** 52% falls in the mid band
- **WHEN** the meter renders
- **THEN** the ring is the mid (yellow) color

#### Scenario: High usage is orange-red
- **GIVEN** Claude primary usage is 73%
- **AND** 73% falls in the high band
- **WHEN** the meter renders
- **THEN** the ring is the high (orange-red) color

#### Scenario: Critical usage is red
- **GIVEN** a provider primary usage is 95%
- **AND** 95% falls in the critical band
- **WHEN** the meter renders
- **THEN** the ring is the critical (red) color

### Requirement: Hover reveals the provider detail card
The system SHALL open the detail card for a provider when the pointer hovers that provider's meter for the configured open delay.

#### Scenario: Hover Claude
- **GIVEN** the rail is collapsed
- **WHEN** the pointer hovers the Claude meter for the open delay
- **THEN** the Claude detail card is shown connected to the rail at the Claude meter

#### Scenario: Hovering a second meter switches the card
- **GIVEN** the Claude detail card is visible from hover
- **WHEN** the pointer moves to the ChatGPT meter for the open delay
- **THEN** the Claude card is replaced by the ChatGPT card aligned to the ChatGPT meter

### Requirement: Leaving the HUD closes an unpinned card
The system SHALL hide an unpinned detail card when the pointer leaves the rail and card for the configured close delay.

#### Scenario: Pointer leaves
- **GIVEN** an unpinned Claude card is open
- **WHEN** the pointer leaves both the rail and the card for the close delay
- **THEN** the card is hidden and the rail returns to the collapsed shape

#### Scenario: Moving from meter to card does not close
- **GIVEN** the Claude card is open from hover
- **WHEN** the pointer moves from the Claude meter onto the card without leaving the HUD
- **THEN** the card stays open

### Requirement: Click pins and unpins the detail card
The system SHALL pin the hovered provider's detail card on a click of its meter, and unpin it on a second click of that meter or a click of another meter.

#### Scenario: Pin on click
- **GIVEN** the Claude card is visible
- **WHEN** the user clicks the Claude meter
- **THEN** the card remains open after the pointer leaves the HUD

#### Scenario: Unpin on second click
- **GIVEN** the Claude card is pinned
- **WHEN** the user clicks the Claude meter again
- **THEN** the card closes

### Requirement: Detail card shows provider title and two buckets
The detail card SHALL show the provider icon and "{Provider} Usage" title, then two stacked buckets, each with a label, reset copy, a severity-colored bar, and "{n}% Used".

#### Scenario: Claude card matches the reference copy
- **GIVEN** Claude current session is 73% used resetting in 51 minutes
- **AND** Claude all-models is 7% used resetting Thursday at 12:00 AM local time
- **WHEN** the Claude card is open
- **THEN** the title is `Claude Usage`
- **AND** the first bucket is labeled `Current session` with reset copy `Resets in 51 min`, an orange-red bar at 73%, and `73% Used`
- **AND** the second bucket is labeled `All models` with reset copy `Resets Thu 12:00 AM`, a green bar at 7%, and `7% Used`

#### Scenario: Missing second bucket
- **GIVEN** a provider reports only one usage bucket
- **WHEN** its card is open
- **THEN** the card shows only that bucket and does not invent a second row

### Requirement: Card and rail share one connected black shape
The system SHALL draw the open card and the rail as one continuous dark surface: a rounded card inward of the rail, a tail aligned to the active meter, and a concave join on the rail (speech-bubble / metaball), not a detached floating tooltip.

#### Scenario: Right-edge expanded Claude card
- **GIVEN** placement is the right screen edge
- **AND** the Claude card is open
- **WHEN** the HUD is visible
- **THEN** the card sits to the left of the rail
- **AND** the join points at the Claude meter
- **AND** there is no visual gap between card, tail, and rail

#### Scenario: Bottom Dock-adjacent expanded card
- **GIVEN** placement is Dock-adjacent
- **AND** a card is open
- **WHEN** the HUD is visible
- **THEN** the card sits above the horizontal rail
- **AND** the join points at the active meter

### Requirement: Inner edge is rounded and the outer edge is flush
The system SHALL round the rail on the side facing the desktop and keep the opposite side flush with the chosen screen or gutter edge.

#### Scenario: Default right-edge rail
- **GIVEN** placement is the right screen edge
- **WHEN** the rail is collapsed
- **THEN** the right side is flush with the display edge
- **AND** the left side is a continuous rounded capsule

### Requirement: Vertical rail for side placement and horizontal rail for Dock placement
The system SHALL stack meters vertically for left-edge, right-edge, and Stage Manager placements, and SHALL arrange meters in a horizontal row for Dock-adjacent placement.

#### Scenario: Right edge is vertical
- **GIVEN** placement is the right screen edge
- **WHEN** three meters are shown
- **THEN** they are stacked top-to-bottom

#### Scenario: Dock-adjacent is horizontal
- **GIVEN** placement is Dock-adjacent on the bottom
- **WHEN** three meters are shown
- **THEN** they are arranged left-to-right

### Requirement: Unauthenticated meter is distinct from zero usage
The system SHALL render an unauthenticated provider meter with an empty ring, no percent-used claim, and a card that states the provider is not connected.

#### Scenario: ChatGPT has no credentials
- **GIVEN** ChatGPT is enabled and unauthenticated
- **WHEN** the user opens the ChatGPT card
- **THEN** the card does not show `0% Used` as if usage were fetched
- **AND** it states that ChatGPT is not connected

### Requirement: Error meter preserves last known usage
The system SHALL keep showing the last successful snapshot on a meter when a later fetch fails, and SHALL mark the card as stale/unavailable rather than clearing the rail.

#### Scenario: Fetch fails after a good snapshot
- **GIVEN** Claude last showed 73%
- **WHEN** the next fetch fails
- **THEN** the Claude meter still shows 73%
- **AND** the card indicates the data is unavailable or stale

### Requirement: Default three-meter right-edge HUD matches the reference
With demo or live data equal to the reference values, the default right-edge HUD SHALL match `references/hud-reference.jpg`: black right-edge capsule, three rings (73% high, 21% low, 52% mid), and the Claude card expanded with the two bars described above.

#### Scenario: Visual acceptance
- **GIVEN** demo data of Claude 73%/7%, ChatGPT 21%, third provider 52%
- **AND** placement is right edge
- **AND** the Claude card is open
- **WHEN** the HUD is compared to the reference image
- **THEN** layout, typography, ring geometry, card structure, and connected-blob silhouette match the reference
