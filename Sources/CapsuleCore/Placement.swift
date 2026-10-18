import Foundation

public func edgeForPreset(_ preset: PlacementPreset) -> ScreenEdge {
  switch preset {
  case .leftEdge: return .left
  case .topEdge: return .top
  case .bottomEdge: return .bottom
  case .rightEdge: return .right
  }
}

public func presetForEdge(_ edge: ScreenEdge) -> PlacementPreset {
  switch edge {
  case .left: return .leftEdge
  case .top: return .topEdge
  case .bottom: return .bottomEdge
  case .right: return .rightEdge
  }
}

public struct PresetLayout: Sendable, Codable, Equatable {
  public var orientation: DockOrientation
  public var cardGrowth: CardGrowth
  public var notch: Bool
}

public func layoutForPreset(_ preset: PlacementPreset) -> PresetLayout {
  switch preset {
  case .leftEdge:
    return PresetLayout(orientation: .vertical, cardGrowth: .right, notch: false)
  case .topEdge:
    return PresetLayout(orientation: .horizontal, cardGrowth: .down, notch: true)
  case .bottomEdge:
    return PresetLayout(orientation: .horizontal, cardGrowth: .up, notch: false)
  case .rightEdge:
    return PresetLayout(orientation: .vertical, cardGrowth: .left, notch: false)
  }
}

/// A window big enough to hold both sizes at once, anchored where the frame
/// is anchored — against the docked edge, and the start of the edge it slides
/// along — so the dock stays still while a resize eases between sizes.
public func zoomHoldBounds(
  target: WindowBox, current: WindowBox, cardGrowth: CardGrowth
) -> WindowBox {
  let width = max(target.width, current.width)
  let height = max(target.height, current.height)
  return WindowBox(
    // Only a right-edge dock is pinned by its right side; only a bottom-edge
    // dock by its bottom.
    x: cardGrowth == .left ? target.x + target.width - width : target.x,
    y: cardGrowth == .up ? target.y + target.height - height : target.y,
    width: width,
    height: height
  )
}

private func clamp(_ value: Double, _ low: Double, _ high: Double) -> Double {
  min(high, max(low, value))
}

/// Places the window for a wanted rail position. The rail is centred in its
/// frame until that would push the frame off screen; then the window stops
/// and the rail keeps going, sliding across the slack instead.
public func dockAlongEdge(_ track: SlideTrack, railStart: Double)
  -> (window: Double, railBias: Double)
{
  let rail = clamp(railStart, track.min, track.max)
  let centred = rail - track.gutter - track.slack / 2
  let window = jsRound(clamp(centred, track.windowMin, track.windowMax))
  // The bias is measured from the window as it actually lands. Rounding the
  // two apart left the rail a point from where it was put.
  return (
    window: window,
    railBias: clamp(
      jsRound(rail - window - track.gutter), 0, jsRound(track.slack)
    )
  )
}

private func centerInRange(_ start: Double, _ span: Double, _ size: Double)
  -> Double
{
  jsRound(start + (span - size) / 2)
}

/// Extents along the rail. A short rail with a long card still has to fit
/// the card, or the bubble is clipped by the window it lives in.
private struct AlongExtents {
  /// The painted rail, flares included: the part the user sees and drags.
  let rail: Double
  /// The frame inside the window, stretched to fit the card.
  let frame: Double
  /// The frame plus its shadow gutter at each end.
  let window: Double
}

private func alongExtents(_ hud: HudSize, cardAlong: Double) -> AlongExtents {
  let rail = hud.railLength + hud.edgeFlare * 2
  let frame = max(rail, hud.expanded ? cardAlong : 0)
  return AlongExtents(rail: rail, frame: frame, window: frame + hud.shadowPadding * 2)
}

private func verticalWindowSize(_ hud: HudSize) -> (width: Double, height: Double) {
  let extra = hud.expanded ? hud.cardWidth + hud.joinWidth : 0
  return (
    width: hud.railWidth + extra + hud.shadowPadding + hud.edgeGap,
    height: alongExtents(hud, cardAlong: hud.cardHeight).window
  )
}

private func horizontalWindowSize(_ hud: HudSize) -> (width: Double, height: Double) {
  let extra = hud.expanded ? hud.cardHeight + hud.joinWidth : 0
  return (
    width: alongExtents(hud, cardAlong: hud.cardWidth).window,
    height: hud.railWidth + extra + hud.shadowPadding + hud.edgeGap
  )
}

private func trackFor(
  axis: SlideTrack.Axis, hud: HudSize, extents: AlongExtents,
  start: Double, end: Double
) -> SlideTrack {
  let windowMin = start - hud.shadowPadding
  return SlideTrack(
    axis: axis,
    min: start,
    max: max(start, end - extents.rail),
    railLength: extents.rail,
    gutter: hud.shadowPadding,
    slack: extents.frame - extents.rail,
    windowMin: windowMin,
    // Only the gutter may go off screen; it is transparent, and keeping the
    // frame inside is what stops an open card from being cut off.
    windowMax: max(windowMin, end - extents.window + hud.shadowPadding)
  )
}

/// Where the dock's window goes for a preset, and how far it may slide.
///
/// - Parameter notchAllowed: false for dock styles that visibly float, which
///   cannot pass for a notch.
public func computePlacement(
  _ preset: PlacementPreset,
  chrome: ChromeSnapshot,
  hud: HudSize,
  notchAllowed: Bool = true
) -> PlacementResult {
  let bounds = chrome.display.bounds
  let workArea = chrome.display.workArea
  let layout = layoutForPreset(preset)
  let notch = layout.notch && notchAllowed
  let edge = edgeForPreset(preset)

  func result(
    x: Double, y: Double, size: (width: Double, height: Double),
    track: SlideTrack, railBias: Double
  ) -> PlacementResult {
    PlacementResult(
      displayId: chrome.display.id, x: x, y: y,
      width: size.width, height: size.height,
      orientation: layout.orientation, cardGrowth: layout.cardGrowth,
      edge: edge, visualPreset: preset, notch: notch,
      slide: track, railBias: railBias, corner: nil
    )
  }

  if edge == .right || edge == .left {
    let size = verticalWindowSize(hud)
    // The rail rides the physical edge for its whole length: stopping at the
    // work area would leave it hanging above the Dock over a band of desktop.
    let extents = alongExtents(hud, cardAlong: hud.cardHeight)
    let track = trackFor(
      axis: .y, hud: hud, extents: extents,
      start: bounds.y, end: bounds.y + bounds.height
    )
    // Centre on the usable height, so the menu bar does not push it down.
    let placed = dockAlongEdge(
      track,
      railStart: centerInRange(workArea.y, workArea.height, extents.rail)
    )
    return result(
      x: edge == .right ? bounds.x + bounds.width - size.width : bounds.x,
      y: placed.window, size: size, track: track, railBias: placed.railBias
    )
  }

  let size = horizontalWindowSize(hud)
  let inset = notch ? PlacementTuning.notchSideInset : 0
  let extents = alongExtents(hud, cardAlong: hud.cardWidth)
  let track = trackFor(
    axis: .x, hud: hud, extents: extents,
    start: bounds.x + inset, end: bounds.x + bounds.width - inset
  )

  if edge == .top {
    // Hangs from the physical top of the screen, over the menu bar.
    let placed = dockAlongEdge(
      track, railStart: centerInRange(bounds.x, bounds.width, extents.rail)
    )
    return result(
      x: placed.window, y: bounds.y, size: size, track: track,
      railBias: placed.railBias
    )
  }

  // Bottom: sit on the physical bottom, the edge the Dock sits on, and default
  // to the free space beside it. Only a visible bottom Dock is in the way.
  let centred = centerInRange(bounds.x, bounds.width, extents.rail)
  let sharesTheEdge = chrome.dock.orientation == .bottom && !chrome.dock.autohide
  var railStart = centred
  if sharesTheEdge {
    let span = PlacementTuning.dockCenteredIconSpan
    let left = centerInRange(bounds.x, bounds.width, span)
    let toTheLeft = left - PlacementTuning.dockFlankMargin - extents.rail
    railStart =
      toTheLeft >= bounds.x
      ? toTheLeft : left + span + PlacementTuning.dockFlankMargin
  }
  let placed = dockAlongEdge(track, railStart: railStart)
  return result(
    x: placed.window, y: jsRound(bounds.y + bounds.height - size.height),
    size: size, track: track, railBias: placed.railBias
  )
}
