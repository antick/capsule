import Foundation

/// What the menu bar and its settings say.
extension Copy {
  public static let noReading = "—"
  public static let menuBar = "Menu bar"
  public static let menuBarHint = "Where Capsule lives, and what its menu-bar item shows."
  public static let presence = "Show Capsule in"
  public static let presenceHint =
    "Edge dock: rings at a screen edge, no menu-bar item (right-click the dock for Settings). Menu bar: an item that opens a panel with every card. Both: the two together."
  public static let menuBarStyle = "Menu bar shows"
  public static let menuBarStyleHint = "Capsule's icon alone, or the figures you choose below."
  public static let highestUsage = "Highest usage"
  public static let pinnedMetrics = "Figures"
  public static let pinnedMetricsHint =
    "Up to two per provider: the shorter window on top, the longer below, beside the provider's mark. Choosing a third replaces the oldest. Providers with none chosen stay out of the menu bar."
  public static let pinStyle = "Draw figures as"
  public static let meters = "Meters"
  public static let metersHint =
    "Rings fill up as a window is used. Gauges drain: full while plenty is left, emptying as you use it. Both turn from green to red as the limit nears."
  public static let dockRings = "Shows"
  public static let dockRingsHint =
    "The card's top window alone, or the session and the week where a provider has both: inside the ring, or beside it in a gauge."
  public static let dockPercent = "Percent labels"
  public static let dockPercentHint = "The figures under each ring on a side dock. Hovering a ring always shows them on its card."
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
    case .dock: return "Edge dock"
    case .menuBar: return "Menu bar"
    case .both: return "Both"
    }
  }

  public static func label(_ style: MenuBarStyle) -> String {
    switch style {
    case .icon: return "Icon"
    case .figures: return "Figures"
    }
  }

  public static func label(_ style: PinStyle) -> String {
    switch style {
    case .text: return "Text"
    case .bars: return "Bars"
    }
  }

  public static func label(_ style: MeterStyle) -> String {
    switch style {
    case .rings: return "Rings"
    case .gauges: return "Gauges"
    }
  }

  public static func label(_ rings: DockRings) -> String {
    switch rings {
    case .single: return "Top window"
    case .sessionAndWeek: return "Session and week"
    }
  }
}
