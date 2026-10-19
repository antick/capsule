import CapsuleCore
import Foundation

private func count(_ value: JSONValue?) -> Double {
  guard let number = value?.asDouble, number.isFinite else { return 0 }
  return max(0, number)
}

/// A Codex turn's counts. Input includes the cached part; output includes
/// reasoning, which is never added again.
private struct CodexCounts: Equatable {
  var input: Double
  var cached: Double
  var output: Double

  init(_ json: JSONValue?) {
    input = count(json?["input_tokens"])
    cached = count(json?["cached_input_tokens"])
    output = count(json?["output_tokens"])
  }

  init(input: Double, cached: Double, output: Double) {
    self.input = input
    self.cached = cached
    self.output = output
  }

  func minus(_ earlier: CodexCounts?) -> CodexCounts {
    guard let earlier else { return self }
    return CodexCounts(
      input: max(0, input - earlier.input), cached: max(0, cached - earlier.cached),
      output: max(0, output - earlier.output))
  }

  var isEmpty: Bool { input <= 0 && cached <= 0 && output <= 0 }
}

/// Reads one Codex rollout row by row: tokens as the running totals move,
/// and, given prices, each turn's cost at the model it ran on.
///
/// A subagent's or fork's rollout first replays its parent's history. Those
/// rows still move the running totals, but nothing in them counts until the
/// child's own first turn starts.
public final class CodexRowReader {
  private let prices: PriceTable?
  private var previous = 0.0
  private var model: String?
  private var sawSessionMeta = false
  /// While replaying: the child's creation time, in seconds.
  private var replayUntil: Double?
  private var lastTotals: CodexCounts?

  public init(prices: PriceTable?) { self.prices = prices }

  public func read(_ row: JSONValue) -> TokenRow? {
    guard let record = row.asObject else { return nil }
    let type = record["type"]?.asString
    let payload = record["payload"]
    if type == "turn_context" {
      if let name = payload?["model"]?.asString, !name.isEmpty { model = name }
      return nil
    }
    if type == "session_meta" {
      if !sawSessionMeta, let meta = payload, Self.isChild(meta) {
        replayUntil = looseDate(record["timestamp"]?.asString ?? "")?.timeIntervalSince1970.rounded(.down) ?? 0
      }
      sawSessionMeta = true
      return nil
    }
    if payload?["type"]?.asString == "task_started" {
      if let gate = replayUntil, let started = payload?["started_at"]?.asDouble, started >= gate { replayUntil = nil }
      return nil
    }
    var tokens = codexRowTokens(row, previous: &previous)
    guard payload?["type"]?.asString == "token_count" else { return tokens }
    let info = payload?["info"]
    let totals = info?["total_token_usage"].map { CodexCounts($0) }
    if replayUntil != nil {
      if let totals { lastTotals = totals }
      return nil
    }
    guard let prices else { return tokens }
    if let totals, let last = lastTotals, totals == last { return tokens }
    let turn = info?["last_token_usage"].map { CodexCounts($0) } ?? totals?.minus(lastTotals)
    if let totals { lastTotals = totals }
    guard let turn, !turn.isEmpty else { return tokens }
    let at = tokens?.at ?? looseDate(record["timestamp"]?.asString ?? "")
    guard let at else { return tokens }
    var hit = tokens ?? TokenRow(at: at, tokens: 0)
    if let price = prices.price(for: model ?? TokenTuning.codexDefaultModel) {
      let cached = min(turn.cached, turn.input)
      hit.cost = requestCost(price, input: turn.input - cached, output: turn.output, cacheRead: cached)
    } else {
      hit.unpriced = true
    }
    tokens = hit
    return tokens
  }

  /// A subagent's or fork's rollout, by what its first metadata row says.
  static func isChild(_ meta: JSONValue) -> Bool {
    func present(_ value: JSONValue?) -> Bool {
      switch value {
      case nil, .null?: return false
      case .string(let text)?: return !jsTrim(text).isEmpty
      default: return true
      }
    }
    return present(meta["forked_from_id"]) || present(meta["parent_thread_id"])
      || meta["thread_source"]?.asString == "subagent" || present(meta["source"]?["subagent"])
  }
}

/// A Grok turn: its tokens, and the cost Grok wrote down for it.
public func grokRowUsage(_ row: JSONValue) -> TokenRow? {
  guard let update = row["params"]?["update"], update["sessionUpdate"]?.asString == "turn_completed",
    let usage = update["usage"]
  else { return nil }
  let meta = row["params"]?["_meta"]
  let stamp = meta?["agentTimestampMs"]?.asDouble ?? row["timestamp"]?.asDouble
  guard let stamp, stamp.isFinite else { return nil }
  guard let at = jsDate(milliseconds: stamp > 1e11 ? stamp : stamp * 1000) else { return nil }
  let tokens = count(usage["inputTokens"]) + count(usage["outputTokens"])
  var ticks = usage["costUsdTicks"]?.asDouble
  if ticks == nil, let models = usage["modelUsage"]?.asObject {
    ticks = models.values.compactMap { $0["costUsdTicks"]?.asDouble }.reduce(0, +)
  }
  guard tokens > 0 || (ticks ?? 0) > 0 else { return nil }
  return TokenRow(
    at: at, tokens: tokens, key: meta?["eventId"]?.asString,
    cost: ticks.map { max(0, $0) / TokenTuning.grokTicksPerDollar })
}
