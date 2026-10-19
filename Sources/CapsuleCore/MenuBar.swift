import Foundation

/// Where Capsule shows itself: the edge dock alone, the menu bar alone, or
/// both. With the dock alone there is no menu-bar item at all; the dock's
/// right-click, or opening the app again, reaches Settings.
public enum Presence: String, Sendable, Codable, CaseIterable {
  case dock, menuBar = "menu-bar", both

  public var showsDock: Bool { self != .menuBar }
  public var showsMenuBarItem: Bool { self != .dock }
}

/// What the menu-bar item draws.
public enum MenuBarStyle: String, Sendable, Codable, CaseIterable {
  /// Capsule's own mark.
  case icon
  /// The figures the user chose: per provider, its mark with up to two
  /// figures stacked beside it.
  case figures
}

/// How each ring on the dock reads.
public enum DockRings: String, Sendable, Codable, CaseIterable {
  /// One ring: the card's top window.
  case single
  /// Two rings: the short window outside, the week inside.
  case sessionAndWeek = "session-and-week"
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
extension DockRings: SettingDefault { public static let settingDefault = DockRings.single }
extension PinStyle: SettingDefault { public static let settingDefault = PinStyle.text }

public enum MenuBarLimits {
  /// Figures stacked beside one mark: as many as fit the bar's height, one
  /// above the other.
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

/// What the menu-bar item shows for these readings, in the dock's order.
/// Within a meter its figures read shortest window first, whatever order
/// they were chosen in. Empty means Capsule's own mark.
public func menuBarEntries(_ settings: CapsuleSettings, _ snapshots: [UsageSnapshot]) -> [MenuBarEntry] {
  guard settings.menuBarStyle == .figures else { return [] }
  func value(_ used: Double?) -> MenuBarValue {
    let rounded = used.map(jsRound)
    return MenuBarValue(percent: rounded.map { settings.usageDisplay == .remaining ? 100 - $0 : $0 }, used: rounded)
  }
  let chosen = Set(settings.pinnedMetrics)
  return snapshots.compactMap { snapshot in
    let picked = snapshot.buckets.filter { chosen.contains(MetricKey(snapshot.meterId, $0.id)) }
      .sorted { (WindowLengths.seconds(snapshot.providerId, $0) ?? .infinity) < (WindowLengths.seconds(snapshot.providerId, $1) ?? .infinity) }
      .prefix(MenuBarLimits.valuesPerMeter)
    guard !picked.isEmpty else { return nil }
    return MenuBarEntry(provider: snapshot.providerId, values: picked.map { value($0.percentUsed) })
  }
}

extension CapsuleSettings {
  /// Chooses or drops one figure. A meter already showing two drops its
  /// oldest choice to make room, so a click always does what it says.
  public mutating func toggleFigure(_ key: MetricKey, _ on: Bool) {
    pinnedMetrics.removeAll { $0 == key }
    guard on else { return }
    let mine = pinnedMetrics.filter { $0.meter == key.meter }
    if mine.count >= MenuBarLimits.valuesPerMeter, let oldest = mine.first {
      pinnedMetrics.removeAll { $0 == oldest }
    }
    pinnedMetrics.append(key)
  }

  /// Figures to start from when none are chosen: the busiest meter's
  /// session and week.
  public mutating func seedFigures(_ snapshots: [UsageSnapshot]) {
    guard pinnedMetrics.isEmpty,
      let busiest = snapshots.filter({ $0.primaryPercent != nil }).max(by: { $0.primaryPercent! < $1.primaryPercent! })
        ?? snapshots.first
    else { return }
    pinnedMetrics = sessionAndWeek(busiest).map { MetricKey(busiest.meterId, $0.id) }
  }
}

/// The week's ring on the dock, in shares of the session ring's stroke.
public enum DualRing {
  public static let strokeShare = 0.6
  public static let gapShare = 0.2
  /// Drawn softer than the session, in the same severity colour, so the
  /// two read apart and both still say how close to the limit they are.
  public static let alpha = 0.6
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
