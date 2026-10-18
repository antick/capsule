import CapsuleCore
import CapsuleFixtures
import CapsuleUsage
import Foundation
import Testing

enum ScriptedOutcome: Decodable {
  case snapshot(UsageSnapshot, thenEnable: [ProviderId]?)
  case rateLimited(retryAfterMs: Int?, fallback: UsageSnapshot?)
  case failed

  private enum Keys: String, CodingKey { case snapshot, thenEnable, rateLimited, failed }
  private struct Refusal: Decodable {
    let retryAfterMs: Int?
    let fallback: UsageSnapshot?
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    if let snapshot = try c.decodeIfPresent(UsageSnapshot.self, forKey: .snapshot) {
      self = .snapshot(snapshot, thenEnable: try c.decodeIfPresent([ProviderId].self, forKey: .thenEnable))
    } else if let refusal = try c.decodeIfPresent(Refusal.self, forKey: .rateLimited) {
      self = .rateLimited(retryAfterMs: refusal.retryAfterMs, fallback: refusal.fallback)
    } else {
      self = .failed
    }
  }
}

struct PollerStep: Decodable {
  let op: String
  let id: ProviderId?
  let ms: Double?
  let ids: [ProviderId]?
  let busy: Bool?
}

struct PollerScenario: Decodable {
  struct Settings: Decodable {
    let enabled: [ProviderId]
    let pollIntervalMs: Int
  }

  let now: String
  let settings: Settings
  let busy: Bool
  let idleIntervalMs: Double?
  let remembered: [UsageSnapshot]?
  let backoff: [String: Double]?
  let outcomes: [ProviderId: [ScriptedOutcome]]
  let steps: [PollerStep]
}

struct PollerStepExpected: Decodable, Equatable {
  let op: String
  let fetched: [ProviderId]
  let emitted: [[UsageSnapshot]]
  let snapshots: [UsageSnapshot]
  let backoff: [String: Double]?
  let saved: [UsageSnapshot]?
}

/// Everything the scripted world tracks, behind one lock.
final class ScriptState: @unchecked Sendable {
  private let lock = NSLock()
  private var _clock: Double
  private var _enabled: [ProviderId]
  private var _busy: Bool
  private var calls: [ProviderId: Int] = [:]
  private(set) var fetched: [ProviderId] = []
  private(set) var emitted: [[UsageSnapshot]] = []
  private(set) var savedBackoff: [String: Double]?
  private(set) var savedSnapshots: [UsageSnapshot]?
  private(set) var unscripted: [String] = []

  init(clock: Double, enabled: [ProviderId], busy: Bool) {
    _clock = clock
    _enabled = enabled
    _busy = busy
  }

  var clock: Double {
    get { lock.withLock { _clock } }
    set { lock.withLock { _clock = newValue } }
  }
  var enabled: [ProviderId] {
    get { lock.withLock { _enabled } }
    set { lock.withLock { _enabled = newValue } }
  }
  var busy: Bool {
    get { lock.withLock { _busy } }
    set { lock.withLock { _busy = newValue } }
  }

  func call(_ id: ProviderId) -> Int {
    lock.withLock {
      fetched.append(id)
      let index = calls[id] ?? 0
      calls[id] = index + 1
      return index
    }
  }
  func miss(_ what: String) { lock.withLock { unscripted.append(what) } }
  func emit(_ list: [UsageSnapshot]) { lock.withLock { emitted.append(list) } }
  func saveBackoff(_ until: [String: Double]) { lock.withLock { savedBackoff = until } }
  func saveSnapshots(_ list: [UsageSnapshot]) { lock.withLock { savedSnapshots = list } }
  func beginStep() { lock.withLock { fetched = []; emitted = [] } }
}

struct ScriptedProvider: UsageProvider {
  let id: ProviderId
  let outcomes: [ScriptedOutcome]
  let state: ScriptState

  func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    let index = state.call(id)
    guard index < outcomes.count else {
      state.miss("call \(index + 1) to \(id.rawValue)")
      throw UsageReadError.unreadable(id)
    }
    switch outcomes[index] {
    case .snapshot(let snapshot, let thenEnable):
      if let thenEnable { state.enabled = thenEnable }
      return snapshot
    case .rateLimited(let retryAfterMs, let fallback):
      throw RateLimited(retryAfterMs: retryAfterMs, fallback: fallback)
    case .failed:
      throw UsageReadError.http(id, 500)
    }
  }
}

/// The poller never touches the network itself; its providers do.
struct UnusedHost: UsageHost {
  var homeDir: String { "/home" }
  func send(_ request: HTTPRequest) async throws -> HTTPResponse { throw URLError(.unsupportedURL) }
  func readFile(_ path: String) async -> String? { nil }
  func readSecret(_ service: String) async -> String? { nil }
  func runCommand(_ file: String, _ arguments: [String]) async -> String? { nil }
  func query(_ database: String, _ sql: String) async -> [[String]] { [] }
  func environment(_ name: String) -> String? { nil }
}

struct ScriptedPollerHost: PollerHost {
  let state: ScriptState
  let backoff: [String: Double]
  let remembered: [UsageSnapshot]
  var usage: UsageHost { UnusedHost() }
  func now() -> Date { Date(timeIntervalSince1970: state.clock / 1000) }
  func loadBackoff() -> [String: Double] { backoff }
  func saveBackoff(_ until: [String: Double]) { state.saveBackoff(until) }
  func loadSnapshots() -> [UsageSnapshot] { remembered }
  func saveSnapshots(_ snapshots: [UsageSnapshot]) { state.saveSnapshots(snapshots) }
}

@Suite("The poller, against the shared corpus")
struct PollerTests {
  @Test("driven through each scenario's steps")
  func scenarios() async throws {
    let file: FixtureFile<PollerScenario, [PollerStepExpected]> = try Fixtures.load("usage/poller")
    for testCase in file.cases {
      let scenario = testCase.input
      let start = try #require(looseDate(scenario.now))
      let state = ScriptState(
        clock: start.timeIntervalSince1970 * 1000, enabled: scenario.settings.enabled, busy: scenario.busy
      )
      let providers = ProviderId.allCases.map {
        ScriptedProvider(id: $0, outcomes: scenario.outcomes[$0] ?? [], state: state)
      }
      let interval = scenario.settings.pollIntervalMs
      let poller = UsagePoller(
        providers: providers,
        host: ScriptedPollerHost(
          state: state, backoff: scenario.backoff ?? [:], remembered: scenario.remembered ?? []
        ),
        settings: {
          var settings = CapsuleSettings.defaults
          settings.enabledProviderIds = state.enabled
          settings.pollIntervalMs = interval
          return settings
        },
        onChange: { state.emit($0) },
        isBusy: { state.busy },
        idleIntervalMs: scenario.idleIntervalMs ?? PollerTuning.idleIntervalMs
      )

      var after: [PollerStepExpected] = []
      for step in scenario.steps {
        state.beginStep()
        switch step.op {
        case "start": await poller.start()
        case "refresh": await poller.refresh()
        case "refreshProvider": await poller.refreshProvider(try #require(step.id))
        case "tick": await poller.tick()
        case "resume": await poller.resume()
        case "online": await poller.online()
        case "sync": await poller.sync()
        case "advance": state.clock += try #require(step.ms)
        case "setEnabled": state.enabled = try #require(step.ids)
        case "setBusy": state.busy = try #require(step.busy)
        default: Issue.record("unknown step \(step.op)")
        }
        after.append(
          PollerStepExpected(
            op: step.op, fetched: state.fetched, emitted: state.emitted,
            snapshots: await poller.snapshots, backoff: state.savedBackoff, saved: state.savedSnapshots
          )
        )
      }
      #expect(state.unscripted.isEmpty, "\(testCase.name): unscripted \(state.unscripted)")
      #expect(after.count == testCase.expected.count, "\(testCase.name): step count")
      for (index, (actual, expected)) in zip(after, testCase.expected).enumerated() {
        #expect(actual.fetched == expected.fetched, "\(testCase.name) step \(index) \(expected.op): fetched")
        #expect(actual.emitted == expected.emitted, "\(testCase.name) step \(index) \(expected.op): emitted")
        #expect(actual.snapshots == expected.snapshots, "\(testCase.name) step \(index) \(expected.op): snapshots")
        #expect(actual.backoff == expected.backoff, "\(testCase.name) step \(index) \(expected.op): backoff")
        #expect(actual.saved == expected.saved, "\(testCase.name) step \(index) \(expected.op): saved")
      }
    }
  }

  /// The corpus cannot record a hang, so the corrected rule is pinned here:
  /// with nothing enabled, a refresh settles instead of queueing another.
  @Test("a poller with nothing enabled settles")
  func nothingEnabled() async throws {
    let state = ScriptState(clock: 0, enabled: [], busy: true)
    let poller = UsagePoller(
      providers: ProviderId.allCases.map { ScriptedProvider(id: $0, outcomes: [], state: state) },
      host: ScriptedPollerHost(state: state, backoff: [:], remembered: []),
      settings: {
        var settings = CapsuleSettings.defaults
        settings.enabledProviderIds = []
        return settings
      },
      onChange: { state.emit($0) }
    )
    await poller.refresh()
    #expect(state.fetched.isEmpty)
    #expect(state.emitted.count < 10, "emitted \(state.emitted.count) times")
    #expect(await poller.snapshots.map(\.providerId) == SettingsDefaults.enabledProviderIds)
  }
}

@Suite("Poller with a provider it cannot read")
struct UnreadableProviderTests {
  /// Demo mode reads Claude, Codex and Grok; Cursor switched on has no reader.
  @Test func anEnabledProviderWithNoReaderNeitherLoopsNorSpins() async {
    var settings = CapsuleSettings.defaults
    settings.enabledProviderIds = [.claude, .codex, .grok, .cursor]
    let frozen = settings
    let reads = Counter()
    let poller = UsagePoller(
      providers: [ProviderId.claude, .codex, .grok].map { CountingProvider(id: $0, reads: reads) },
      host: StubPollerHost(),
      settings: { frozen },
      onChange: { _ in }
    )
    // As the app starts it: placeholders first, then the first read.
    await poller.start()
    // One pass: three reads, not a refresh queued after every refresh.
    #expect(await reads.value == 3)
    let snapshots = await poller.snapshots
    #expect(snapshots.map(\.providerId) == [.claude, .codex, .grok, .cursor])
    #expect(snapshots.allSatisfy { $0.refreshing != true })
  }
}

actor Counter {
  private(set) var value = 0
  func bump() { value += 1 }
}

struct CountingProvider: UsageProvider {
  let id: ProviderId
  let reads: Counter

  func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    await reads.bump()
    return UsageSnapshot(
      providerId: id, displayName: ProviderLabels.label(id), iconId: id, primaryPercent: 10, buckets: [],
      status: .ok, fetchedAt: isoString(now))
  }
}

struct StubPollerHost: PollerHost {
  struct NoNetwork: UsageHost {
    var homeDir: String { "/nonexistent" }
    func send(_ request: HTTPRequest) async throws -> HTTPResponse { throw URLError(.notConnectedToInternet) }
    func readFile(_ path: String) async -> String? { nil }
    func readSecret(_ service: String) async -> String? { nil }
    func runCommand(_ file: String, _ arguments: [String]) async -> String? { nil }
    func query(_ database: String, _ sql: String) async -> [[String]] { [] }
    func environment(_ name: String) -> String? { nil }
  }

  var usage: UsageHost { NoNetwork() }
  func now() -> Date { Date(timeIntervalSince1970: 1_800_000_000) }
  func loadBackoff() -> [String: Double] { [:] }
  func saveBackoff(_ until: [String: Double]) {}
  func loadSnapshots() -> [UsageSnapshot] { [] }
  func saveSnapshots(_ snapshots: [UsageSnapshot]) {}
}

@Suite("Poller and a signed-out provider")
struct SignedOutTests {
  struct SignedOut: UsageProvider {
    let id = ProviderId.codex
    let reads: Counter

    func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
      await reads.bump()
      return UsageSnapshot(
        providerId: id, displayName: "Codex", iconId: id, primaryPercent: nil, buckets: [],
        status: .unauthenticated, fetchedAt: isoString(now))
    }
  }

  final class Clock: @unchecked Sendable {
    var ms = 1_800_000_000_000.0
  }

  struct Host: PollerHost {
    let clock: Clock
    var usage: UsageHost { StubPollerHost.NoNetwork() }
    func now() -> Date { Date(timeIntervalSince1970: clock.ms / 1000) }
    func loadBackoff() -> [String: Double] { [:] }
    func saveBackoff(_ until: [String: Double]) {}
    func loadSnapshots() -> [UsageSnapshot] { [] }
    func saveSnapshots(_ snapshots: [UsageSnapshot]) {}
  }

  @Test func isAskedAgainOnlyEveryFewMinutesUnlessClicked() async {
    var settings = CapsuleSettings.defaults
    settings.enabledProviderIds = [.codex]
    let frozen = settings
    let reads = Counter()
    let clock = Clock()
    let poller = UsagePoller(
      providers: [SignedOut(reads: reads)], host: Host(clock: clock), settings: { frozen }, onChange: { _ in }
    )
    await poller.start()
    #expect(await reads.value == 1)
    clock.ms += 60_000
    await poller.refresh()
    #expect(await reads.value == 1)
    // Asking for it by name reads it at once.
    await poller.refreshProvider(.codex)
    #expect(await reads.value == 2)
    clock.ms += PollerTuning.signedOutRetryMs
    await poller.refresh()
    #expect(await reads.value == 3)
    #expect(await poller.snapshots.first?.status == .unauthenticated)
  }
}
