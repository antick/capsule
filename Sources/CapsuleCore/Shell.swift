import Foundation

/// Unbundled executables and unknown identities are always development builds.
public enum AppChannel: String, Sendable {
  case development, production

  public static let productionIdentifier = "com.antick.capsule"
  public static let developmentIdentifier = "com.antick.capsule.dev"

  public init(bundleIdentifier: String?) {
    self = bundleIdentifier == Self.productionIdentifier ? .production : .development
  }

  public var name: String { self == .production ? "Capsule" : "Capsule Dev" }
  public var bundleIdentifier: String {
    self == .production ? Self.productionIdentifier : Self.developmentIdentifier
  }
  public var supportDirectory: String { name }
  public var allowsUpdates: Bool { self == .production }
}

public enum AppIdentity {
  public static let channel = AppChannel(bundleIdentifier: Bundle.main.bundleIdentifier)
  public static let name = channel.name
  public static let bundleIdentifier = channel.bundleIdentifier
  public static let supportDirectory = channel.supportDirectory
  public static let settingsFile = "config.json"
  public static let logSubsystem = bundleIdentifier
}

/// The Electron app's files, read once to carry its settings over.
public enum ElectronFiles {
  /// `electron-store`'s `capsule-settings`: `{ settings, backoff }`.
  public static let settings = "capsule-settings.json"
  /// `electron-store`'s `capsule-readings`: `{ snapshots, tokenCache }`.
  public static let readings = "capsule-readings.json"
  /// Written once the carry-over has run, so it never runs twice.
  public static let carriedOver = "carried-over.json"
}

/// How the shell schedules the logic modules. The only place these live.
public enum ShellTuning {
  /// Posted by the system when the screen unlocks. The original treats an
  /// unlock as its "online" signal, so the native app does too, beside a
  /// real network-path watch.
  public static let screenUnlockedNotification = "com.apple.screenIsUnlocked"
  /// Fraction of an interval a repeating timer may drift, so the system can
  /// coalesce its wakeups with other work.
  public static let timerTolerance = 0.1
  /// Posted when the system switches between light and dark.
  public static let appearanceChangedNotification = "AppleInterfaceThemeChangedNotification"
  /// The key under which `NSScreen.deviceDescription` keeps the display id.
  public static let screenNumberKey = "NSScreenNumber"
  /// Pretend the display has a notch of this size, as "200x37", for trying
  /// the joined top edge on a Mac that has none. Development only.
  public static let fakeNotchEnvironment = "CAPSULE_FAKE_NOTCH"
  /// Width of the hairline outlined dock styles draw.
  public static let outlineWidth = 1.0
}

/// The macOS Dock's preferences, as `defaults` stores them.
public enum MacDockDefaults {
  public static let domain = "com.apple.dock"
  public static let orientationKey = "orientation"
  public static let autohideKey = "autohide"
  public static let tilesizeKey = "tilesize"
  /// What macOS uses before the user has ever resized the Dock.
  public static let tilesize = 48.0
}

/// Strings the shell shows. The only place they live.

