import CapsuleCore
import Foundation

/// Puts `capsule` on the PATH: a link in `~/.local/bin` to the copy inside
/// the app, so it follows every update and needs no administrator password.
public enum CommandLineTool {
  public static let linkSegments = [".local", "bin", "capsule"]

  /// The copy shipped inside the running app, if this build carries one.
  public static var bundled: String? {
    let path = Bundle.main.bundleURL.appendingPathComponent("Contents/Helpers/capsule").path
    return FileManager.default.isExecutableFile(atPath: path) ? path : nil
  }

  public static var linkPath: String { joinPath(userHome, linkSegments) }

  /// Whether the link exists and points at this app's copy.
  public static var isInstalled: Bool {
    guard let bundled,
      let target = try? FileManager.default.destinationOfSymbolicLink(atPath: linkPath)
    else { return false }
    return target == bundled
  }

  /// Makes or replaces the link. False if this build has no copy to link to.
  @discardableResult
  public static func install() -> Bool {
    guard let bundled else { return false }
    let manager = FileManager.default
    let link = linkPath
    try? manager.createDirectory(
      atPath: (link as NSString).deletingLastPathComponent, withIntermediateDirectories: true)
    if (try? manager.destinationOfSymbolicLink(atPath: link)) != nil { try? manager.removeItem(atPath: link) }
    guard !manager.fileExists(atPath: link) else { return false }
    return (try? manager.createSymbolicLink(atPath: link, withDestinationPath: bundled)) != nil
  }
}
