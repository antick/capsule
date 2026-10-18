import CapsuleCore
import CapsuleHUD
import CoreGraphics
import Foundation

/// The placement engine's view of one display, from AppKit's.
///
/// AppKit puts the origin at the primary display's bottom-left with y going
/// up; the placement engine, like Electron, puts it at the top-left with y
/// going down. `primaryHeight` is the primary display's height, which is what
/// the flip is measured against.
public func chromeSnapshot(
  id: Int, frame: CGRect, visibleFrame: CGRect, primaryHeight: CGFloat,
  dock: ChromeSnapshot.Dock
) -> ChromeSnapshot {
  ChromeSnapshot(
    display: ChromeSnapshot.Display(
      id: id, bounds: topLeft(frame, primaryHeight), workArea: topLeft(visibleFrame, primaryHeight)
    ),
    dock: dock
  )
}

/// The macOS Dock's side, auto-hide and tile size, as the Electron app reads
/// them with `defaults read com.apple.dock`.
public func macDockPreferences(_ defaults: UserDefaults?) -> ChromeSnapshot.Dock {
  let orientation = defaults?.string(forKey: MacDockDefaults.orientationKey)
  let side = orientation.flatMap(ChromeSnapshot.Dock.Side.init(rawValue:)) ?? .bottom
  let tilesize = defaults?.double(forKey: MacDockDefaults.tilesizeKey) ?? 0
  return ChromeSnapshot.Dock(
    orientation: side,
    autohide: defaults?.bool(forKey: MacDockDefaults.autohideKey) ?? false,
    tilesize: tilesize > 0 ? tilesize : MacDockDefaults.tilesize
  )
}

func topLeft(_ rect: CGRect, _ primaryHeight: CGFloat) -> Rect {
  Rect(
    x: Double(rect.minX), y: Double(primaryHeight - rect.maxY),
    width: Double(rect.width), height: Double(rect.height)
  )
}

func appKit(_ rect: Rect, _ primaryHeight: CGFloat) -> CGRect {
  CGRect(
    x: rect.x, y: Double(primaryHeight) - rect.y - rect.height,
    width: rect.width, height: rect.height
  )
}

/// Where the dock's window goes and what it draws, for the rail at rest with
/// no card open.
public struct DockFrame {
  public let placement: PlacementResult
  /// The window, in AppKit screen coordinates.
  public let window: CGRect
  /// The rail's outline in the window's own coordinates, y going up.
  public let rail: CGPath
  public let style: DockStyle
}

/// Sizes the window for the rail and the tallest card it might open, as the
/// Electron app's `computeDockPlacement` does, and traces the rail inside it
/// the way `HudFrame` lays it out.
///
/// Not yet here: a display's hardware notch (task 3.8), a dragged custom
/// position (3.7), and the corner arc, which is not ported at all.
public func dockFrame(
  settings: CapsuleSettings, meterCount: Int, chrome: ChromeSnapshot, primaryHeight: CGFloat
) -> DockFrame {
  let m = hudMetrics(settings.hudScale)
  let style = DockStyle.of(settings.dockStyle)
  let preset = settings.placementPreset
  // A dock lying along an edge drops its percent captions, which makes its
  // rail shorter than a vertical one.
  let compact = preset == .topEdge || preset == .bottomEdge
  let railLength = railLengthForCount(m, meterCount, compact: compact)
  let flare = m.edgeFlare * style.flare
  let cardReserve = cardReserveHeight(m)
  let placement = computePlacement(
    preset, chrome: chrome,
    hud: HudSize(
      railWidth: m.railWidth, railLength: railLength, cardWidth: m.cardWidth,
      cardHeight: cardReserve, expanded: true, shadowPadding: m.shadowPadding,
      joinWidth: m.tailLength + m.joinGap, edgeFlare: flare, edgeGap: dockEdgeGap(m, style)
    ),
    notchAllowed: styleSupportsNotch(style)
  )
  let layout = blobLayout(
    m,
    BlobLayoutInput(
      cardGrowth: placement.cardGrowth, railLength: railLength,
      joinOffset: joinOffsetForIndex(m, 0, compact: compact), cardReserve: cardReserve,
      style: style, railBias: placement.railBias, railDepth: m.railWidth, flare: flare
    )
  )
  let pad = framePadding(m, placement.cardGrowth, style: style)
  let window = Rect(x: placement.x, y: placement.y, width: placement.width, height: placement.height)
  let outline = railPath(
    m, placement.cardGrowth, layout, notch: placement.notch, style: style, flare: flare
  )
  // Frame coordinates run y-down from the frame's top-left; the view's run
  // y-up from the window's bottom-left.
  var flip = CGAffineTransform(translationX: pad.left, y: window.height - pad.top).scaledBy(x: 1, y: -1)
  let rail = cgPath(outline).copy(using: &flip) ?? cgPath(outline)
  return DockFrame(
    placement: placement, window: appKit(window, primaryHeight), rail: rail, style: style
  )
}
