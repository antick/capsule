import CapsuleCore
import CapsuleDock
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

/// A dock lying along an edge drops its percent captions, which makes its
/// rail shorter than a vertical one.
func isCompact(_ preset: PlacementPreset) -> Bool {
  preset == .topEdge || preset == .bottomEdge
}

/// The notch the dock is drawn as, if any: only the top edge, in notch style,
/// in a dock style that can pass for one. A display with a notch of its own
/// lends its exact size; any other gets one the dock draws in its menu bar.
public func joinedNotch(
  settings: CapsuleSettings, preset: PlacementPreset, hardware: HardwareNotch?, chrome: ChromeSnapshot
) -> HardwareNotch? {
  guard preset == .topEdge, settings.topEdgeNotch, styleSupportsNotch(.of(settings.dockStyle)) else {
    return nil
  }
  return hardware
    ?? virtualNotch(
      dockMetrics(settings.hudScale),
      menuBarHeight: chrome.display.workArea.y - chrome.display.bounds.y
    )
}

/// Where the dock's window goes, sized for the rail the view will draw and
/// the tallest card it might open. A port of `computeDockPlacement`.
public func dockPlacement(
  settings: CapsuleSettings, preset: PlacementPreset, meterCount: Int, chrome: ChromeSnapshot,
  joined: HardwareNotch?
) -> PlacementResult {
  let m = dockMetrics(settings.hudScale)
  let style = DockStyle.of(settings.dockStyle)
  let notchAllowed = styleSupportsNotch(style)
  let notch = preset == .topEdge && notchAllowed ? joined : nil
  return computePlacement(
    preset, chrome: chrome,
    hud: HudSize(
      railWidth: m.railWidth + (notch?.height ?? 0),
      railLength: railLength(m, meterCount: meterCount, preset: preset, joined: notch),
      cardWidth: m.cardWidth, cardHeight: cardReserveHeight(m), expanded: true,
      shadowPadding: m.shadowPadding, joinWidth: m.tailLength + m.joinGap,
      edgeFlare: notch != nil ? m.notchBezelFillet : m.edgeFlare * style.flare,
      edgeGap: dockEdgeGap(m, style)
    ),
    notchAllowed: notchAllowed
  )
}

func railLength(_ m: HudMetrics, meterCount: Int, preset: PlacementPreset, joined: HardwareNotch?) -> Double {
  if let joined { return joinedNotchRailLength(m, meterCount, notch: joined) }
  return railLengthForCount(m, meterCount, compact: isCompact(preset))
}

/// The leading edge of a placement's rail, in screen coordinates.
public func railStartOf(_ placement: PlacementResult) -> Double {
  (placement.slide.axis == .x ? placement.x : placement.y) + placement.slide.gutter + placement.railBias
}

/// The same placement, moved so its rail starts where it is asked to.
public func slid(_ placement: PlacementResult, railStart: Double) -> PlacementResult {
  let placed = dockAlongEdge(placement.slide, railStart: railStart)
  var moved = placement
  if placement.slide.axis == .x { moved.x = placed.window } else { moved.y = placed.window }
  moved.railBias = placed.railBias
  return moved
}

/// How the dock view draws itself inside a placement's window.
public func frameSpec(
  settings: CapsuleSettings, placement: PlacementResult, meterCount: Int, joined: HardwareNotch?
) -> FrameSpec {
  let m = dockMetrics(settings.hudScale)
  let style = DockStyle.of(settings.dockStyle)
  let notch = placement.notch && styleSupportsNotch(style)
  let shared = notch ? joined : nil
  return FrameSpec(
    metrics: m, style: style, growth: placement.cardGrowth, notch: notch,
    compact: isCompact(placement.visualPreset),
    railLength: railLength(m, meterCount: meterCount, preset: placement.visualPreset, joined: shared),
    railBias: placement.railBias, joined: shared
  )
}

/// A placement's window, in whole points.
public func windowBox(_ placement: PlacementResult) -> Rect {
  Rect(
    x: jsRound(placement.x), y: jsRound(placement.y), width: jsRound(placement.width),
    height: jsRound(placement.height)
  )
}
