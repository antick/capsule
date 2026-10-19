import Foundation

/// A colour as the palette writes it: 0–255 channels and an alpha.
public struct ThemeColor: Sendable, Equatable {
  public var red: Double
  public var green: Double
  public var blue: Double
  public var alpha: Double

  public init(_ red: Double, _ green: Double, _ blue: Double, _ alpha: Double = 1) {
    self.red = red
    self.green = green
    self.blue = blue
    self.alpha = alpha
  }
}

public enum HudAppearance: String, Sendable, Codable {
  case light, dark
}

/// What a theme draws its readings in. Each meter has two colours of its
/// own, the session and the week, so the pair reads apart at a glance; any
/// window close to its limit turns `warn` and then `critical` instead.
public struct MeterPalette: Sendable, Equatable {
  public let session: ThemeColor
  public let week: ThemeColor
  public let warn: ThemeColor
  public let critical: ThemeColor
  /// Text for room to spare, readable on the theme's surface.
  public let good: ThemeColor
  /// Text for running ahead of pace.
  public let bad: ThemeColor
}

/// Which of a meter's two colours a window takes.
public enum MeterRole: Sendable {
  case session, week
}

/// One of the dock's palettes.
public struct HudTheme: Sendable, Equatable {
  public let id: HudThemeChoice
  public let label: String
  public let hint: String
  public let appearance: HudAppearance
  /// Body fill of the rail and the card.
  public let surface: ThemeColor
  /// Hairline drawn around the surface by outlined dock styles.
  public let surfaceEdge: ThemeColor
  public let text: ThemeColor
  public let textMuted: ThemeColor
  /// Unfilled part of a meter ring.
  public let ringTrack: ThemeColor
  /// Unfilled part of a card bar.
  public let barTrack: ThemeColor
  /// Ambient shadow colour, already carrying its own alpha.
  public let shadow: ThemeColor
  /// The tighter contact shadow under the same surface.
  public let shadowContact: ThemeColor
  public let meters: MeterPalette

  /// A window's colour for its share used: its role's own colour with room
  /// to spare, `warn` and then `critical` as the limit nears.
  public func meterColor(_ used: Double, role: MeterRole) -> ThemeColor {
    switch severityForPercent(used) {
    case .low, .mid: return role == .week ? meters.week : meters.session
    case .high: return meters.warn
    case .critical: return meters.critical
    }
  }

  /// Palettes `auto` picks between, one per system appearance.
  public static func auto(_ appearance: HudAppearance) -> HudTheme {
    appearance == .dark ? .midnight : .porcelain
  }
}

/// The palette a setting asks for. `auto` follows the system appearance.
public func resolveHudTheme(_ choice: HudThemeChoice, system: HudAppearance) -> HudTheme {
  switch choice {
  case .auto: return .auto(system)
  case .midnight: return .midnight
  case .graphite: return .graphite
  case .ink: return .ink
  case .porcelain: return .porcelain
  case .linen: return .linen
  case .aurora: return .aurora
  case .sage: return .sage
  case .blush: return .blush
  }
}
