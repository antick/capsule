import Foundation

public enum HudThemeChoice: String, Sendable, Codable, CaseIterable {
  case auto, midnight, graphite, ink, porcelain, linen
}

public enum HideDelay: String, Sendable, Codable, CaseIterable {
  case instant, quick, normal, relaxed
}

/// Whether rings, bars and percentages count what was used or what is left.
public enum UsageDisplay: String, Sendable, Codable, CaseIterable {
  case used, remaining
}

public struct DockPosition: Sendable, Codable, Equatable {
  public var x: Double
  public var y: Double

  public init(x: Double, y: Double) {
    self.x = x
    self.y = y
  }
}

public enum SettingsDefaults {
  /// The schema this build reads and writes.
  public static let schemaVersion = 7
  public static let pollIntervalMs = 60_000
  public static let enabledProviderIds: [ProviderId] = [.claude, .codex, .grok]
  /// Providers the app has dropped. A settings file naming one keeps
  /// everything else; the id is skipped.
  public static let retiredProviderIds: Set<String> = ["copilot"]
  /// The corner arc is disabled, so a stored corner is always discarded.
  public static let cornerArcEnabled = false
}

public struct CapsuleSettings: Sendable, Codable, Equatable {
  public var placementPreset: PlacementPreset
  public var enabledProviderIds: [ProviderId]
  public var pollIntervalMs: Int
  public var launchAtLogin: Bool
  public var hudScale: Double
  public var hudTheme: HudThemeChoice
  public var dockStyle: DockStyleId
  /// Let the dock curl into a quarter arc at a screen corner. Always false
  /// while the arc is disabled.
  public var cornerArc: Bool
  public var autoHide: Bool
  public var notificationPopups: Bool
  /// Look for a newer release on launch, and once a day after that.
  public var autoUpdateCheck: Bool
  /// Fetch a found release straight away. Off by default: a menu-bar app
  /// should not decide to download a release unasked.
  public var autoUpdateDownload: Bool
  public var hideDelay: HideDelay
  public var customCorner: Corner?
  /// Draw the top edge as a notch rather than its own shape.
  public var topEdgeNotch: Bool
  public var usageDisplay: UsageDisplay
  public var customPosition: DockPosition?
  /// Other accounts of a provider, each read from its own folder and shown
  /// as a meter of its own after the provider's own.
  @LossyList public var accounts: [UsageAccount] = []
  /// The user's own name for a provider's default sign-in, by provider id.
  /// Absent means the provider's name.
  @LossyNames public var meterNames: [String: String] = [:]
  /// The edge dock, the menu bar, or both.
  @Defaulted public var presence: Presence = .dock
  /// What the menu-bar item draws.
  @Defaulted public var menuBarStyle: MenuBarStyle = .icon
  /// The meter the single style shows; nil for whichever is highest.
  public var menuBarMeter: String? = nil
  /// The metrics the pinned style shows, in order.
  @LossyList public var pinnedMetrics: [MetricKey] = []
  @Defaulted public var pinStyle: PinStyle = .text
  public var schemaVersion: Int

  /// What a first launch starts from.
  public static let defaults = CapsuleSettings(
    placementPreset: .rightEdge,
    enabledProviderIds: SettingsDefaults.enabledProviderIds,
    pollIntervalMs: SettingsDefaults.pollIntervalMs,
    launchAtLogin: false,
    hudScale: HudScale.default,
    hudTheme: .auto,
    dockStyle: .rail,
    cornerArc: false,
    autoHide: true,
    notificationPopups: true,
    autoUpdateCheck: true,
    autoUpdateDownload: false,
    hideDelay: .normal,
    customCorner: nil,
    topEdgeNotch: true,
    usageDisplay: .used,
    customPosition: nil,
    accounts: [],
    meterNames: [:],
    presence: .dock,
    menuBarStyle: .icon,
    menuBarMeter: nil,
    pinnedMetrics: [],
    pinStyle: .text,
    schemaVersion: SettingsDefaults.schemaVersion
  )
}

extension CapsuleSettings {
  /// A settings file the native app can adopt, or nil.
  ///
  /// Only schema v7 is read. An older file, or one with no schema version at
  /// all, returns nil and the app starts from defaults and onboarding instead
  /// of guessing at a migration (design decision 9).
  public static func read(_ raw: JSONValue) -> CapsuleSettings? {
    guard let version = raw["schemaVersion"]?.asDouble,
      version == Double(SettingsDefaults.schemaVersion)
    else { return nil }
    return parseCurrent(raw)
  }

  /// A schema v7 settings object, read field by field.
  ///
  /// The rules follow the Electron app's schema exactly. A required field
  /// that is missing or the wrong type refuses the whole file. A field with
  /// a fallback takes it when absent or unreadable, so a newer build's value
  /// cannot cost the user every other preference. Unknown keys are dropped,
  /// among them `demoMode`, which the app no longer has.
  public static func parseCurrent(_ raw: JSONValue) -> CapsuleSettings? {
    guard let fields = raw.asObject else { return nil }

    // Required.
    guard
      let preset = fields["placementPreset"]?.asString
        .flatMap(PlacementPreset.init(rawValue:)),
      let enabled = providerOrder(fields["enabledProviderIds"]),
      let poll = fields["pollIntervalMs"]?.asDouble,
      poll.isFinite, poll == poll.rounded(.towardZero), poll > 0,
      let launchAtLogin = fields["launchAtLogin"]?.asBool
    else { return nil }

    // Defaulted when absent, but a value that is present must be a number.
    var hudScale = HudScale.default
    if let stored = fields["hudScale"] {
      guard let number = stored.asDouble else { return nil }
      hudScale = clampHudScale(number)
    }

    // Defaulted when absent, and refused only if present and malformed.
    var customPosition: DockPosition?
    if let stored = fields["customPosition"], stored != .null {
      guard let x = stored["x"]?.asDouble, let y = stored["y"]?.asDouble
      else { return nil }
      customPosition = DockPosition(x: x, y: y)
    }

    let defaults = CapsuleSettings.defaults
    func flag(_ key: String, _ fallback: Bool) -> Bool {
      fields[key]?.asBool ?? fallback
    }
    func choice<T: RawRepresentable>(_ key: String, _ fallback: T) -> T
    where T.RawValue == String {
      fields[key]?.asString.flatMap(T.init(rawValue:)) ?? fallback
    }

    let cornerArc = flag("cornerArc", defaults.cornerArc)
    let corner: Corner? = fields["customCorner"]?.asString
      .flatMap(Corner.init(rawValue:))

    return CapsuleSettings(
      placementPreset: preset,
      enabledProviderIds: enabled,
      pollIntervalMs: Int(poll),
      launchAtLogin: launchAtLogin,
      hudScale: hudScale,
      hudTheme: choice("hudTheme", defaults.hudTheme),
      dockStyle: choice("dockStyle", defaults.dockStyle),
      cornerArc: SettingsDefaults.cornerArcEnabled && cornerArc,
      autoHide: flag("autoHide", defaults.autoHide),
      notificationPopups: flag("notificationPopups", defaults.notificationPopups),
      autoUpdateCheck: flag("autoUpdateCheck", defaults.autoUpdateCheck),
      autoUpdateDownload: flag("autoUpdateDownload", defaults.autoUpdateDownload),
      hideDelay: choice("hideDelay", defaults.hideDelay),
      customCorner: SettingsDefaults.cornerArcEnabled ? corner : nil,
      topEdgeNotch: flag("topEdgeNotch", defaults.topEdgeNotch),
      usageDisplay: choice("usageDisplay", defaults.usageDisplay),
      customPosition: customPosition,
      accounts: accountList(fields["accounts"]),
      meterNames: (fields["meterNames"]?.asObject ?? [:]).reduce(into: [:]) { names, entry in
        guard ProviderId(rawValue: entry.key) != nil, let name = entry.value.asString.map(jsTrim), !name.isEmpty
        else { return }
        names[entry.key] = name
      },
      presence: choice("presence", defaults.presence),
      menuBarStyle: choice("menuBarStyle", defaults.menuBarStyle),
      menuBarMeter: fields["menuBarMeter"]?.asString.flatMap { $0.isEmpty ? nil : $0 },
      pinnedMetrics: (fields["pinnedMetrics"]?.asArray ?? []).compactMap { $0.asString.flatMap(MetricKey.init(rawValue:)) }
        .reduce(into: [MetricKey]()) { kept, key in if !kept.contains(key) { kept.append(key) } },
      pinStyle: choice("pinStyle", defaults.pinStyle),
      schemaVersion: SettingsDefaults.schemaVersion
    )
  }

  /// The added accounts that read, in their stored order. One that is
  /// malformed, for a provider without accounts, or a repeat is dropped
  /// rather than costing every other setting.
  private static func accountList(_ raw: JSONValue?) -> [UsageAccount] {
    var kept: [UsageAccount] = []
    for item in raw?.asArray ?? [] {
      guard let id = item["id"]?.asString, !id.isEmpty,
        let provider = item["provider"]?.asString.flatMap(ProviderId.init(rawValue:)),
        AccountRules.supported.contains(provider),
        let path = item["path"]?.asString, !jsTrim(path).isEmpty,
        !kept.contains(where: { $0.id == id })
      else { continue }
      let label = item["label"]?.asString.map(jsTrim) ?? ""
      kept.append(
        UsageAccount(
          id: id, provider: provider, path: path,
          label: label.isEmpty ? ProviderLabels.label(provider) : label,
          enabled: item["enabled"]?.asBool ?? true
        )
      )
    }
    return Array(kept.prefix(AccountRules.maxAccounts))
  }

  /// The enabled providers in the dock's own order, de-duplicated. Stored in
  /// toggle order, the dock would re-shuffle its rings on the next save. An
  /// id this build does not know refuses the file, as the schema does.
  private static func providerOrder(_ raw: JSONValue?) -> [ProviderId]? {
    guard let items = raw?.asArray else { return nil }
    var wanted: Set<ProviderId> = []
    for item in items {
      // A provider the app no longer has is dropped, not a reason to refuse
      // every other setting in the file.
      if let raw = item.asString, SettingsDefaults.retiredProviderIds.contains(raw) { continue }
      guard let id = item.asString.flatMap(ProviderId.init(rawValue:)) else {
        return nil
      }
      wanted.insert(id)
    }
    return ProviderId.allCases.filter(wanted.contains)
  }
}
