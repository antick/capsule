import Foundation

/// Arbitrary JSON, for the one reader that has to walk a shape it does not
/// know: Grok's CLI writes its auth file keyed by sign-in URL, with tokens
/// nested at a depth that has changed between versions.
///
/// Object key order is not preserved — Swift has no ordered dictionary in the
/// standard library — so a walk that finds several candidate tokens visits
/// them in sorted key order rather than document order. The reader below
/// prefers an unexpired token, which is what actually decides the outcome.
public enum JSONValue: Sendable, Equatable {
  case null
  case bool(Bool)
  case number(Double)
  case string(String)
  case array([JSONValue])
  case object([String: JSONValue])

  public var asString: String? {
    if case .string(let value) = self { return value }
    return nil
  }

  public var asDouble: Double? {
    if case .number(let value) = self { return value }
    return nil
  }

  public subscript(key: String) -> JSONValue? {
    if case .object(let fields) = self { return fields[key] }
    return nil
  }
}

extension JSONValue: Decodable {
  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if container.decodeNil() {
      self = .null
    } else if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(Double.self) {
      self = .number(value)
    } else if let value = try? container.decode(String.self) {
      self = .string(value)
    } else if let value = try? container.decode([JSONValue].self) {
      self = .array(value)
    } else {
      self = .object(try container.decode([String: JSONValue].self))
    }
  }

  public static func parse(_ raw: String) -> JSONValue? {
    guard let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(JSONValue.self, from: data)
  }
}
