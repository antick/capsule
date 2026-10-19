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
  public var rows = CardRows()
  /// Readings over time, for each card's trend line.
  public var history: UsageHistory = [:]

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
    let trend = trendSamples(snapshot).count > 1 ? HistoryTuning.sparklineHeight + m.cardSectionGap : 0
    return dockCardHeight(
      m, snapshot: snapshot, sessions: own ? content.activity[snapshot.providerId]?.count ?? 0 : 0, notices: 0,
      tokens: own && content.tokens[snapshot.providerId] != nil
    ) + trend
  }

  /// The top window's readings over the charts' span.
  private func trendSamples(_ snapshot: UsageSnapshot) -> [UsageSample] {
    guard let top = snapshot.buckets.first else { return [] }
    return chartSamples(content.history, MetricKey(snapshot.meterId, top.id), now: content.now)
  }

  private func card(_ snapshot: UsageSnapshot) -> some View {
    // Activity and tokens come from each tool's default folder.
    let own = snapshot.accountId == nil
    let card = CardContent(
      snapshot: snapshot, sessions: own ? content.activity[snapshot.providerId] ?? [] : [], notices: [],
      tokens: own ? content.tokens[snapshot.providerId] : nil, display: content.display, unreadCount: 0,
      hasNotices: false, now: content.now, onOpenNotices: {}, onDismissNotice: { _ in }, onClearAll: {},
      rows: content.rows
    )
    let samples = trendSamples(snapshot)
    return VStack(alignment: .leading, spacing: m.cardSectionGap) {
      UsageCardView(content: card, m: m, theme: content.theme)
      if samples.count > 1 {
        Sparkline(samples: samples, now: content.now, color: Color(content.theme.text.nsColor))
          .frame(height: HistoryTuning.sparklineHeight)
          .accessibilityLabel("\(snapshot.buckets.first?.label ?? "") \(Copy.history)")
      }
    }
      .padding(.top, m.cardPaddingTop).padding(.bottom, m.cardPaddingBottom).padding(.horizontal, m.cardPaddingX)
      .frame(maxWidth: .infinity, minHeight: cardHeight(snapshot), alignment: .topLeading)
      .foregroundStyle(Color(content.theme.text.nsColor))
      .background(
        RoundedRectangle(cornerRadius: MenuBarPanelMetrics.cornerRadius)
          .fill(Color(content.theme.text.nsColor).opacity(MenuBarPanelMetrics.cardTint)))
  }
}

/// A window's use over the charts' span, as a stepped line on a faint track.
struct Sparkline: View {
  let samples: [UsageSample]
  let now: Date
  let color: Color

  var body: some View {
    GeometryReader { box in
      ZStack {
        RoundedRectangle(cornerRadius: 4).fill(color.opacity(0.05))
        path(in: box.size).stroke(color.opacity(0.7), lineWidth: 1.2)
      }
    }
  }

  private func path(in size: CGSize) -> Path {
    let start = now.timeIntervalSince1970 - HistoryTuning.chartSeconds
    func point(_ sample: UsageSample) -> CGPoint {
      CGPoint(
        x: size.width * max(0, min(1, (sample.at - start) / HistoryTuning.chartSeconds)),
        y: size.height * (1 - sample.percent / 100))
    }
    var path = Path()
    guard let first = samples.first else { return path }
    path.move(to: point(first))
    for sample in samples.dropFirst() {
      let next = point(sample)
      path.addLine(to: CGPoint(x: next.x, y: path.currentPoint?.y ?? next.y))
      path.addLine(to: next)
    }
    if let last = samples.last { path.addLine(to: CGPoint(x: size.width, y: point(last).y)) }
    return path
  }
}
