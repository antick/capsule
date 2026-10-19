import Foundation

/// What the menu bar and its settings say.
extension Copy {
  public static let noReading = "—"
  public static let menuBar = "Menu bar"
  public static let menuBarHint = "Where Capsule lives, and what its menu-bar item shows."
  public static let presence = "Show Capsule in"
  public static let presenceHint = "The dock rests at a screen edge; the menu bar opens a panel with every card."
  public static let menuBarStyle = "Menu bar shows"
  public static let menuBarStyleHint =
    "Capsule's icon alone, one provider's session and week, or the windows you pin. A provider's two figures stack beside its mark."
  public static let menuBarMeter = "Provider"
  public static let menuBarMeterHint = "Which percentage the menu bar shows."
  public static let highestUsage = "Highest usage"
  public static let pinnedMetrics = "Pinned metrics"
  public static let pinnedMetricsHint = "Up to six, shown side by side in the menu bar."
  public static let pinStyle = "Draw pins as"
  public static let refreshAll = "Refresh all"
  public static let metrics = "Metrics"
  public static let metricsHint =
    "Choose which windows each card shows, star the ones to keep at the top, and set their order. Right-click a row on a card to hide or star it there."
  public static let showMetric = "Show"
  public static let moveUp = "Move up"
  public static let moveDown = "Move down"
  public static let showPace = "Show pace"
  public static let showPaceHint =
    "Compare each window's use with an even pace through it, and say when it would run out at this rate."
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
    case .single: return "One provider"
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
