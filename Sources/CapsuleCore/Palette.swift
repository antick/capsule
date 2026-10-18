import Foundation

extension ThemeColor {
  /// `#RRGGBB`.
  public init(hex: UInt32, alpha: Double = 1) {
    self.init(
      Double((hex >> 16) & 0xFF), Double((hex >> 8) & 0xFF), Double(hex & 0xFF), alpha
    )
  }
}

/// The dock's reading colours, drawn for its own surface.
public enum SeverityColors {
  public static func color(_ severity: Severity) -> ThemeColor {
    switch severity {
    case .low: return ThemeColor(hex: 0x00F58A)
    case .mid: return ThemeColor(hex: 0xE8F50A)
    case .high: return ThemeColor(hex: 0xFA4405)
    case .critical: return ThemeColor(hex: 0xFF2D1F)
    }
  }

  public static func forPercent(_ percent: Double) -> ThemeColor {
    color(severityForPercent(percent))
  }
}

/// Notice colours, per appearance.
public enum NoticeColors {
  public static func waiting(_ appearance: HudAppearance) -> ThemeColor {
    appearance == .dark ? ThemeColor(hex: 0xE4B665) : ThemeColor(hex: 0x8A5615)
  }

  public static func completed(_ appearance: HudAppearance) -> ThemeColor {
    appearance == .dark ? ThemeColor(hex: 0x74C6A3) : ThemeColor(hex: 0x236C4B)
  }
}

/// The arc inside a ring: the theme's text while an agent works, amber while
/// one waits on you.
public func activityColor(_ state: ActivityState, theme: HudTheme) -> ThemeColor {
  switch state {
  case .working: return theme.text
  case .waiting: return NoticeColors.waiting(theme.appearance)
  case .idle: return theme.ringTrack
  }
}

/// The colour a session's own status word and ring take in the card.
public func sessionStateColor(_ state: AgentSessionState, theme: HudTheme) -> ThemeColor {
  switch state {
  case .busy: return SeverityColors.color(.low)
  case .waiting: return NoticeColors.waiting(theme.appearance)
  case .idle: return theme.textMuted
  }
}
