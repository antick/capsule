import Foundation

/// A response field read the way the original reads provider responses:
/// present and the right type, or nil. A wrong type is not an error, so one
/// odd field cannot cost the rest of the reading.
@propertyWrapper
public struct Lenient<Value: Codable & Sendable & Equatable>: Codable, Sendable, Equatable {
  public var wrappedValue: Value?

  public init(wrappedValue: Value?) {
    self.wrappedValue = wrappedValue
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    wrappedValue = container.decodeNil() ? nil : try? container.decode(Value.self)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    if let wrappedValue { try container.encode(wrappedValue) } else { try container.encodeNil() }
  }
}

/// A list read element by element, keeping the ones that read and dropping
/// the rest, as the original's filters do. Absent or not a list is nil.
@propertyWrapper
public struct LossyArray<Element: Codable & Sendable & Equatable>: Codable, Sendable, Equatable {
  public var wrappedValue: [Element]?

  public init(wrappedValue: [Element]?) {
    self.wrappedValue = wrappedValue
  }

  public init(from decoder: Decoder) throws {
    guard var items = try? decoder.unkeyedContainer() else {
      wrappedValue = nil
      return
    }
    var kept: [Element] = []
    while !items.isAtEnd {
      if let element = try? items.decode(Element.self) {
        kept.append(element)
      } else {
        // A failed decode does not advance the container; step over the
        // element explicitly or the loop never ends.
        _ = try? items.decode(JSONValue.self)
      }
    }
    wrappedValue = kept
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    if let wrappedValue { try container.encode(wrappedValue) } else { try container.encodeNil() }
  }
}

/// A list that is empty when absent or not a list, and keeps the elements
/// that read. For settings a newer build added: an older file has no key.
@propertyWrapper
public struct LossyList<Element: Codable & Sendable & Equatable>: Codable, Sendable, Equatable {
  public var wrappedValue: [Element]

  public init(wrappedValue: [Element]) {
    self.wrappedValue = wrappedValue
  }

  public init(from decoder: Decoder) throws {
    wrappedValue = (try? LossyArray<Element>(from: decoder))?.wrappedValue ?? []
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(wrappedValue)
  }
}

/// A string map that is empty when absent, keeping only the entries whose
/// value is a string.
@propertyWrapper
public struct LossyNames: Codable, Sendable, Equatable {
  public var wrappedValue: [String: String]

  public init(wrappedValue: [String: String]) {
    self.wrappedValue = wrappedValue
  }

  public init(from decoder: Decoder) throws {
    let raw = (try? decoder.singleValueContainer().decode(JSONValue.self))?.asObject ?? [:]
    wrappedValue = raw.compactMapValues(\.asString)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(wrappedValue)
  }
}

extension KeyedDecodingContainer {
  public func decode(_ type: LossyNames.Type, forKey key: Key) throws -> LossyNames {
    (try? decodeIfPresent(type, forKey: key)) ?? LossyNames(wrappedValue: [:])
  }

  public func decode<Element>(_ type: LossyList<Element>.Type, forKey key: Key) throws -> LossyList<Element> {
    (try? decodeIfPresent(type, forKey: key)) ?? LossyList(wrappedValue: [])
  }

  /// An absent key is nil rather than a decoding error.
  public func decode<Value>(_ type: Lenient<Value>.Type, forKey key: Key) throws -> Lenient<Value> {
    (try? decodeIfPresent(type, forKey: key)) ?? Lenient(wrappedValue: nil)
  }

  public func decode<Element>(_ type: LossyArray<Element>.Type, forKey key: Key) throws -> LossyArray<Element> {
    (try? decodeIfPresent(type, forKey: key)) ?? LossyArray(wrappedValue: nil)
  }
}
