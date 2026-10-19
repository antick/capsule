import Foundation

/// What the menu bar and its settings say.
extension Copy {
  public static let noReading = "—"
  public static let menuBar = "Menu bar"
  public static let menuBarHint = "Where Capsule lives, and what its menu-bar item shows."
  public static let presence = "Show Capsule in"
  public static let presenceHint = "The dock rests at a screen edge; the menu bar opens a panel with every card."
  public static let menuBarStyle = "Menu bar shows"
  public static let menuBarStyleHint = "Capsule's icon, one provider's percentage, or the metrics you pin."
  public static let menuBarMeter = "Provider"
  public static let menuBarMeterHint = "Which percentage the menu bar shows."
  public static let highestUsage = "Highest usage"
  public static let pinnedMetrics = "Pinned metrics"
  public static let pinnedMetricsHint = "Up to six, shown side by side in the menu bar."
  public static let pinStyle = "Draw pins as"
  public static let refreshAll = "Refresh all"
  public static let noMetricsYet = "Readings appear here once providers have been read."

  public static func label(_ presence: Presence) -> String {
    switch presence {
    case .dock: return "Dock"
    case .menuBar: return "Menu bar"
    case .both: return "Both"
    }
  }

  public static func label(_ style: MenuBarStyle) -> String {
    switch style {
    case .icon: return "Icon"
    case .single: return "One percentage"
    case .pinned: return "Pinned metrics"
    }
  }

  public static func label(_ style: PinStyle) -> String {
    switch style {
    case .text: return "Text"
    case .bars: return "Bars"
    }
  }
}
