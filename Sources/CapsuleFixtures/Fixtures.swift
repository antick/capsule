import Foundation

/// One extracted test case from the shared corpus at the repository root.
///
/// The corpus is read by both this suite and the Vitest suites; neither may
/// keep a private copy of a case. See `fixtures/README.md`.
public struct FixtureCase<Input: Decodable, Expected: Decodable>: Decodable {
  public let name: String
  public let input: Input
  public let expected: Expected
  /// Why this case exists, when the inputs alone do not say.
  public let note: String?
}

public struct FixtureFile<Input: Decodable, Expected: Decodable>: Decodable {
  public let about: String
  /// Zone the cases are written in. Required whenever a case formats or parses
  /// wall-clock time.
  public let timeZone: String?
  public let locale: String?
  public let frozenNow: String?
  public let cases: [FixtureCase<Input, Expected>]
}

public enum FixtureError: Error, CustomStringConvertible {
  case corpusNotFound
  case missing(String)
  case noCases(String)
  case noFrozenNow(String)
  case badDate(String)
  case unknownTimeZone(String)

  public var description: String {
    switch self {
    case .corpusNotFound:
      return "fixtures root not found: no Package.swift above this file"
    case .missing(let path):
      return "fixture not found: \(path).json"
    case .noCases(let path):
      return "fixture has no cases: \(path).json"
    case .noFrozenNow(let about):
      return "fixture declares no frozenNow: \(about)"
    case .badDate(let raw):
      return "not an ISO-8601 date: \(raw)"
    case .unknownTimeZone(let name):
      return "fixture names a time zone this system does not know: \(name)"
    }
  }
}

public enum Fixtures {
  /// The repository's `fixtures/`, found by walking up from this source file —
  /// the same trick the TypeScript loader uses, so neither side needs a copy
  /// of the corpus inside its own target.
  public static let root: URL? = {
    var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
    for _ in 0..<10 {
      let marker = dir.appendingPathComponent("Package.swift")
      if FileManager.default.fileExists(atPath: marker.path) {
        return dir.appendingPathComponent("fixtures")
      }
      let parent = dir.deletingLastPathComponent()
      if parent.path == dir.path { break }
      dir = parent
    }
    return nil
  }()

  /// `load("dates/reset-relative")` reads `fixtures/dates/reset-relative.json`.
  public static func load<Input: Decodable, Expected: Decodable>(
    _ path: String
  ) throws -> FixtureFile<Input, Expected> {
    guard let root else { throw FixtureError.corpusNotFound }
    let file = root.appendingPathComponent("\(path).json")
    guard let data = FileManager.default.contents(atPath: file.path) else {
      throw FixtureError.missing(path)
    }
    let decoded = try JSONDecoder().decode(
      FixtureFile<Input, Expected>.self, from: data
    )
    guard !decoded.cases.isEmpty else { throw FixtureError.noCases(path) }
    return decoded
  }

  /// Every fixture path in the corpus, as `load` takes them. Lets a suite
  /// prove it executes the whole corpus rather than the part it remembered.
  public static func allPaths() throws -> [String] {
    guard let root else { throw FixtureError.corpusNotFound }
    guard
      let walker = FileManager.default.enumerator(
        at: root, includingPropertiesForKeys: nil
      )
    else { return [] }
    var found: [String] = []
    let prefix = root.standardizedFileURL.path + "/"
    for case let url as URL in walker where url.pathExtension == "json" {
      let path = url.standardizedFileURL.path
      guard path.hasPrefix(prefix) else { continue }
      found.append(String(path.dropFirst(prefix.count).dropLast(".json".count)))
    }
    return found.sorted()
  }
}

extension FixtureFile {
  /// The instant standing in for "now". Throws rather than falling back to the
  /// real clock, so a case that depends on it cannot pass by accident.
  public func now() throws -> Date {
    guard let frozenNow else { throw FixtureError.noFrozenNow(about) }
    guard let parsed = Self.parse(frozenNow) else {
      throw FixtureError.badDate(frozenNow)
    }
    return parsed
  }

  /// The zone the cases were written in, which the suite must format in.
  public func zone() throws -> TimeZone {
    guard let timeZone else { return TimeZone(identifier: "UTC")! }
    guard let resolved = TimeZone(identifier: timeZone) else {
      throw FixtureError.unknownTimeZone(timeZone)
    }
    return resolved
  }

  public func date(_ raw: String) throws -> Date {
    guard let parsed = Self.parse(raw) else {
      throw FixtureError.badDate(raw)
    }
    return parsed
  }

  /// The corpus carries both `2026-08-27T11:22:00Z` and
  /// `...T11:22:00.000Z`, and one `ISO8601DateFormatter` will not take both,
  /// so try the fractional form first and fall back.
  private static func parse(_ raw: String) -> Date? {
    let attempts: [ISO8601DateFormatter.Options] = [
      [.withInternetDateTime, .withFractionalSeconds],
      [.withInternetDateTime],
    ]
    for options in attempts {
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = options
      if let parsed = formatter.date(from: raw) { return parsed }
    }
    return nil
  }
}
