import Foundation

/// The dock's and the settings window's words. Mirrors `COPY` and
/// `ACTIVITY_NOTICE_COPY` in `@capsule/config`.
extension Copy {
  // Readings.
  public static let percentUsedSuffix = "% Used"
  public static let percentRemainingSuffix = "% Remaining"
  public static let percentSuffix = "%"
  public static let tokenUsage = "Token usage"
  public static let tokensToday = "Today"
  public static let tokensMonth = "Last 30 days"
  public static let usageTitleSuffix = " Usage"
  public static let usageDisabled = "Live usage disabled. Check usage in the provider’s app."
  public static let notConnected = "Not connected"
  public static let staleData = "Data is stale"
  public static let unavailable = "Usage unavailable"

  // Sessions.
  public static let sessionBusy = "working"
  public static let sessionWaiting = "waiting"
  public static let sessionIdle = "idle"
  public static let sessionUnknown = "Status unavailable"
  public static let moreSessionsPrefix = "and "
  public static let moreSessionsSuffix = " more"

  // Notices.
  public static let noticeCompletedShort = "Completed"
  public static let noticeHistory = "Activity history"
  public static let noticeReadMark = "·"
  public static let noticeTitle = "Activity"
  public static let noticeCompleted = "Task completed"
  public static let noticeWaiting = "Needs input"
  public static let noticeDismiss = "Dismiss notification"
  public static let noticeOpen = "View notifications"
  public static let noticeClearAll = "Clear all"
  public static let noticeClearAllLabel = "Clear all notifications for every provider"
  public static let noticeMore = "more"
  public static let activityTitleSuffix = " activity"

  // Menus.
  public static let settings = "Settings"
  public static let openSettings = "Settings…"
  public static let position = "Position"
  public static let quit = "Quit Capsule"
  public static let showDock = "Show Dock"
  public static let keepOpen = "Keep open"
  public static let keepOpenDisabledHint =
    "The dock is always shown. Turn on \"Hide until needed\" to hold it out on demand."

  // Settings.
  public static let usageDisplay = "Show usage as"
  public static let usageDisplayHint =
    "Whether the rings, bars and percentages count what you have used or what you have left."
  public static let usageDisplayUsed = "Used"
  public static let usageDisplayRemaining = "Remaining"
  public static let demoMode = "Demo mode"
  public static let demoModeHint = "Show sample numbers instead of your real usage."
  public static let launchAtLogin = "Launch at login"
  public static let launchAtLoginHint = "Start Capsule automatically when you log in."
  public static let pollInterval = "Refresh every"
  public static let pollIntervalHint = "How often Capsule re-reads usage from each provider."
  public static let placement = "Placement"
  public static let placementHint =
    "Or just drag the dock — it snaps to whichever edge you drop it near."
  public static let providers = "Providers"
  public static let appearance = "Appearance"
  public static let appearanceHint =
    "How the dock looks and where it lives. Everything here is previewed above as you change it."
  public static let general = "General"
  public static let generalHint = "Refreshing, notifications, and how Capsule starts up."
  public static let behaviour = "Behaviour"
  public static let usageReadings = "Usage readings"
  public static let system = "System"
  public static let behaviourHint = "When the dock shows itself and when it gets out of the way."
  public static let dockSize = "Dock size"
  public static let dockSizeHint = "Scales the whole dock — rings, card and type together."
  public static let decreaseSize = "Make the dock smaller"
  public static let increaseSize = "Make the dock bigger"
  public static let theme = "Theme"
  public static let themeHint =
    "Auto follows macOS and swaps between Midnight and Porcelain on its own."
  public static let themeAuto = "Auto"
  public static let themeAutoHint = "Match the system appearance."
  public static let dockStyle = "Dock style"
  public static let dockStyleHint = "How the dock meets the edge it is parked against."
  public static let recentre = "Re-centre"
  public static let recentreHint = "Forget where the dock was last dragged and centre it on its edge."
  public static let hideDelay = "Hide after"
  public static let hideDelayHint =
    "How long the dock waits after the pointer leaves before it folds away. Longer is more forgiving when you cross a corner of the card on the way to something else."
  public static let topEdgeNotch = "Draw as a notch"
  public static let topEdgeNotchHint =
    "Centred at the top like the MacBook notch: straight sides, a rounded underside, and at rest a notch-sized tab in the menu bar. On a MacBook display it merges with the real notch. Turn off for a plain bar you can drag along the edge."
  public static let autoHide = "Hide until needed"
  public static let autoHideHint =
    "The dock rests as a slim latch in the screen edge and unrolls when you reach for it."
  public static let showDockHint =
    "Unrolls the dock and holds it there for a few seconds, for when you have lost track of the latch."
  public static let providersHint =
    "Capsule reads the logins these tools already keep on this Mac. Turn one off to hide its ring; Cursor and Copilot start off."
  public static let notificationPopups = "Show notification popups"
  public static let notificationPopupsHint =
    "Open a popup for new activity. When off, an animated provider icon and unread count let you know."
  public static let onboardingTitle = "Welcome to Capsule"
  public static let onboardingBody =
    "Capsule reads Claude, Codex, and Grok usage from logins already on this Mac. Agent chat remains disabled."
  public static let enableDemo = "Enable demo mode"

  /// What the providers page says about each status.
  public static func statusLabel(_ status: UsageStatus?) -> String {
    switch status {
    case .ok: return "Connected"
    case .stale: return "Last known numbers"
    case .error: return "Could not reach"
    case .unauthenticated: return "Not signed in"
    case .disabled: return "Live usage disabled"
    case nil: return "Waiting"
    }
  }
}
