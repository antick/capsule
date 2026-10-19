import CapsuleCore
import CapsuleHUD
import SwiftUI

/// What the card shows and what its buttons do.
public struct CardContent {
  public var snapshot: UsageSnapshot
  public var sessions: [AgentSession]
  public var notices: [ActivityNotice]
  public var tokens: TokenUsage?
  public var display: UsageDisplay
  public var unreadCount: Int
  public var hasNotices: Bool
  public var now: Date
  public var onOpenNotices: () -> Void
  public var onDismissNotice: (String) -> Void
  public var onClearAll: () -> Void
  /// How each row reads, and what clicking or right-clicking it does.
  public var rows = CardRows()
}

/// The user's choices for a card's rows, and the edits they can make there.
/// Equal when the choices are: the edits are the same whoever built them.
public struct CardRows: Equatable {
  public static func == (lhs: CardRows, rhs: CardRows) -> Bool {
    lhs.flipReset == rhs.flipReset && lhs.showPace == rhs.showPace && lhs.starred == rhs.starred
  }

  public var flipReset = false
  public var showPace = true
  public var starred: Set<MetricKey> = []
  /// Flip used/left everywhere.
  public var onFlipDisplay: () -> Void = {}
  /// Flip countdown/date everywhere.
  public var onFlipReset: () -> Void = {}
  public var onHide: (MetricKey) -> Void = { _ in }
  public var onStar: (MetricKey, Bool) -> Void = { _, _ in }

  public init() {}

  public init(_ settings: CapsuleSettings, onChange: @escaping ((inout CapsuleSettings) -> Void) -> Void) {
    flipReset = settings.flipResetStyle
    showPace = settings.showPace
    starred = Set(settings.starredMetrics)
    onFlipDisplay = { onChange { $0.usageDisplay = $0.usageDisplay == .used ? .remaining : .used } }
    onFlipReset = { onChange { $0.flipResetStyle.toggle() } }
    onHide = { key in onChange { $0.setHidden(key, true) } }
    onStar = { key, on in onChange { $0.setStarred(key, on) } }
  }
}

/// The card: a provider's readings, or its notices while they are up.
struct DockCardView: View {
  let content: CardContent
  let m: HudMetrics
  let theme: HudTheme

  var body: some View {
    Group {
      if content.notices.isEmpty {
        UsageCardView(content: content, m: m, theme: theme)
      } else {
        NoticeCardView(content: content, m: m, theme: theme)
      }
    }
    .padding(.top, m.cardPaddingTop)
    .padding(.bottom, m.cardPaddingBottom)
    .padding(.horizontal, m.cardPaddingX)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .foregroundStyle(Color(theme.text.nsColor))
    .id("\(content.snapshot.meterId.rawValue)-\(content.notices.isEmpty ? "usage" : "notices")")
    .transition(.opacity.animation(.easeInOut(duration: Motion.crossfadeMs / 1000)))
  }
}

private func color(_ c: ThemeColor) -> Color { Color(c.nsColor) }

private func date(_ iso: String) -> Date { looseDate(iso) ?? Date() }

/// The provider's mark and a title, with room for an action at the end.
struct CardTitle<Accessory: View>: View {
  let id: ProviderId
  let title: String
  let m: HudMetrics
  let theme: HudTheme
  @ViewBuilder let accessory: Accessory

  var body: some View {
    HStack(spacing: m.cardIconGap) {
      ProviderMark(id: id, tint: color(theme.text))
        .frame(width: m.cardIconSize, height: m.cardIconSize)
      Text(title).lineLimit(1).truncationMode(.tail)
      Spacer(minLength: 0)
      accessory
    }
    .font(.system(size: m.cardTitleSize))
    .frame(height: m.cardTitleLine)
    .padding(.bottom, m.cardTitleGap)
  }
}

struct UsageCardView: View {
  let content: CardContent
  let m: HudMetrics
  let theme: HudTheme

  private var snapshot: UsageSnapshot { content.snapshot }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      CardTitle(id: snapshot.iconId, title: "\(snapshot.displayName)\(Copy.usageTitleSuffix)", m: m, theme: theme) {
        // A remembered reading has to be dated, or it passes itself off as live.
        if snapshot.status == .stale, let since = snapshot.staleSince {
          Text(formatAgo(since: date(since), now: content.now))
            .font(.system(size: m.cardResetSize)).foregroundStyle(color(theme.textMuted))
            .lineLimit(1)
        }
        if content.hasNotices {
          CardAction(m: m, theme: theme, label: "\(Copy.noticeOpen) (\(content.unreadCount))") {
            content.onOpenNotices()
          } content: {
            Text(content.unreadCount > 0 ? "\(Copy.noticeTitle) (\(content.unreadCount))" : Copy.noticeTitle)
          }
        }
      }
      readings
      if let tokens = content.tokens { TokenSection(tokens: tokens, m: m, theme: theme) }
      if !content.sessions.isEmpty { SessionList(sessions: content.sessions, now: content.now, m: m, theme: theme) }
    }
  }

  @ViewBuilder private var readings: some View {
    switch snapshot.status {
    case .disabled: message(Copy.usageDisabled)
    case .unauthenticated: message(Copy.notConnected)
    default:
      if snapshot.buckets.isEmpty && (snapshot.extras ?? []).isEmpty {
        message(snapshot.status == .stale ? Copy.staleData : Copy.unavailable)
      } else {
        VStack(alignment: .leading, spacing: m.cardSectionGap) {
          ForEach(snapshot.buckets, id: \.id) { bucket in
            BucketRow(
              meter: snapshot.meterId, provider: snapshot.providerId, bucket: bucket, display: content.display,
              rows: content.rows, now: content.now, m: m, theme: theme)
          }
          ForEach(snapshot.extras ?? [], id: \.id) { extra in
            ExtraRow(meter: snapshot.meterId, extra: extra, rows: content.rows, now: content.now, m: m, theme: theme)
          }
        }
      }
    }
  }

  private func message(_ text: String) -> some View {
    Text(text).font(.system(size: m.cardLabelSize)).foregroundStyle(color(theme.textMuted))
      .lineLimit(1).frame(height: m.cardTextLine)
  }
}

struct BucketRow: View {
  let meter: MeterId
  let provider: ProviderId
  let bucket: UsageBucket
  let display: UsageDisplay
  let rows: CardRows
  let now: Date
  let m: HudMetrics
  let theme: HudTheme

  var body: some View {
    let used = jsRound(bucket.percentUsed)
    let shown = display == .remaining ? 100 - used : used
    let suffix = display == .remaining ? Copy.percentRemainingSuffix : Copy.percentUsedSuffix
    let key = MetricKey(meter, bucket.id)
    let starred = rows.starred.contains(key)
    let paced = rows.showPace ? pace(provider, bucket, now: now) : nil
    VStack(alignment: .leading, spacing: m.cardBucketGap) {
      HStack(alignment: .firstTextBaseline, spacing: m.cardResetGap) {
        if starred {
          Image(systemName: "star.fill").font(.system(size: m.cardResetSize)).foregroundStyle(color(theme.textMuted))
            .accessibilityLabel(Copy.starred)
        }
        Text(bucket.label).font(.system(size: m.cardLabelSize)).lineLimit(1)
        Spacer(minLength: 0)
        // Clicking the reset flips countdown and date on every card.
        Button(action: rows.onFlipReset) {
          Text(formatResetCopy(date(bucket.resetsAt), style: bucket.resetStyle, flipped: rows.flipReset, now: now))
            .font(.system(size: m.cardResetSize)).foregroundStyle(color(theme.textMuted)).lineLimit(1)
        }
        .buttonStyle(.plain).focusable(false).help(Copy.flipResetHint)
      }
      .frame(height: m.cardTextLine)
      GeometryReader { box in
        ZStack(alignment: .leading) {
          Capsule().fill(color(theme.barTrack))
          Capsule().fill(color(SeverityColors.forPercent(used)))
            .frame(width: box.size.width * max(0, min(100, shown)) / 100)
            .animation(.timingCurve(0.22, 1, 0.36, 1, duration: Motion.barMs / 1000), value: shown)
          // Where an even pace would be by now.
          if let paced {
            let mark = display == .remaining ? 1 - paced.elapsedFraction : paced.elapsedFraction
            let width = m.barHeight * PaceMark.widthPerBar
            Rectangle().fill(color(theme.text)).frame(width: width, height: m.barHeight * PaceMark.heightPerBar)
              .offset(x: box.size.width * mark - width / 2)
              .accessibilityHidden(true)
          }
        }
      }
      .frame(height: m.barHeight)
      HStack(alignment: .firstTextBaseline, spacing: m.cardResetGap) {
        // Clicking the percentage flips used and left on every card.
        Button(action: rows.onFlipDisplay) {
          Text("\(jsString(.number(shown)))\(suffix)").font(.system(size: m.cardLabelSize).monospacedDigit())
        }
        .buttonStyle(.plain).focusable(false).help(Copy.flipDisplayHint)
        Spacer(minLength: 0)
        if let paced {
          let copy = formatPace(paced, now: now)
          Text([copy.pace, copy.outlook].compactMap { $0 }.joined(separator: Copy.paceSeparator))
            .font(.system(size: m.cardResetSize)).lineLimit(1).minimumScaleFactor(0.8)
            .foregroundStyle(color(paceColor(paced)))
        }
      }
      .frame(height: m.cardTextLine)
    }
    .contextMenu {
      Button(starred ? Copy.unstarMetric : Copy.starMetric) { rows.onStar(key, !starred) }
      Button(Copy.hideMetric) { rows.onHide(key) }
    }
  }

  /// Muted on pace, the severity colours ahead of it, green with room to spare.
  private func paceColor(_ pace: Pace) -> ThemeColor {
    switch pace.stage {
    case .onTrack, .slightlyBehind: return theme.textMuted
    case .behind, .farBehind: return SeverityColors.color(.low)
    case .slightlyAhead: return SeverityColors.color(.mid)
    case .ahead, .farAhead: return SeverityColors.color(.critical)
    }
  }
}

/// An amount on the card: extra usage, credits, a balance. A window's shape,
/// with the bar only when there is a share to show.
struct ExtraRow: View {
  let meter: MeterId
  let extra: UsageExtra
  let rows: CardRows
  let now: Date
  let m: HudMetrics
  let theme: HudTheme

  var body: some View {
    let key = MetricKey(meter, extra.id)
    VStack(alignment: .leading, spacing: m.cardBucketGap) {
      HStack(alignment: .firstTextBaseline, spacing: m.cardResetGap) {
        Text(extra.label).font(.system(size: m.cardLabelSize)).lineLimit(1)
        Spacer(minLength: 0)
        if let resets = extra.resetsAt.flatMap(looseDate) {
          Button(action: rows.onFlipReset) {
            Text(formatResetCopy(resets, style: .absolute, flipped: rows.flipReset, now: now))
              .font(.system(size: m.cardResetSize)).foregroundStyle(color(theme.textMuted)).lineLimit(1)
          }
          .buttonStyle(.plain).focusable(false).help(Copy.flipResetHint)
        } else if let note = extra.note {
          Text(note).font(.system(size: m.cardResetSize)).foregroundStyle(color(theme.textMuted)).lineLimit(1)
        }
      }
      .frame(height: m.cardTextLine)
      if let used = extra.percentUsed {
        GeometryReader { box in
          ZStack(alignment: .leading) {
            Capsule().fill(color(theme.barTrack))
            Capsule().fill(color(SeverityColors.forPercent(used)))
              .frame(width: box.size.width * max(0, min(100, used)) / 100)
          }
        }
        .frame(height: m.barHeight)
      }
      Text(extra.value).font(.system(size: m.cardLabelSize).monospacedDigit()).lineLimit(1).minimumScaleFactor(0.8)
        .frame(height: m.cardTextLine)
    }
    .contextMenu { Button(Copy.hideMetric) { rows.onHide(key) } }
  }
}

/// How much the provider's agents have got through, from their own logs.
struct TokenSection: View {
  let tokens: TokenUsage
  let m: HudMetrics
  let theme: HudTheme

  var body: some View {
    VStack(alignment: .leading, spacing: m.cardBucketGap) {
      Text(tokens.todayCost == nil ? Copy.tokenUsage : Copy.tokensAndSpend).frame(height: m.cardTextLine)
      row(Copy.tokensToday, tokens.todayTokens, tokens.todayCost)
      row(Copy.tokensMonth, tokens.monthTokens, tokens.monthCost)
    }
    .font(.system(size: m.cardLabelSize))
    .padding(.top, m.cardSectionGap)
  }

  /// Tokens, and beside them the spend they come to at list price.
  private func row(_ label: String, _ value: Double, _ cost: Double?) -> some View {
    let spend = cost.map { (tokens.costPartial == true ? Copy.atLeast : "") + formatMoney($0) }
    return HStack(spacing: m.cardResetGap) {
      Text(label).foregroundStyle(color(theme.textMuted))
      Spacer(minLength: 0)
      Text([formatCompactCount(value), spend].compactMap { $0 }.joined(separator: Copy.paceSeparator)).monospacedDigit()
    }
    .help(cost == nil ? "" : Copy.spendHint)
    .lineLimit(1)
    .frame(height: m.cardTextLine)
  }
}

/// The live sessions, under a rule. Only as many as the card can hold; the
/// rest are counted.
struct SessionList: View {
  let sessions: [AgentSession]
  let now: Date
  let m: HudMetrics
  let theme: HudTheme

  var body: some View {
    let ordered = orderSessions(sessions)
    let shown = sessionRowsShown(ordered.count)
    VStack(alignment: .leading, spacing: 0) {
      Rectangle().fill(color(theme.barTrack)).frame(height: m.cardRule)
        .padding(.vertical, m.cardRuleGap)
      VStack(alignment: .leading, spacing: m.cardSectionGap) {
        ForEach(ordered.prefix(shown.rows), id: \.id) { session in
          SessionRow(session: session, now: now, m: m, theme: theme)
        }
        if shown.hidden > 0 {
          Text("\(Copy.moreSessionsPrefix)\(shown.hidden)\(Copy.moreSessionsSuffix)")
            .font(.system(size: m.cardLabelSize)).foregroundStyle(color(theme.textMuted))
            .frame(height: m.cardTextLine)
        }
      }
    }
  }
}

struct SessionRow: View {
  let session: AgentSession
  let now: Date
  let m: HudMetrics
  let theme: HudTheme

  var body: some View {
    let state: AgentSessionState = session.confirmed == false ? .idle : session.state
    let tint = color(sessionStateColor(state, theme: theme))
    let word =
      session.confirmed == false
      ? Copy.sessionUnknown
      : session.state == .busy ? Copy.sessionBusy : session.state == .waiting ? Copy.sessionWaiting : Copy.sessionIdle
    // While blocked, what it is blocked on matters more than where it lives.
    let detail = session.state == .waiting ? session.waitingFor ?? session.detail : session.detail
    VStack(alignment: .leading, spacing: m.cardBucketGap) {
      HStack(spacing: m.cardResetGap) {
        Text(session.name).lineLimit(1).truncationMode(.tail)
        Spacer(minLength: 0)
        HStack(spacing: m.cardStatusGap) {
          StatusRing(state: state, tint: tint, m: m)
          Text(word).foregroundStyle(tint)
        }
        .fixedSize()
      }
      HStack(spacing: m.cardResetGap) {
        Text(detail).foregroundStyle(color(theme.textMuted)).lineLimit(1).truncationMode(.tail)
        Spacer(minLength: 0)
        Text(formatElapsed(since: date(session.since), now: now)).foregroundStyle(color(theme.textMuted))
          .fixedSize()
      }
    }
    .font(.system(size: m.cardLabelSize))
    .frame(height: m.cardTextLine * 2 + m.cardBucketGap)
  }
}

/// The tiny ring beside a session's status word: turning while the agent
/// works, half while it waits, whole when it is idle.
struct StatusRing: View {
  let state: AgentSessionState
  let tint: Color
  let m: HudMetrics
  @State private var turning = false

  var body: some View {
    let trim = state == .busy ? 0.75 : state == .waiting ? 0.5 : 1
    Circle().trim(from: 0, to: trim)
      .stroke(tint, style: StrokeStyle(lineWidth: m.cardStatusStroke, lineCap: .round))
      .rotationEffect(.degrees(-90 + (turning ? 360 : 0)))
      .frame(width: m.cardStatusDot - m.cardStatusStroke, height: m.cardStatusDot - m.cardStatusStroke)
      .frame(width: m.cardStatusDot, height: m.cardStatusDot)
      .onAppear {
        guard state == .busy, !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion else { return }
        withAnimation(.linear(duration: Motion.statusSpinMs / 1000).repeatForever(autoreverses: false)) {
          turning = true
        }
      }
  }
}

struct NoticeCardView: View {
  let content: CardContent
  let m: HudMetrics
  let theme: HudTheme

  var body: some View {
    let waiting = content.notices.filter { $0.kind == .waiting }.count
    let completed = content.notices.count - waiting
    let hidden = max(0, content.notices.count - NoticePresentation.maxVisible)
    VStack(alignment: .leading, spacing: 0) {
      CardTitle(
        id: content.snapshot.iconId, title: "\(content.snapshot.displayName)\(Copy.activityTitleSuffix)", m: m,
        theme: theme
      ) {
        CardAction(m: m, theme: theme, label: Copy.noticeClearAllLabel) { content.onClearAll() } content: {
          Text(Copy.noticeClearAll)
        }
      }
      HStack(spacing: m.cardResetGap) {
        if waiting > 0 {
          Text("\(waiting) \(Copy.noticeWaiting)").foregroundStyle(color(NoticeColors.waiting(theme.appearance)))
        }
        if completed > 0 {
          Text("\(completed) \(Copy.noticeCompletedShort)")
            .foregroundStyle(color(NoticeColors.completed(theme.appearance)))
        }
      }
      .font(.system(size: m.cardResetSize))
      .frame(height: m.cardTextLine)
      Rectangle().fill(color(theme.barTrack)).frame(height: m.cardRule).padding(.vertical, m.cardRuleGap)
      ScrollView(.vertical, showsIndicators: false) {
        VStack(alignment: .leading, spacing: m.cardSectionGap) {
          ForEach(content.notices.reversed(), id: \.id) { notice in row(notice) }
          if hidden > 0 {
            Text("+\(hidden) \(Copy.noticeMore)").font(.system(size: m.cardResetSize))
              .foregroundStyle(color(theme.textMuted)).frame(height: m.cardTextLine)
          }
        }
      }
      .frame(
        maxHeight: Double(NoticePresentation.maxVisible) * (m.cardTextLine * 2 + m.cardBucketGap)
          + Double(NoticePresentation.maxVisible - 1) * m.cardSectionGap
      )
    }
  }

  private func row(_ notice: ActivityNotice) -> some View {
    let tint = color(
      notice.kind == .waiting ? NoticeColors.waiting(theme.appearance) : NoticeColors.completed(theme.appearance)
    )
    let label = notice.kind == .waiting ? Copy.noticeWaiting : Copy.noticeCompleted
    let summary = (notice.summary ?? "").isEmpty ? label : notice.summary ?? label
    return HStack(spacing: m.cardResetGap) {
      VStack(alignment: .leading, spacing: m.cardBucketGap) {
        Text(notice.title).font(.system(size: m.cardLabelSize)).lineLimit(1).truncationMode(.tail)
          .frame(height: m.cardTextLine)
        HStack(spacing: m.cardResetGap) {
          Text(summary).foregroundStyle(tint).lineLimit(1).truncationMode(.tail)
          Spacer(minLength: 0)
          Text(formatAgo(since: date(notice.at), now: content.now)).foregroundStyle(color(theme.textMuted))
            .fixedSize()
        }
        .font(.system(size: m.cardResetSize))
        .frame(height: m.cardTextLine)
      }
      Button {
        content.onDismissNotice(notice.id)
      } label: {
        Text("×").font(.system(size: m.cardTitleSize)).foregroundStyle(color(theme.textMuted))
          .frame(width: m.cardTitleLine, height: m.cardTitleLine)
          .background(RoundedRectangle(cornerRadius: m.cardStatusGap).fill(color(theme.barTrack)))
      }
      .buttonStyle(.plain)
      .accessibilityLabel("\(Copy.noticeDismiss): \(notice.title)")
      .help(Copy.noticeDismiss)
    }
  }
}

/// The small pill button a card carries in its title row.
struct CardAction<Label: View>: View {
  let m: HudMetrics
  let theme: HudTheme
  let label: String
  let action: () -> Void
  @ViewBuilder let content: Label

  var body: some View {
    Button(action: action) {
      content.font(.system(size: m.cardResetSize)).foregroundStyle(color(theme.text))
        .padding(.horizontal, m.cardResetGap)
        .frame(height: m.cardTitleLine)
        .background(RoundedRectangle(cornerRadius: m.cardStatusGap).fill(color(theme.barTrack)))
        .fixedSize()
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
    .help(label)
  }
}

/// A provider's mark, each piece at its own strength.
public struct ProviderMark: View {
  let id: ProviderId
  let tint: Color

  public init(id: ProviderId, tint: Color) {
    self.id = id
    self.tint = tint
  }

  public var body: some View {
    GeometryReader { box in
      let shapes = ProviderIcons.shapes(id)
      ZStack {
        ForEach(shapes.indices, id: \.self) { index in
          let shape = shapes[index]
          Path(scaled(shape.path, to: box.size))
            .fill(tint.opacity(shape.opacity), style: FillStyle(eoFill: shape.evenOdd))
        }
      }
    }
  }

  private func scaled(_ path: CGPath, to size: CGSize) -> CGPath {
    var scale = CGAffineTransform(
      scaleX: size.width / ProviderIcons.artboard, y: size.height / ProviderIcons.artboard
    )
    return path.copy(using: &scale) ?? path
  }
}
