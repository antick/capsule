import Foundation

/// Where Capsule shows itself: the edge dock, the menu bar, or both.
public enum Presence: String, Sendable, Codable, CaseIterable {
  case dock, menuBar = "menu-bar", both

  public var showsDock: Bool { self != .menuBar }
  public var opensPanelFromMenuBar: Bool { self != .dock }
}

/// What the menu-bar item draws.
public enum MenuBarStyle: String, Sendable, Codable, CaseIterable {
  /// Capsule's own mark.
  case icon
  /// One meter's mark and percentage: the chosen one, or the highest.
  case single
  /// The metrics the user pinned, side by side.
  case pinned
}

/// How a pinned metric is drawn.
public enum PinStyle: String, Sendable, Codable, CaseIterable {
  case text, bars
}

/// One metric on a meter's card: a meter and one of its windows.
public struct MetricKey: Hashable, Sendable, Codable {
  public var meter: String
  public var bucket: String

  public init(meter: String, bucket: String) {
    self.meter = meter
    self.bucket = bucket
  }

  public init(_ meter: MeterId, _ bucket: String) { self.init(meter: meter.rawValue, bucket: bucket) }

  /// `claude/current-session`, as settings store it.
  public var rawValue: String { "\(meter)/\(bucket)" }

  public init?(rawValue: String) {
    guard let slash = rawValue.lastIndex(of: "/") else { return nil }
    let meter = String(rawValue[..<slash])
    let bucket = String(rawValue[rawValue.index(after: slash)...])
    guard !meter.isEmpty, !bucket.isEmpty else { return nil }
    self.init(meter: meter, bucket: bucket)
  }
}

extension Presence: SettingDefault { public static let settingDefault = Presence.dock }
extension MenuBarStyle: SettingDefault { public static let settingDefault = MenuBarStyle.icon }
extension PinStyle: SettingDefault { public static let settingDefault = PinStyle.text }

public enum MenuBarLimits {
  /// Pinned metrics the menu bar holds before it crowds other items out.
  public static let maxPins = 6
  /// Figures stacked beside one mark: the session and the week.
  public static let valuesPerMeter = 2
}

/// One figure in the menu bar: the share shown, and the share used that its
/// colour follows.
public struct MenuBarValue: Equatable, Sendable {
  /// Already flipped to "left" when the user reads it so.
  public var percent: Double?
  public var used: Double?

  public init(percent: Double?, used: Double?) {
    self.percent = percent
    self.used = used
  }
}

/// One provider's mark in the menu bar with up to two figures beside it,
/// stacked: its session above its week, as one item.
public struct MenuBarEntry: Equatable, Sendable {
  public var provider: ProviderId
  public var values: [MenuBarValue]

  public init(provider: ProviderId, values: [MenuBarValue]) {
    self.provider = provider
    self.values = values
  }
}

/// A meter's short window and its weekly one, where it has them: the pair
/// the menu bar shows for a provider. One alone when that is all there is.
public func sessionAndWeek(_ snapshot: UsageSnapshot) -> [UsageBucket] {
  let length = { (bucket: UsageBucket) in WindowLengths.seconds(snapshot.providerId, bucket) }
  let session = snapshot.buckets.first { length($0).map { $0 <= WindowLengths.day } ?? false }
  let week = snapshot.buckets.first { length($0).map { $0 >= WindowLengths.week } ?? false }
  let pair = [session, week].compactMap { $0 }
  return pair.isEmpty ? Array(snapshot.buckets.prefix(1)) : pair
}

/// What the menu-bar item shows for these readings. Empty means Capsule's
/// own mark.
public func menuBarEntries(_ settings: CapsuleSettings, _ snapshots: [UsageSnapshot]) -> [MenuBarEntry] {
  func value(_ used: Double?) -> MenuBarValue {
    let rounded = used.map(jsRound)
    return MenuBarValue(percent: rounded.map { settings.usageDisplay == .remaining ? 100 - $0 : $0 }, used: rounded)
  }
  switch settings.menuBarStyle {
  case .icon:
    return []
  case .single:
    let chosen = settings.menuBarMeter.flatMap { raw in snapshots.first { $0.meterId.rawValue == raw } }
    let highest = snapshots.filter { $0.primaryPercent != nil }.max { $0.primaryPercent! < $1.primaryPercent! }
    guard let snapshot = chosen ?? highest else { return [] }
    let pair = sessionAndWeek(snapshot)
    return [
      MenuBarEntry(
        provider: snapshot.providerId,
        values: pair.isEmpty ? [value(snapshot.primaryPercent)] : pair.map { value($0.percentUsed) })
    ]
  case .pinned:
    // Pins of one meter share its mark, at most two figures each.
    var entries: [(meter: String, entry: MenuBarEntry)] = []
    for key in settings.pinnedMetrics.prefix(MenuBarLimits.maxPins) {
      guard let snapshot = snapshots.first(where: { $0.meterId.rawValue == key.meter }) else { continue }
      let figure = value(snapshot.buckets.first { $0.id == key.bucket }?.percentUsed)
      if let index = entries.firstIndex(where: { $0.meter == key.meter }) {
        if entries[index].entry.values.count < MenuBarLimits.valuesPerMeter { entries[index].entry.values.append(figure) }
      } else {
        entries.append((key.meter, MenuBarEntry(provider: snapshot.providerId, values: [figure])))
      }
    }
    return entries.map(\.entry)
  }
}

/// Sizes of the menu-bar item's picture, in points.
public enum MenuBarMetrics {
  public static let height = 18.0
  public static let iconSize = 14.0
  public static let iconGap = 3.0
  public static let entryGap = 8.0
  public static let fontSize = 12.0
  /// Two figures stacked in the bar's height.
  public static let stackedFontSize = 8.5
  public static let stackedBarHeight = 4.0
  public static let stackedGap = 2.0
  public static let barWidth = 22.0
  public static let barHeight = 5.0
  public static let trackAlpha = 0.25
}

/// Sizes of the panel the menu-bar item opens, in points.
public enum MenuBarPanelMetrics {
  public static let padding = 12.0
  public static let cardGap = 8.0
  public static let maxHeight = 620.0
  public static let cornerRadius = 12.0
  /// The card's tint over the panel, a share of the text colour.
  public static let cardTint = 0.06
}
