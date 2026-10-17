import Foundation

/// JavaScript's `Math.round`: the nearest integer, with halves going toward
/// +∞. Swift's `.rounded()` sends halves away from zero instead, so the two
/// disagree on every negative half — `Math.round(-2.5)` is `-2`, Swift's is
/// `-3`. Every port of a `Math.round` call goes through this.
///
/// Written as floor-plus-remainder rather than `floor(x + 0.5)`, which gets
/// `0.49999999999999994` wrong: adding the half rounds up in binary first.
public func jsRound(_ value: Double) -> Double {
  guard value.isFinite else { return value }
  let floor = value.rounded(.down)
  return value - floor >= 0.5 ? floor + 1 : floor
}

/// `Number(value.toFixed(2))` for the values the dock actually feeds it.
///
/// `toFixed` rounds the exact binary value and breaks exact ties toward the
/// larger number, where C's `%.2f` breaks them to even. A scale step never
/// lands on an exact tie in the third decimal, so rounding the hundredths the
/// way `Math.round` does gives the same answer; `hud-metrics/clamp-scale`
/// checks that it keeps doing so.
public func jsFixed2(_ value: Double) -> Double {
  jsRound(value * 100) / 100
}

/// `new Date(ms)`: nil where JavaScript would make an Invalid Date. A time
/// value outside ±8.64e15 ms is invalid, and a fractional one is truncated
/// toward zero, as ECMAScript's TimeClip does.
public func jsDate(milliseconds: Double) -> Date? {
  guard milliseconds.isFinite, abs(milliseconds) <= 8.64e15 else { return nil }
  return Date(timeIntervalSince1970: milliseconds.rounded(.towardZero) / 1000)
}

/// `Number.isSafeInteger`.
public func jsIsSafeInteger(_ value: Double) -> Bool {
  value.isFinite && value == value.rounded(.towardZero)
    && abs(value) <= 9_007_199_254_740_991
}

/// `string.slice(0, length)`, which counts UTF-16 code units, not characters.
/// A cut through a surrogate pair cannot survive as a Swift String, so that
/// one case loses the half-character instead of keeping a lone surrogate.
public func jsSlice(_ string: String, _ length: Int) -> String {
  let units = Array(string.utf16.prefix(max(0, length)))
  return String(decoding: units, as: UTF16.self)
}

/// `string.split("\n")`. Splitting a Swift String on the character "\n"
/// leaves "\r\n" whole, because Swift treats the pair as one character;
/// JavaScript splits on the code unit and leaves the "\r" behind.
public func jsLines(_ string: String) -> [String] {
  string.components(separatedBy: "\n")
}

/// JavaScript's `\s`, used to strip markdown and trim a preview.
public func jsIsSpace(_ scalar: Unicode.Scalar) -> Bool {
  scalar.properties.isWhitespace || scalar == "\u{FEFF}"
}

/// `string.trim()`.
public func jsTrim(_ string: String) -> String {
  let scalars = string.unicodeScalars
  guard let first = scalars.firstIndex(where: { !jsIsSpace($0) }),
    let last = scalars.lastIndex(where: { !jsIsSpace($0) })
  else { return "" }
  return String(scalars[first...last])
}

/// `String(value)` for a JSON value, as an id built from it would read.
public func jsString(_ value: JSONValue?) -> String {
  guard let value else { return "undefined" }
  switch value {
  case .null: return "null"
  case .bool(let flag): return flag ? "true" : "false"
  case .string(let text): return text
  case .number(let number):
    if number == number.rounded(.towardZero), abs(number) < 1e21 {
      return String(Int64(number))
    }
    return "\(number)"
  case .array(let items): return items.map { jsString($0) }.joined(separator: ",")
  case .object: return "[object Object]"
  }
}

/// JavaScript truthiness for a JSON value: everything but a missing value,
/// `null`, `false`, `0`, `NaN` and the empty string.
public func jsTruthy(_ value: JSONValue?) -> Bool {
  switch value {
  case .none, .null: return false
  case .bool(let flag): return flag
  case .number(let number): return number != 0 && !number.isNaN
  case .string(let text): return !text.isEmpty
  case .array, .object: return true
  }
}

/// `encodeURIComponent`: everything but A–Z a–z 0–9 and `-_.!~*'()` is
/// percent-encoded as UTF-8.
public func jsEncodeURIComponent(_ string: String) -> String {
  let unreserved = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()".utf8)
  return string.utf8.map { unreserved.contains($0) ? String(UnicodeScalar($0)) : String(format: "%%%02X", $0) }
    .joined()
}

/// `new URLSearchParams(pairs).toString()`: the form encoding, in which a space
/// is `+` and everything but A–Z a–z 0–9 and `*-._` is percent-encoded.
public func formURLEncoded(_ pairs: [(String, String)]) -> String {
  let kept = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789*-._".utf8)
  func encode(_ text: String) -> String {
    text.utf8.map { byte in
      if byte == UInt8(ascii: " ") { return "+" }
      return kept.contains(byte) ? String(UnicodeScalar(byte)) : String(format: "%%%02X", byte)
    }.joined()
  }
  return pairs.map { "\(encode($0.0))=\(encode($0.1))" }.joined(separator: "&")
}

/// `path.join`, for the absolute paths the readers build.
public func joinPath(_ base: String, _ parts: [String]) -> String {
  parts.reduce(base as NSString) { $0.appendingPathComponent($1) as NSString } as String
}
