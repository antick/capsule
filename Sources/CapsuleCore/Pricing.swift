import Foundation

/// A model's list price, in dollars per token.
public struct ModelPrice: Sendable, Codable, Equatable {
  public var input: Double
  public var output: Double
  /// Writing to the prompt cache, five-minute lifetime.
  public var cacheWrite: Double
  public var cacheRead: Double

  public init(input: Double, output: Double, cacheWrite: Double? = nil, cacheRead: Double? = nil) {
    self.input = input
    self.output = output
    self.cacheWrite = cacheWrite ?? input
    self.cacheRead = cacheRead ?? input * PricingRules.defaultCacheReadShare
  }
}

public enum PricingRules {
  /// Where prices come from: LiteLLM's public table, refreshed daily.
  public static let sourceURL =
    "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
  public static let refreshSeconds = 24 * 3_600.0
  /// A cache read is a tenth of input where the table gives no price.
  public static let defaultCacheReadShare = 0.1
  /// A one-hour cache write costs twice the input rate.
  public static let longCacheWriteMultiplier = 2.0
  public static let pricesFile = "model-prices.json"
}

/// Prices by model name, matched the way logs name models: provider
/// prefixes, date stamps and speed suffixes are ignored.
public struct PriceTable: Sendable, Codable, Equatable {
  /// Keyed by normalized name: lowercased, dots as dashes, so `gpt-6.1-sol`
  /// and `gpt-6-1-sol` are one model.
  public var prices: [String: ModelPrice]

  public init(_ prices: [String: ModelPrice]) {
    self.prices = Dictionary(prices.map { (Self.normalized($0.key), $0.value) }) { first, _ in first }
  }

  /// A table saved by an older build is normalized as it is read.
  public init(from decoder: Decoder) throws {
    struct Raw: Decodable { var prices: [String: ModelPrice] }
    self.init(try Raw(from: decoder).prices)
  }

  static func normalized(_ name: String) -> String { name.lowercased().replacingOccurrences(of: ".", with: "-") }

  /// Adds another table's prices over these.
  public mutating func merge(_ other: PriceTable) {
    prices.merge(other.prices) { _, newer in newer }
  }

  /// The price for a model as a log names it, or nil if it is not known.
  public func price(for model: String) -> ModelPrice? {
    for candidate in Self.candidates(model) {
      if let price = prices[candidate] { return price }
    }
    return nil
  }

  /// `anthropic/claude-opus-5-20260101-fast` → `claude-opus-5-20260101-fast`,
  /// `claude-opus-5-20260101`, `claude-opus-5`, and dot/dash spellings.
  static func candidates(_ model: String) -> [String] {
    var name = jsTrim(model).lowercased()
    if let slash = name.lastIndex(of: "/") { name = String(name[name.index(after: slash)...]) }
    var names = [name]
    for suffix in ["-fast", "-priority"] where name.hasSuffix(suffix) {
      name = String(name.dropLast(suffix.count))
      names.append(name)
    }
    if let range = name.range(of: #"-\d{8}$"#, options: .regularExpression) {
      name = String(name[..<range.lowerBound])
      names.append(name)
    }
    return names.map(normalized).reduce(into: []) { kept, next in if !kept.contains(next) { kept.append(next) } }
  }

  /// The models in LiteLLM's table that carry token prices. A bare name
  /// wins over a provider-prefixed one; the first prefixed one fills in.
  public static func parseLiteLLM(_ data: Data) -> PriceTable? {
    guard let text = String(data: data, encoding: .utf8), let root = JSONValue.parse(text)?.asObject else {
      return nil
    }
    var prices: [String: ModelPrice] = [:]
    var bare: Set<String> = []
    for (key, entry) in root.sorted(by: { $0.key < $1.key }) {
      guard let input = entry["input_cost_per_token"]?.asDouble, let output = entry["output_cost_per_token"]?.asDouble
      else { continue }
      let name = normalized(key.split(separator: "/").last.map(String.init) ?? key)
      let isBare = !key.contains("/")
      guard prices[name] == nil || (isBare && !bare.contains(name)) else { continue }
      if isBare { bare.insert(name) }
      prices[name] = ModelPrice(
        input: input, output: output, cacheWrite: entry["cache_creation_input_token_cost"]?.asDouble,
        cacheRead: entry["cache_read_input_token_cost"]?.asDouble)
    }
    return prices.isEmpty ? nil : PriceTable(prices)
  }

  /// What ships with the app, for before the first download and offline.
  /// From LiteLLM's table on 2026-10-19.
  public static let bundled = PriceTable([
    "claude-opus-5-5": ModelPrice(input: 4e-6, output: 2e-5, cacheWrite: 5e-6, cacheRead: 2e-7),
    "claude-opus-5": ModelPrice(input: 5e-6, output: 2.5e-5, cacheWrite: 6.25e-6, cacheRead: 5e-7),
    "claude-fable-5-1": ModelPrice(input: 1e-5, output: 5e-5, cacheWrite: 1.25e-5, cacheRead: 2.5e-7),
    "claude-sonnet-5-5": ModelPrice(input: 2e-6, output: 1e-5, cacheWrite: 2.5e-6, cacheRead: 1e-7),
    "claude-sonnet-5": ModelPrice(input: 2e-6, output: 1e-5, cacheWrite: 2.5e-6, cacheRead: 2e-7),
    "gpt-6-astra": ModelPrice(input: 1e-5, output: 5e-5, cacheWrite: 1.25e-5, cacheRead: 1e-6),
    "gpt-6.1-sol": ModelPrice(input: 2e-6, output: 1e-5, cacheWrite: 2.5e-6, cacheRead: 1e-7),
    "gpt-6-luna": ModelPrice(input: 1e-7, output: 5e-7, cacheWrite: 1.25e-7, cacheRead: 1e-8),
  ])
}

/// What one request cost at list price.
public func requestCost(
  _ price: ModelPrice, input: Double, output: Double, cacheWrite: Double = 0, cacheWriteLong: Double = 0,
  cacheRead: Double = 0
) -> Double {
  input * price.input + output * price.output + cacheWrite * price.cacheWrite
    + cacheWriteLong * price.input * PricingRules.longCacheWriteMultiplier + cacheRead * price.cacheRead
}
