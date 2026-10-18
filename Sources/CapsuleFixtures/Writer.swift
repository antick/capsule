import Foundation

/// Writes the corpus. The TypeScript that first recorded it is gone, so an
/// expectation that has to change is written back from the Swift suite: run
/// a suite with `CAPSULE_WRITE_FIXTURES=1` and each test that records
/// replaces its file's `expected` values with what it now computes. That
/// rewrites the corpus, so it belongs in a commit a person has read.
///
/// Every file is kept in one layout — sorted keys, two-space indent, a final
/// newline — so a re-recording shows only the values that changed.
public enum FixtureWriter {
  public static var recording: Bool {
    ProcessInfo.processInfo.environment["CAPSULE_WRITE_FIXTURES"] == "1"
  }

  /// Replaces each case's `expected`, in order, with `expected[i]`.
  public static func record<Expected: Encodable>(_ path: String, _ expected: [Expected]) throws {
    var file = try read(path)
    guard case .object(var top) = file, case .array(var cases) = top["cases"] ?? .null,
      cases.count == expected.count
    else { throw FixtureError.noCases(path) }
    for (index, value) in expected.enumerated() {
      guard case .object(var item) = cases[index] else { continue }
      item["expected"] = try JSONDecoder().decode(AnyJSON.self, from: JSONEncoder().encode(value))
      cases[index] = .object(item)
    }
    top["cases"] = .array(cases)
    file = .object(top)
    try write(file, to: path)
  }

  /// Rewrites a file in the corpus's layout without changing what it says.
  public static func canonicalize(_ path: String) throws {
    try write(try read(path), to: path)
  }

  /// Whether a file is already in the corpus's layout.
  public static func isCanonical(_ path: String) throws -> Bool {
    try FileManager.default.contents(atPath: url(path).path) == layout(try read(path))
  }

  static func url(_ path: String) throws -> URL {
    guard let root = Fixtures.root else { throw FixtureError.corpusNotFound }
    return root.appendingPathComponent("\(path).json")
  }

  static func read(_ path: String) throws -> AnyJSON {
    guard let data = FileManager.default.contents(atPath: try url(path).path) else {
      throw FixtureError.missing(path)
    }
    return try JSONDecoder().decode(AnyJSON.self, from: data)
  }

  static func layout(_ value: AnyJSON) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    return try encoder.encode(value) + Data("\n".utf8)
  }

  static func write(_ value: AnyJSON, to path: String) throws {
    try layout(value).write(to: url(path), options: .atomic)
  }
}

/// Any JSON value, for rewriting files whose shape the writer does not know.
enum AnyJSON: Codable, Equatable {
  case null
  case bool(Bool)
  case number(Double)
  case string(String)
  case array([AnyJSON])
  case object([String: AnyJSON])

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if container.decodeNil() {
      self = .null
    } else if let flag = try? container.decode(Bool.self) {
      self = .bool(flag)
    } else if let number = try? container.decode(Double.self) {
      self = .number(number)
    } else if let text = try? container.decode(String.self) {
      self = .string(text)
    } else if let items = try? container.decode([AnyJSON].self) {
      self = .array(items)
    } else {
      self = .object(try container.decode([String: AnyJSON].self))
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .null: try container.encodeNil()
    case .bool(let flag): try container.encode(flag)
    case .number(let number): try container.encode(number)
    case .string(let text): try container.encode(text)
    case .array(let items): try container.encode(items)
    case .object(let fields): try container.encode(fields)
    }
  }
}
