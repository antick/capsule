import CapsuleActivity
import CapsuleCore
import CapsuleFixtures
import Foundation
import Testing

/// A log line as the corpus writes it: the text, or a character repeated.
enum LogLine: Decodable {
  case text(String)
  case repeated(String, Int)

  private struct Repeat: Decodable {
    let `repeat`: String
    let count: Int
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if let text = try? c.decode(String.self) {
      self = .text(text)
    } else {
      let spec = try c.decode(Repeat.self)
      self = .repeated(spec.repeat, spec.count)
    }
  }

  var expanded: String {
    switch self {
    case .text(let text): return text
    case .repeated(let unit, let count): return String(repeating: unit, count: count)
    }
  }
}

struct WorldLog: Decodable {
  let path: String
  let size: Double
  let modifiedMs: Double
  let lines: [LogLine]?
}

struct WorldStep: Decodable {
  let op: String
  let pid: Int?
  let log: WorldLog?
}

struct MachineWorld: Decodable {
  struct Scan: Decodable {
    let root: String
    let parser: String
    let cache: [String: TokenFileEntry]
  }

  let home: String
  let now: String
  let files: [String: String]
  let dirs: [String: [String]]
  let modified: [String: String]
  let processes: [String: String?]
  let queries: [String: [[String]]]
  let readTail: Bool
  let logs: [WorldLog]?
  let cache: [String: TokenFileEntry]?
  let enabled: [ProviderId]?
  let scan: Scan?
  let steps: [WorldStep]?
}

struct AskedQuery: Decodable, Equatable {
  let db: String
  let sql: String
}

/// The stub machine: answers from the world and remembers every query, tail
/// read and line-by-line read.
final class StubMachine: TokenScanHost, @unchecked Sendable {
  private let world: MachineWorld
  private let lock = NSLock()
  private var _logs: [WorldLog]
  private var _processes: [String: String?]
  private(set) var asked: [AskedQuery] = []
  private(set) var tails: [String] = []
  private(set) var reads: [String] = []
  private(set) var saved: [String: TokenFileEntry]?

  init(_ world: MachineWorld) {
    self.world = world
    _logs = world.logs ?? []
    _processes = world.processes
  }

  func kill(_ pid: Int) { lock.withLock { _processes[String(pid)] = nil } }
  func add(_ log: WorldLog) { lock.withLock { _logs.append(log) } }
  func clearReads() { lock.withLock { reads = [] } }

  func now() -> Date { looseDate(world.now)! }
  var homeDir: String { world.home }
  func listDir(_ dir: String) async -> [String] { world.dirs[dir] ?? [] }
  func readFile(_ path: String) async -> String? { world.files[path] }
  var canReadTail: Bool { world.readTail }

  func readTail(_ path: String, bytes: Int) async -> String? {
    lock.withLock { tails.append(path) }
    return world.files[path].map { String($0.suffix(bytes)) }
  }

  func modifiedAt(_ path: String) async -> Date? { world.modified[path].flatMap(looseDate) }
  func isProcessAlive(_ pid: Int) async -> Bool { lock.withLock { _processes.keys.contains(String(pid)) } }
  func processStartedAt(_ pid: Int) async -> Date? {
    lock.withLock { _processes[String(pid)] ?? nil }.flatMap(looseDate)
  }

  func query(_ database: String, _ sql: String) async -> [[String]] {
    lock.withLock { asked.append(AskedQuery(db: database, sql: sql)) }
    return world.queries[database] ?? []
  }

  func walk(_ dir: String) async -> [LogFile] {
    lock.withLock { _logs }.filter { $0.path.hasPrefix("\(dir)/") }
      .map { LogFile(path: $0.path, size: $0.size, modifiedMs: $0.modifiedMs) }
  }

  func eachLine(_ path: String, _ onLine: (String) -> Void) async -> Bool {
    let log = lock.withLock {
      reads.append(path)
      return _logs.first { $0.path == path }
    }
    guard let lines = log?.lines else { return false }
    for line in lines { onLine(line.expanded) }
    return true
  }

  func loadTokenCache() -> [String: TokenFileEntry] { world.cache ?? [:] }
  func saveTokenCache(_ cache: [String: TokenFileEntry]) { lock.withLock { saved = cache } }
}

struct ReaderExpected: Decodable {
  let sessions: [AgentSession]
  let queries: [AskedQuery]
  let tails: [String]
}

struct ScanExpected: Decodable {
  let days: DayHistogram
  let touched: [String]
  let read: [String]
  let cache: [String: TokenFileEntry]
}

struct ScannerStep: Decodable, Equatable {
  let op: String
  let published: [ProviderId: TokenUsage]?
  let tokens: [ProviderId: TokenUsage]
  let read: [String]
  let saved: [String: TokenFileEntry]?
}

struct MonitorStep: Decodable, Equatable {
  let op: String
  let published: [ProviderId: [AgentSession]]?
  let activity: [ProviderId: [AgentSession]]
  let busy: Bool
}

/// Something one callback writes and a test reads after.
final class Box<Value>: @unchecked Sendable {
  private let lock = NSLock()
  private var value: Value
  init(_ value: Value) { self.value = value }
  var current: Value {
    get { lock.withLock { value } }
    set { lock.withLock { value = newValue } }
  }
}

@Suite("Activity readers against a stub machine, from the shared corpus")
struct ReaderTests {
  private func check(
    _ path: String, _ read: (ActivityHost) async -> [AgentSession]
  ) async throws {
    let file: FixtureFile<MachineWorld, ReaderExpected> = try Fixtures.load(path)
    for testCase in file.cases {
      let machine = StubMachine(testCase.input)
      let sessions = await read(machine)
      #expect(sessions == testCase.expected.sessions, "\(testCase.name): sessions")
      #expect(machine.asked == testCase.expected.queries, "\(testCase.name): queries")
      #expect(machine.tails == testCase.expected.tails, "\(testCase.name): tails")
    }
  }

  @Test("readClaudeSessions") func claude() async throws {
    try await check("activity/claude-reader", readClaudeSessions)
  }

  @Test("readCodexSessions") func codex() async throws {
    try await check("activity/codex-reader", readCodexSessions)
  }

  @Test("readGrokSessions") func grok() async throws {
    try await check("activity/grok-reader", readGrokSessions)
  }

  @Test("scanTokenLogs")
  func scan() async throws {
    let file: FixtureFile<MachineWorld, ScanExpected> = try Fixtures.load("activity/token-scan")
    let zone = try file.zone()
    for testCase in file.cases {
      let machine = StubMachine(testCase.input)
      let scan = try #require(testCase.input.scan)
      var cache = scan.cache
      let parser: () -> TokenRowParser
      if scan.parser == "claude" {
        parser = { claudeRowTokens }
      } else {
        parser = {
          var previous = 0.0
          return { row in codexRowTokens(row, previous: &previous) }
        }
      }
      let (days, touched) = await scanTokenLogs(
        machine, root: scan.root, cache: &cache, now: machine.now(), timeZone: zone, parser: parser
      )
      #expect(days == testCase.expected.days, "\(testCase.name): days")
      #expect(touched == testCase.expected.touched, "\(testCase.name): touched")
      #expect(machine.reads == testCase.expected.read, "\(testCase.name): read")
      #expect(cache == testCase.expected.cache, "\(testCase.name): cache")
    }
  }

  @Test("the token scanner over successive rescans")
  func scanner() async throws {
    let file: FixtureFile<MachineWorld, [ScannerStep]> = try Fixtures.load("activity/token-scanner")
    let zone = try file.zone()
    for testCase in file.cases {
      let machine = StubMachine(testCase.input)
      let published = Box<[ProviderId: TokenUsage]?>(nil)
      let enabled = testCase.input.enabled ?? []
      let scanner = TokenScanner(
        host: machine, enabled: { enabled }, onChange: { published.current = $0 }, timeZone: zone
      )
      var after: [ScannerStep] = []
      for step in testCase.input.steps ?? [] {
        published.current = nil
        machine.clearReads()
        if step.op == "addLog", let log = step.log { machine.add(log) }
        if step.op == "rescan" { await scanner.rescan() }
        after.append(
          ScannerStep(
            op: step.op, published: published.current, tokens: await scanner.tokens,
            read: machine.reads, saved: machine.saved
          )
        )
      }
      #expect(after == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("the activity monitor over successive rescans")
  func monitor() async throws {
    let file: FixtureFile<MachineWorld, [MonitorStep]> = try Fixtures.load("activity/monitor")
    for testCase in file.cases {
      let machine = StubMachine(testCase.input)
      let published = Box<[ProviderId: [AgentSession]]?>(nil)
      let enabled = testCase.input.enabled ?? []
      let monitor = ActivityMonitor(host: machine, enabled: { enabled }, onChange: { published.current = $0 })
      var after: [MonitorStep] = []
      for step in testCase.input.steps ?? [] {
        published.current = nil
        if step.op == "kill", let pid = step.pid { machine.kill(pid) }
        if step.op == "rescan" { await monitor.rescan() }
        after.append(
          MonitorStep(
            op: step.op, published: published.current, activity: await monitor.activity,
            busy: await monitor.isBusy
          )
        )
      }
      #expect(after == testCase.expected, "\(testCase.name)")
    }
  }
}
