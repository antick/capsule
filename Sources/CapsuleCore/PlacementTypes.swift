import Foundation

public struct Rect: Sendable, Codable, Equatable {
  public var x: Double
  public var y: Double
  public var width: Double
  public var height: Double

  public init(x: Double, y: Double, width: Double, height: Double) {
    self.x = x
    self.y = y
    self.width = width
    self.height = height
  }
}

public enum ScreenEdge: String, Sendable, Codable, CaseIterable {
  case left, right, top, bottom
}

/// Which way the card opens out of the rail.
public enum CardGrowth: String, Sendable, Codable, CaseIterable {
  case left, right, up, down
}

public enum DockOrientation: String, Sendable, Codable {
  case vertical, horizontal
}

/// A screen corner. Only the disabled corner arc ever names one.
public enum Corner: String, Sendable, Codable, CaseIterable {
  case topLeft = "top-left"
  case topRight = "top-right"
  case bottomLeft = "bottom-left"
  case bottomRight = "bottom-right"
}

/// The dock always rides a screen edge; dragging re-docks it to whichever
/// edge the cursor is nearest, so these four are the whole placement model.
public enum PlacementPreset: String, Sendable, Codable, CaseIterable {
  case rightEdge = "right-edge"
  case leftEdge = "left-edge"
  case topEdge = "top-edge"
  case bottomEdge = "bottom-edge"

  public var label: String {
    switch self {
    case .rightEdge: return "Right edge"
    case .leftEdge: return "Left edge"
    case .bottomEdge: return "Bottom, beside the Dock"
    case .topEdge: return "Top, as a notch"
    }
  }

  public var hint: String {
    switch self {
    case .rightEdge: return "Slides up and down the right side of the screen."
    case .leftEdge: return "Slides up and down the left side of the screen."
    case .bottomEdge:
      return "Sits level with the macOS Dock so you can park it alongside."
    case .topEdge: return "Hangs from the menu bar like the MacBook notch."
    }
  }
}

/// Where the macOS Dock is, and whether it gets out of the way.
public struct ChromeSnapshot: Sendable, Codable, Equatable {
  public struct Display: Sendable, Codable, Equatable {
    public var id: Int
    public var bounds: Rect
    public var workArea: Rect

    public init(id: Int, bounds: Rect, workArea: Rect) {
      self.id = id
      self.bounds = bounds
      self.workArea = workArea
    }
  }

  public struct Dock: Sendable, Codable, Equatable {
    public enum Side: String, Sendable, Codable { case bottom, left, right }
    public var orientation: Side
    public var autohide: Bool
    public var tilesize: Double

    public init(orientation: Side, autohide: Bool, tilesize: Double) {
      self.orientation = orientation
      self.autohide = autohide
      self.tilesize = tilesize
    }
  }

  public var display: Display
  public var dock: Dock

  public init(display: Display, dock: Dock) {
    self.display = display
    self.dock = dock
  }
}

/// The dock's own extents, as the placement engine needs them.
public struct HudSize: Sendable, Codable, Equatable {
  public var railWidth: Double
  public var railLength: Double
  public var cardWidth: Double
  public var cardHeight: Double
  public var expanded: Bool
  public var shadowPadding: Double
  public var joinWidth: Double
  public var edgeFlare: Double
  /// Gap the dock style leaves between itself and the screen edge.
  public var edgeGap: Double

  public init(
    railWidth: Double, railLength: Double, cardWidth: Double,
    cardHeight: Double, expanded: Bool, shadowPadding: Double,
    joinWidth: Double, edgeFlare: Double, edgeGap: Double
  ) {
    self.railWidth = railWidth
    self.railLength = railLength
    self.cardWidth = cardWidth
    self.cardHeight = cardHeight
    self.expanded = expanded
    self.shadowPadding = shadowPadding
    self.joinWidth = joinWidth
    self.edgeFlare = edgeFlare
    self.edgeGap = edgeGap
  }
}

/// How far the dock may travel along its edge, and how its window relates to
/// the rail the user sees.
///
/// The window is bigger than the rail both ways: a transparent shadow gutter,
/// plus however much the card overhangs the rail, since the window has to
/// show a card without resizing. Clamping that window to the screen would
/// stop the rail short of the corners, so travel is measured in rail
/// coordinates and ``dockAlongEdge(_:railStart:)`` works out the rest.
public struct SlideTrack: Sendable, Codable, Equatable {
  public enum Axis: String, Sendable, Codable { case x, y }
  public var axis: Axis
  /// Range for the leading edge of the painted rail, in screen coordinates.
  public var min: Double
  public var max: Double
  /// Length of the painted rail along this axis, flares included.
  public var railLength: Double
  /// Transparent shadow gutter between the window and the frame inside it.
  public var gutter: Double
  /// Spare frame the rail can slide within: the card's overhang, both ends.
  public var slack: Double
  /// Window positions that keep the whole frame — and so the card — on screen.
  public var windowMin: Double
  public var windowMax: Double
}

public struct PlacementResult: Sendable, Codable, Equatable {
  public var displayId: Int
  public var x: Double
  public var y: Double
  public var width: Double
  public var height: Double
  public var orientation: DockOrientation
  public var cardGrowth: CardGrowth
  public var edge: ScreenEdge
  public var visualPreset: PlacementPreset
  /// True when the dock should render as a screen-top notch.
  public var notch: Bool
  public var slide: SlideTrack
  /// Where the rail sits inside its frame, given `x` and `y`.
  public var railBias: Double
  /// Always nil while the corner arc is disabled; kept so the shape of a
  /// placement matches the one the Electron app persists.
  public var corner: Corner?
}

/// The window for one frame of a resize, as a plain box.
public struct WindowBox: Sendable, Codable, Equatable {
  public var x: Double
  public var y: Double
  public var width: Double
  public var height: Double

  public init(x: Double, y: Double, width: Double, height: Double) {
    self.x = x
    self.y = y
    self.width = width
    self.height = height
  }
}

/// Placement constants. The only place these numbers live.
public enum PlacementTuning {
  /// Widest the macOS Dock is assumed to be; the bottom preset parks the
  /// dock outside this centred span so the two never overlap.
  public static let dockCenteredIconSpan = 420.0
  /// Breathing room between the dock and the macOS Dock on the bottom edge.
  public static let dockFlankMargin = 12.0
  /// Keeps the notch clear of the camera housing on notched displays.
  public static let notchSideInset = 8.0
}
