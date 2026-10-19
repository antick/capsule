import Foundation

// The palettes themselves. Each has its own surface and its own pair of
// meter colours; every pair is checked against its surface for at least
// 3:1 on a meter and 4.5:1 on text.

extension MeterPalette {
  /// The warning colours every dark palette shares.
  static func dark(session: UInt32, week: UInt32) -> MeterPalette {
    MeterPalette(
      session: ThemeColor(hex: session), week: ThemeColor(hex: week), warn: ThemeColor(hex: 0xFFB224),
      critical: ThemeColor(hex: 0xFF5147), good: ThemeColor(hex: 0x5AD58B), bad: ThemeColor(hex: 0xFF6B5E))
  }

  /// The warning colours every light palette shares, deep enough for text.
  static func light(session: UInt32, week: UInt32) -> MeterPalette {
    MeterPalette(
      session: ThemeColor(hex: session), week: ThemeColor(hex: week), warn: ThemeColor(hex: 0xC2620A),
      critical: ThemeColor(hex: 0xC62828), good: ThemeColor(hex: 0x2F7A3E), bad: ThemeColor(hex: 0xB42318))
  }
}

extension HudTheme {
  public static let midnight = HudTheme(
    id: .midnight, label: "Midnight", hint: "True black, blue session and violet week.",
    appearance: .dark, surface: ThemeColor(hex: 0x000000), surfaceEdge: ThemeColor(255, 255, 255, 0.10),
    text: ThemeColor(hex: 0xFFFFFF), textMuted: ThemeColor(hex: 0x8E8E93),
    ringTrack: ThemeColor(hex: 0x232326), barTrack: ThemeColor(hex: 0x232326),
    shadow: ThemeColor(0, 0, 0, 0.34), shadowContact: ThemeColor(0, 0, 0, 0.30),
    meters: .dark(session: 0x0A84FF, week: 0xBF5AF2)
  )
  public static let graphite = HudTheme(
    id: .graphite, label: "Graphite", hint: "Charcoal and monochrome: only a limit drawing near shows colour.",
    appearance: .dark, surface: ThemeColor(hex: 0x2A2A2E), surfaceEdge: ThemeColor(255, 255, 255, 0.14),
    text: ThemeColor(hex: 0xF2F2F4), textMuted: ThemeColor(hex: 0xA6A6AD),
    ringTrack: ThemeColor(hex: 0x3F3F45), barTrack: ThemeColor(hex: 0x3F3F45),
    shadow: ThemeColor(0, 0, 0, 0.30), shadowContact: ThemeColor(0, 0, 0, 0.26),
    meters: .dark(session: 0xF2F2F4, week: 0x8E8E96)
  )
  public static let ink = HudTheme(
    id: .ink, label: "Ink", hint: "Deep navy, soft blue session and rose week.",
    appearance: .dark, surface: ThemeColor(hex: 0x0B1430), surfaceEdge: ThemeColor(126, 162, 255, 0.22),
    text: ThemeColor(hex: 0xE6ECFF), textMuted: ThemeColor(hex: 0x8C9ABF),
    ringTrack: ThemeColor(hex: 0x1D2B52), barTrack: ThemeColor(hex: 0x1D2B52),
    shadow: ThemeColor(4, 10, 26, 0.38), shadowContact: ThemeColor(4, 10, 26, 0.32),
    meters: .dark(session: 0x6EA8FF, week: 0xF9A8D4)
  )
  public static let aurora = HudTheme(
    id: .aurora, label: "Aurora", hint: "Dusk purple, pink session and lavender week.",
    appearance: .dark, surface: ThemeColor(hex: 0x1B1030), surfaceEdge: ThemeColor(200, 160, 255, 0.20),
    text: ThemeColor(hex: 0xF5EEFF), textMuted: ThemeColor(hex: 0xA797C7),
    ringTrack: ThemeColor(hex: 0x30224D), barTrack: ThemeColor(hex: 0x30224D),
    shadow: ThemeColor(12, 4, 28, 0.38), shadowContact: ThemeColor(12, 4, 28, 0.32),
    meters: .dark(session: 0xFF6FB5, week: 0xB9A3FF)
  )
  public static let porcelain = HudTheme(
    id: .porcelain, label: "Porcelain", hint: "Clean white, blue session and purple week.",
    appearance: .light, surface: ThemeColor(hex: 0xFFFFFF), surfaceEdge: ThemeColor(0, 0, 0, 0.10),
    text: ThemeColor(hex: 0x111113), textMuted: ThemeColor(hex: 0x6B6B70),
    ringTrack: ThemeColor(hex: 0xE6E6EB), barTrack: ThemeColor(hex: 0xE6E6EB),
    shadow: ThemeColor(16, 16, 20, 0.13), shadowContact: ThemeColor(16, 16, 20, 0.12),
    meters: .light(session: 0x2563EB, week: 0x9333EA)
  )
  public static let linen = HudTheme(
    id: .linen, label: "Linen", hint: "Warm paper, teal session and indigo week.",
    appearance: .light, surface: ThemeColor(hex: 0xF6F0E4), surfaceEdge: ThemeColor(62, 48, 22, 0.14),
    text: ThemeColor(hex: 0x2B241B), textMuted: ThemeColor(hex: 0x776B5B),
    ringTrack: ThemeColor(hex: 0xE4D9C4), barTrack: ThemeColor(hex: 0xE4D9C4),
    shadow: ThemeColor(62, 48, 22, 0.13), shadowContact: ThemeColor(62, 48, 22, 0.12),
    meters: .light(session: 0x0F766E, week: 0x4338CA)
  )
  public static let sage = HudTheme(
    id: .sage, label: "Sage", hint: "Pale green-grey, forest session and ocean week.",
    appearance: .light, surface: ThemeColor(hex: 0xE8F0E9), surfaceEdge: ThemeColor(23, 60, 35, 0.14),
    text: ThemeColor(hex: 0x17231B), textMuted: ThemeColor(hex: 0x56695C),
    ringTrack: ThemeColor(hex: 0xCCDACF), barTrack: ThemeColor(hex: 0xCCDACF),
    shadow: ThemeColor(23, 40, 28, 0.14), shadowContact: ThemeColor(23, 40, 28, 0.12),
    meters: .light(session: 0x167A3E, week: 0x0B5E95)
  )
  public static let blush = HudTheme(
    id: .blush, label: "Blush", hint: "Soft rose, raspberry session and violet week.",
    appearance: .light, surface: ThemeColor(hex: 0xFBEEF2), surfaceEdge: ThemeColor(110, 30, 60, 0.12),
    text: ThemeColor(hex: 0x2A1A20), textMuted: ThemeColor(hex: 0x7E5F6B),
    ringTrack: ThemeColor(hex: 0xEFD5DD), barTrack: ThemeColor(hex: 0xEFD5DD),
    shadow: ThemeColor(60, 20, 35, 0.13), shadowContact: ThemeColor(60, 20, 35, 0.12),
    meters: .light(session: 0xC0185C, week: 0x6D28D9)
  )
}
