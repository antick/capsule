import CapsuleCore
import CapsuleHUD
import SwiftUI

/// What the menu-bar panel shows and what its buttons do.
public struct UsagePanelContent {
  public var snapshots: [UsageSnapshot]
  public var activity: [ProviderId: [AgentSession]]
  public var tokens: [ProviderId: TokenUsage]
  public var display: UsageDisplay
  public var theme: HudTheme
  public var now: Date
  public var onRefreshAll: () -> Void
  public var onOpenSettings: () -> Void

  public init(
    snapshots: [UsageSnapshot], activity: [ProviderId: [AgentSession]], tokens: [ProviderId: TokenUsage],
    display: UsageDisplay, theme: HudTheme, now: Date, onRefreshAll: @escaping () -> Void,
    onOpenSettings: @escaping () -> Void
  ) {
    self.snapshots = snapshots
    self.activity = activity
    self.tokens = tokens
    self.display = display
    self.theme = theme
    self.now = now
    self.onRefreshAll = onRefreshAll
    self.onOpenSettings = onOpenSettings
  }
}

/// Every meter's card, one under the other: the dock's cards, opened from
/// the menu bar instead of an edge.
public struct UsagePanelView: View {
  let content: UsagePanelContent
  let m = hudMetrics()

  public init(content: UsagePanelContent) { self.content = content }

  public var body: some View {
    let theme = content.theme
    let p = MenuBarPanelMetrics.self
    VStack(alignment: .leading, spacing: p.cardGap) {
      HStack(spacing: 10) {
        Text(AppIdentity.name).font(.system(size: m.cardTitleSize, weight: .semibold))
        Spacer(minLength: 0)
        Button(action: content.onRefreshAll) { Image(systemName: "arrow.clockwise") }
          .buttonStyle(.borderless).help(Copy.refreshAll).accessibilityLabel(Copy.refreshAll)
          .focusable(false)
        Button(action: content.onOpenSettings) { Image(systemName: "gearshape") }
          .buttonStyle(.borderless).help(Copy.openSettings).accessibilityLabel(Copy.openSettings)
          .focusable(false)
      }
      .foregroundStyle(Color(theme.text.nsColor))
      // A scroll view has no height of its own, so the cards are measured
      // the way the dock measures its card.
      ScrollView {
        VStack(alignment: .leading, spacing: p.cardGap) {
          if content.snapshots.isEmpty {
            Text(Copy.noMetricsYet).font(.system(size: m.cardLabelSize))
              .foregroundStyle(Color(theme.textMuted.nsColor))
          }
          ForEach(content.snapshots, id: \.meterId) { snapshot in card(snapshot) }
        }
      }
      .frame(height: min(p.maxHeight, listHeight))
    }
    .padding(p.padding)
    .frame(width: m.cardWidth + 2 * (m.cardPaddingX + p.padding))
    .background(Color(theme.surface.nsColor))
  }

  /// The cards' heights and the gaps between them.
  private var listHeight: Double {
    guard !content.snapshots.isEmpty else { return m.cardTextLine }
    let cards = content.snapshots.map { cardHeight($0) }.reduce(0, +)
    return cards + MenuBarPanelMetrics.cardGap * Double(content.snapshots.count - 1)
  }

  private func cardHeight(_ snapshot: UsageSnapshot) -> Double {
    let own = snapshot.accountId == nil
    return dockCardHeight(
      m, snapshot: snapshot, sessions: own ? content.activity[snapshot.providerId]?.count ?? 0 : 0, notices: 0,
      tokens: own && content.tokens[snapshot.providerId] != nil
    )
  }

  private func card(_ snapshot: UsageSnapshot) -> some View {
    // Activity and tokens come from each tool's default folder.
    let own = snapshot.accountId == nil
    let card = CardContent(
      snapshot: snapshot, sessions: own ? content.activity[snapshot.providerId] ?? [] : [], notices: [],
      tokens: own ? content.tokens[snapshot.providerId] : nil, display: content.display, unreadCount: 0,
      hasNotices: false, now: content.now, onOpenNotices: {}, onDismissNotice: { _ in }, onClearAll: {}
    )
    return UsageCardView(content: card, m: m, theme: content.theme)
      .padding(.top, m.cardPaddingTop).padding(.bottom, m.cardPaddingBottom).padding(.horizontal, m.cardPaddingX)
      .frame(maxWidth: .infinity, minHeight: cardHeight(snapshot), alignment: .topLeading)
      .foregroundStyle(Color(content.theme.text.nsColor))
      .background(
        RoundedRectangle(cornerRadius: MenuBarPanelMetrics.cornerRadius)
          .fill(Color(content.theme.text.nsColor).opacity(MenuBarPanelMetrics.cardTint)))
  }
}
