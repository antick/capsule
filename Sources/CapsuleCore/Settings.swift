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
  /// The corner arc is disabled, so a stored corner is always discarded.
  public static let cornerArcEnabled = false
}

public struct CapsuleSettings: Sendable, Codable, Equatable {
  public var placementPreset: PlacementPreset
  public var enabledProviderIds: [ProviderId]
  public var demoMode: Bool
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
  public var schemaVersion: Int

  /// What a first launch starts from.
  public static let defaults = CapsuleSettings(
    placementPreset: .rightEdge,
    enabledProviderIds: SettingsDefaults.enabledProviderIds,
    demoMode: false,
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
  /// cannot cost the user every other preference. Unknown keys are dropped.
  public static func parseCurrent(_ raw: JSONValue) -> CapsuleSettings? {
    guard let fields = raw.asObject else { return nil }

    // Required.
    guard
      let preset = fields["placementPreset"]?.asString
        .flatMap(PlacementPreset.init(rawValue:)),
      let enabled = providerOrder(fields["enabledProviderIds"]),
      let demoMode = fields["demoMode"]?.asBool,
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
      demoMode: demoMode,
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
      schemaVersion: SettingsDefaults.schemaVersion
    )
  }

  /// The enabled providers in the dock's own order, de-duplicated. Stored in
  /// toggle order, the dock would re-shuffle its rings on the next save. An
  /// id this build does not know refuses the file, as the schema does.
  private static func providerOrder(_ raw: JSONValue?) -> [ProviderId]? {
    guard let items = raw?.asArray else { return nil }
    var wanted: Set<ProviderId> = []
    for item in items {
      guard let id = item.asString.flatMap(ProviderId.init(rawValue:)) else {
        return nil
      }
      wanted.insert(id)
    }
    return ProviderId.allCases.filter(wanted.contains)
  }
}
