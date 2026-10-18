import Foundation

/// Who the native app is, and where it keeps its files. Phase 2 builds under
/// its own identifier so it installs beside the shipping Electron app; the
/// cutover reverts it to `com.antick.capsule`.
public enum AppIdentity {
  public static let name = "Capsule"
  public static let bundleIdentifier = "com.antick.capsule.native"
  /// Folder under Application Support. Named after the identifier, so the
  /// native build never reads or overwrites the Electron app's files.
  public static let supportDirectory = bundleIdentifier
  /// Schema v7 settings, the same shape the Electron app writes.
  public static let settingsFile = "config.json"
  public static let logSubsystem = bundleIdentifier
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
  /// SF Symbol drawn in the menu bar.
  public static let statusSymbol = "capsule.portrait"
  /// Opacity of the theme surface over the dock's vibrancy. At 1 the dock is
  /// the solid surface the reference shows; the vibrancy layer underneath is
  /// in place for when the reference comparison (task 3.15) asks for less.
  public static let surfaceOpacity = 1.0
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
public enum ShellCopy {
  public static let quit = "Quit Capsule"
}
