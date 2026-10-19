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
}

/// One thing the menu-bar item draws.
public struct MenuBarEntry: Equatable, Sendable {
  public var provider: ProviderId
  /// The share shown, already flipped to "left" when the user reads it so.
  public var percent: Double?
  /// The share used, which the colour always follows.
  public var used: Double?

  public init(provider: ProviderId, percent: Double?, used: Double?) {
    self.provider = provider
    self.percent = percent
    self.used = used
  }
}

/// What the menu-bar item shows for these readings. Empty means Capsule's
/// own mark.
public func menuBarEntries(_ settings: CapsuleSettings, _ snapshots: [UsageSnapshot]) -> [MenuBarEntry] {
  func entry(_ snapshot: UsageSnapshot, _ used: Double?) -> MenuBarEntry {
    let rounded = used.map(jsRound)
    let shown = rounded.map { settings.usageDisplay == .remaining ? 100 - $0 : $0 }
    return MenuBarEntry(provider: snapshot.providerId, percent: shown, used: rounded)
  }
  switch settings.menuBarStyle {
  case .icon:
    return []
  case .single:
    let chosen = settings.menuBarMeter.flatMap { raw in snapshots.first { $0.meterId.rawValue == raw } }
    let highest = snapshots.filter { $0.primaryPercent != nil }.max { $0.primaryPercent! < $1.primaryPercent! }
    guard let snapshot = chosen ?? highest else { return [] }
    return [entry(snapshot, snapshot.primaryPercent)]
  case .pinned:
    return settings.pinnedMetrics.prefix(MenuBarLimits.maxPins).compactMap { key in
      guard let snapshot = snapshots.first(where: { $0.meterId.rawValue == key.meter }) else { return nil }
      return entry(snapshot, snapshot.buckets.first { $0.id == key.bucket }?.percentUsed)
    }
  }
}

/// Sizes of the menu-bar item's picture, in points.
public enum MenuBarMetrics {
  public static let height = 18.0
  public static let iconSize = 14.0
  public static let iconGap = 3.0
  public static let entryGap = 8.0
  public static let fontSize = 12.0
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
