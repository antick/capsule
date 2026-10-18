import CapsuleActivity
import CapsuleCore
import CapsuleSystem
import Foundation

/// Takes over from the Electron app, once: its schema v7 settings, its last
/// readings, its rate-limit penalties and its token cache. A missing,
/// corrupt or pre-v7 settings file is not migrated: the app starts from
/// defaults and shows onboarding instead (design decision 9).
public enum CarryOver {
  public enum Outcome: Equatable {
    /// Already done, or the native app already had settings of its own.
    case skipped
    /// The Electron app's settings were adopted.
    case adopted
    /// Nothing usable to adopt: defaults, and onboarding.
    case fresh
  }

  @discardableResult
  public static func run(_ store: JSONStore, now: Date = Date()) -> Outcome {
    let directory = store.directory
    func exists(_ name: String) -> Bool {
      FileManager.default.fileExists(atPath: directory.appendingPathComponent(name).path)
    }
    if exists(ElectronFiles.carriedOver) { return .skipped }
    defer { store.save(ElectronFiles.carriedOver, ["carriedOverAt": isoString(now)]) }
    if exists(AppIdentity.settingsFile) { return .skipped }

    let old = document(directory.appendingPathComponent(ElectronFiles.settings))
    let readings = document(directory.appendingPathComponent(ElectronFiles.readings))
    if let backoff = old?["backoff"]?.asObject {
      store.save(StoreFiles.backoff, backoff.compactMapValues(\.asDouble))
    }
    if let snapshots = readings?["snapshots"], let decoded: [UsageSnapshot] = decode(snapshots) {
      store.save(StoreFiles.snapshots, decoded)
    }
    if let cache = readings?["tokenCache"], let decoded: [String: TokenFileEntry] = decode(cache) {
      store.save(StoreFiles.tokenCache, decoded)
    }
    guard let raw = old?["settings"], let settings = CapsuleSettings.read(raw) else { return .fresh }
    Engine.saveSettings(settings, to: store)
    return .adopted
  }

  private static func document(_ url: URL) -> JSONValue? {
    guard let data = FileManager.default.contents(atPath: url.path) else { return nil }
    return JSONValue.parse(String(decoding: data, as: UTF8.self))
  }

  private static func decode<Value: Decodable>(_ value: JSONValue) -> Value? {
    guard let data = try? JSONSerialization.data(withJSONObject: value.foundation, options: [.fragmentsAllowed])
    else { return nil }
    return try? JSONDecoder().decode(Value.self, from: data)
  }
}

extension JSONValue {
  /// The value as `JSONSerialization` takes it.
  var foundation: Any {
    switch self {
    case .null: return NSNull()
    case .bool(let flag): return flag
    case .number(let number): return number
    case .string(let text): return text
    case .array(let items): return items.map(\.foundation)
    case .object(let fields): return fields.mapValues(\.foundation)
    }
  }
}
