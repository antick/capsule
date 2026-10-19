import CapsuleCore
import Foundation

/// The keys the user pasted into Settings, in a file only they can read
/// (mode 0600) in Capsule's own folder. Kept out of the keychain on purpose:
/// a keychain item asks again whenever the app's signature changes, and a
/// usage dock should never ask for a password.
public final class KeyFile: @unchecked Sendable {
  private let url: URL
  /// One lock for every instance: the app and its reader each hold one.
  private static let lock = NSLock()
  private var lock: NSLock { Self.lock }

  public init(directory: URL) {
    url = directory.appendingPathComponent(StoredKey.fileName)
  }

  public func value(_ key: StoredKey) -> String? {
    lock.withLock { read()[key.rawValue] }.flatMap { $0.isEmpty ? nil : $0 }
  }

  public func has(_ key: StoredKey) -> Bool { value(key) != nil }

  /// Saves a key, or forgets it when blank.
  public func set(_ key: StoredKey, _ value: String?) {
    lock.withLock {
      var all = read()
      let trimmed = value.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) } ?? ""
      all[key.rawValue] = trimmed.isEmpty ? nil : trimmed
      write(all)
    }
  }

  private func read() -> [String: String] {
    guard let data = try? Data(contentsOf: url),
      let all = try? JSONDecoder().decode([String: String].self, from: data)
    else { return [:] }
    return all
  }

  private func write(_ all: [String: String]) {
    let manager = FileManager.default
    try? manager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    guard let data = try? JSONEncoder().encode(all) else { return }
    // Written whole to an owner-only file beside it, then moved over it in
    // one step, so a reader never meets a half-written file.
    let temp = url.deletingLastPathComponent().appendingPathComponent(".\(StoredKey.fileName).\(UUID().uuidString)")
    guard manager.createFile(atPath: temp.path, contents: data, attributes: [.posixPermissions: 0o600]) else { return }
    if rename(temp.path, url.path) != 0 { try? manager.removeItem(at: temp) }
  }
}

/// Trusts a self-signed certificate on loopback only, where a local app's
/// language server lives. Everything else gets the system's usual checks.
final class LoopbackTrust: NSObject, URLSessionDelegate {
  static let hosts: Set<String> = ["127.0.0.1", "localhost", "::1"]

  func urlSession(
    _ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    let space = challenge.protectionSpace
    guard space.authenticationMethod == NSURLAuthenticationMethodServerTrust, Self.hosts.contains(space.host),
      let trust = space.serverTrust
    else { return completionHandler(.performDefaultHandling, nil) }
    completionHandler(.useCredential, URLCredential(trust: trust))
  }
}
