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

/// One of the dock's palettes. Mirrors `HUD_THEMES` in `@capsule/config`.
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

  public static let midnight = HudTheme(
    id: .midnight, label: "Midnight", hint: "True black, the way the dock was drawn.",
    appearance: .dark, surface: ThemeColor(0, 0, 0), surfaceEdge: ThemeColor(255, 255, 255, 0.10),
    text: ThemeColor(255, 255, 255), textMuted: ThemeColor(140, 140, 140),
    ringTrack: ThemeColor(48, 48, 48), barTrack: ThemeColor(46, 46, 46),
    shadow: ThemeColor(0, 0, 0, 0.34), shadowContact: ThemeColor(0, 0, 0, 0.30)
  )
  public static let graphite = HudTheme(
    id: .graphite, label: "Graphite", hint: "Softer charcoal that sits gently on busy wallpaper.",
    appearance: .dark, surface: ThemeColor(28, 28, 30), surfaceEdge: ThemeColor(255, 255, 255, 0.14),
    text: ThemeColor(245, 245, 247), textMuted: ThemeColor(154, 154, 161),
    ringTrack: ThemeColor(58, 58, 62), barTrack: ThemeColor(58, 58, 62),
    shadow: ThemeColor(0, 0, 0, 0.30), shadowContact: ThemeColor(0, 0, 0, 0.26)
  )
  public static let ink = HudTheme(
    id: .ink, label: "Ink", hint: "Deep navy with a cool cast.",
    appearance: .dark, surface: ThemeColor(11, 18, 32), surfaceEdge: ThemeColor(126, 162, 255, 0.18),
    text: ThemeColor(233, 238, 255), textMuted: ThemeColor(126, 140, 171),
    ringTrack: ThemeColor(30, 42, 66), barTrack: ThemeColor(30, 42, 66),
    shadow: ThemeColor(4, 10, 26, 0.38), shadowContact: ThemeColor(4, 10, 26, 0.32)
  )
  public static let porcelain = HudTheme(
    id: .porcelain, label: "Porcelain", hint: "Clean white for light desktops.",
    appearance: .light, surface: ThemeColor(255, 255, 255), surfaceEdge: ThemeColor(0, 0, 0, 0.10),
    text: ThemeColor(17, 17, 19), textMuted: ThemeColor(107, 107, 112),
    ringTrack: ThemeColor(228, 228, 233), barTrack: ThemeColor(228, 228, 233),
    shadow: ThemeColor(16, 16, 20, 0.13), shadowContact: ThemeColor(16, 16, 20, 0.12)
  )
  public static let linen = HudTheme(
    id: .linen, label: "Linen", hint: "Warm paper tone that stays quiet in daylight.",
    appearance: .light, surface: ThemeColor(247, 243, 235), surfaceEdge: ThemeColor(62, 48, 22, 0.12),
    text: ThemeColor(35, 32, 27), textMuted: ThemeColor(123, 115, 101),
    ringTrack: ThemeColor(227, 219, 203), barTrack: ThemeColor(227, 219, 203),
    shadow: ThemeColor(62, 48, 22, 0.13), shadowContact: ThemeColor(62, 48, 22, 0.12)
  )

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
  }
}
