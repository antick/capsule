import CapsuleActivity
import CapsuleCore
import Foundation
import Testing

/// Logs in memory, for the scan.
final class LogHost: TokenScanHost, @unchecked Sendable {
  let files: [String: [String]]
  let clock: Date
  init(_ files: [String: [String]], now: Date) {
    self.files = files
    clock = now
  }
  func now() -> Date { clock }
  var homeDir: String { "/h" }
  func listDir(_ dir: String) async -> [String] { [] }
  func readFile(_ path: String) async -> String? { nil }
  var canReadTail: Bool { false }
  func readTail(_ path: String, bytes: Int) async -> String? { nil }
  func modifiedAt(_ path: String) async -> Date? { nil }
  func isProcessAlive(_ pid: Int) async -> Bool { false }
  func processStartedAt(_ pid: Int) async -> Date? { nil }
  func query(_ database: String, _ sql: String) async -> [[String]] { [] }
  func walk(_ dir: String) async -> [LogFile] {
    files.keys.filter { $0.hasPrefix(dir + "/") }.sorted().map {
      LogFile(path: $0, size: Double(files[$0]!.count), modifiedMs: clock.timeIntervalSince1970 * 1000)
    }
  }
  func eachLine(_ path: String, _ onLine: (String) -> Void) async -> Bool {
    guard let lines = files[path] else { return false }
    lines.forEach(onLine)
    return true
  }
  func loadTokenCache() -> [String: TokenFileEntry] { [:] }
  func saveTokenCache(_ cache: [String: TokenFileEntry]) {}
}

@Suite("Spend from the local logs")
struct SpendTests {
  let now = Date(timeIntervalSince1970: 1_800_000_000)
  let prices = PriceTable(["claude-opus-5-5": ModelPrice(input: 4e-6, output: 2e-5, cacheWrite: 5e-6, cacheRead: 2e-7),
                           "gpt-6.1-sol": ModelPrice(input: 2e-6, output: 1e-5, cacheRead: 1e-7)])
  var stamp: String { isoString(now.addingTimeInterval(-60)) }

  func claude(_ id: String, output: Int, model: String = "claude-opus-5-5") -> String {
    #"{"timestamp":"\#(stamp)","requestId":"r-\#(id)","message":{"id":"\#(id)","model":"\#(model)","usage":{"input_tokens":1000,"output_tokens":\#(output),"cache_read_input_tokens":10000,"cache_creation_input_tokens":2000,"cache_creation":{"ephemeral_5m_input_tokens":1500,"ephemeral_1h_input_tokens":500}}}}"#
  }

  @Test func aClaudeRowIsPricedWithTheCacheSplit() throws {
    let row = try #require(claudeRowUsage(JSONValue.parse(claude("m1", output: 500))!, prices: prices))
    // 1000·4e-6 + 500·2e-5 + 1500·5e-6 + 500·(4e-6·2) + 10000·2e-7
    #expect(abs((row.cost ?? 0) - 0.0275) < 1e-9)
    #expect(row.key == "m1|r-m1")
    let unknown = try #require(claudeRowUsage(JSONValue.parse(claude("m2", output: 1, model: "mystery"))!, prices: prices))
    #expect(unknown.cost == nil && unknown.unpriced)
  }

  @Test func aStreamedMessageCountsOnceAsItsFinalCopy() async {
    let host = LogHost(["/h/p/a.jsonl": [claude("m1", output: 10), claude("m1", output: 500), claude("m3", output: 500)]], now: now)
    var cache: [String: TokenFileEntry] = [:]
    let totals = await scanLogs(host, root: "/h/p", cache: &cache, now: now, priced: true) {
      { claudeRowUsage($0, prices: self.prices) }
    }
    let today = dayKey(now)
    #expect(totals.days[today] == 27_000.0)
    #expect(abs((totals.cost[today] ?? 0) - 0.055) < 1e-9)
  }

  @Test func aCodexChildCountsNothingFromItsParentsReplay() {
    let reader = CodexRowReader(prices: prices)
    func row(_ json: String) -> TokenRow? { reader.read(JSONValue.parse(json)!) }
    #expect(row(#"{"timestamp":"2027-01-15T07:00:00Z","type":"session_meta","payload":{"forked_from_id":"p1"}}"#) == nil)
    #expect(row(#"{"timestamp":"2027-01-15T07:00:01Z","type":"turn_context","payload":{"model":"gpt-6.1-sol"}}"#) == nil)
    // The parent's history, replayed: moves the totals, counts nothing.
    #expect(row(#"{"timestamp":"2027-01-15T06:00:00Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":900000,"output_tokens":100000}}}}"#) == nil)
    #expect(row(#"{"timestamp":"2027-01-15T07:00:02Z","type":"event_msg","payload":{"type":"task_started","started_at":1800000000}}"#) == nil)
    // The child's own turn.
    let own = row(#"{"timestamp":"2027-01-15T07:00:03Z","type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":1000,"cached_input_tokens":400,"output_tokens":200},"total_token_usage":{"input_tokens":901000,"output_tokens":100200}}}}"#)
    // 600·2e-6 + 400·1e-7 + 200·1e-5
    #expect(abs((own?.cost ?? 0) - 0.00324) < 1e-9)
    #expect(own?.tokens == 1200)
  }

  @Test func aGrokTurnUsesTheCostItRecorded() throws {
    let line =
      #"{"timestamp":1800000000000,"params":{"update":{"sessionUpdate":"turn_completed","usage":{"inputTokens":300,"outputTokens":50,"costUsdTicks":12700000000}},"_meta":{"eventId":"e1","agentTimestampMs":1800000000000}}}"#
    let row = try #require(grokRowUsage(JSONValue.parse(line)!))
    #expect(row.cost == 1.27 && row.tokens == 350 && row.key == "e1")
  }

  @Test func pricesMatchTheWayLogsNameModels() throws {
    let table = PriceTable.bundled
    #expect(table.price(for: "anthropic/claude-opus-5-5") != nil)
    #expect(table.price(for: "claude-sonnet-5-20261001") != nil)
    #expect(table.price(for: "gpt-6-1-sol") != nil)
    #expect(table.price(for: "codex-auto-review") == nil)
    let litellm = #"{"azure/m-1":{"input_cost_per_token":9,"output_cost_per_token":9},"m-1":{"input_cost_per_token":1,"output_cost_per_token":2},"sample_spec":{"x":1}}"#
    let parsed = try #require(PriceTable.parseLiteLLM(Data(litellm.utf8)))
    #expect(parsed.price(for: "m-1") == ModelPrice(input: 1, output: 2))
  }
}
