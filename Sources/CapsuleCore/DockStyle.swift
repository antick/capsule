import Foundation

public enum DockStyleId: String, Sendable, Codable, CaseIterable {
  case rail, capsule, tray
}

/// How a dock style meets the screen edge. The only place these values live.
public struct DockStyle: Sendable, Equatable {
  public enum Radius: Sendable, Equatable {
    /// Rounds to half the rail's width.
    case pill
    /// A multiple of the rail's own corner radius.
    case scale(Double)
  }

  public let id: DockStyleId
  public let label: String
  public let hint: String
  /// Concave fillet blending the rail into the screen edge; 0 disables it.
  public let flare: Double
  public let radius: Radius
  /// Gap left between the dock and the screen edge, as a fraction of the
  /// rail's side padding: enough to read as floating, not stranded.
  public let edgeGap: Double
  /// Hairline drawn around the surface.
  public let outline: Bool

  public static let rail = DockStyle(
    id: .rail, label: "Rail",
    hint: "Melts into the screen edge with a concave fillet at each end.",
    flare: 1, radius: .scale(1), edgeGap: 0, outline: false
  )
  public static let capsule = DockStyle(
    id: .capsule, label: "Capsule",
    hint: "A floating pill that hovers just clear of the edge.",
    flare: 0, radius: .pill, edgeGap: 0.5, outline: false
  )
  public static let tray = DockStyle(
    id: .tray, label: "Tray",
    hint: "A rounded panel with a hairline border, like the macOS Dock.",
    flare: 0, radius: .scale(0.62), edgeGap: 0.6, outline: true
  )

  public static func of(_ id: DockStyleId) -> DockStyle {
    switch id {
    case .rail: return .rail
    case .capsule: return .capsule
    case .tray: return .tray
    }
  }
}

/// Distance between the dock and the screen edge it is docked against.
public func dockEdgeGap(_ m: HudMetrics, _ style: DockStyle) -> Double {
  style.edgeGap <= 0 ? 0 : max(1, jsRound(m.railPaddingX * style.edgeGap))
}

/// Only the rail style can pass for a notch; the others visibly float.
public func styleSupportsNotch(_ style: DockStyle) -> Bool {
  style.id == .rail
}
