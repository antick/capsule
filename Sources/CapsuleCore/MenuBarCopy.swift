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
  public static let dockRings = "Rings"
  public static let dockRingsHint =
    "One ring for each card's top window, or two: the session outside and the week inside, where a provider has both."
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

  public static func label(_ rings: DockRings) -> String {
    switch rings {
    case .single: return "One ring"
    case .sessionAndWeek: return "Session and week"
    }
  }
}
