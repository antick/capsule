import CapsuleCore
import CapsuleFixtures
import CapsuleUsage
import Foundation
import Testing

/// A stub world as the corpus describes one.
struct World: Decodable {
  struct Command: Decodable {
    let file: String
    let args: [String]
    let output: String?
  }

  struct Response: Decodable {
    let url: String
    let method: String?
    let authorization: String?
    let status: Int?
    let body: JSONValue?
    let headers: [String: String]?
    let fail: Bool?
  }

  let provider: ProviderId
  let home: String
  let files: [String: String]
  let secrets: [String: String]
  let commands: [Command]
  let env: [String: String]
  let responses: [Response]
}

struct RecordedRequest: Decodable, Equatable {
  let method: String
  let url: String
  let headers: [String: String]
  let body: String?
}

/// The stub host: answers from the world and remembers every request sent.
final class StubUsageHost: UsageHost, @unchecked Sendable {
  let world: World
  private let lock = NSLock()
  private var sent: [RecordedRequest] = []

  init(_ world: World) { self.world = world }

  var homeDir: String { world.home }
  var requests: [RecordedRequest] { lock.withLock { sent } }

  func send(_ request: HTTPRequest) async throws -> HTTPResponse {
    let headers = Dictionary(
      request.headers.map { ($0.key.lowercased(), $0.value) }, uniquingKeysWith: { _, last in last }
    )
    lock.withLock {
      sent.append(RecordedRequest(method: request.method, url: request.url, headers: headers, body: request.body))
    }
    guard
      let match = world.responses.first(where: {
        $0.url == request.url && ($0.method ?? "GET") == request.method
          && ($0.authorization == nil || $0.authorization == headers["authorization"])
      }), match.fail != true
    else { throw URLError(.notConnectedToInternet) }
    let body: Data
    switch match.body {
    case .none: body = Data()
    case .string(let text): body = Data(text.utf8)
    case let value?: body = try JSONEncoder().encode(value)
    }
    return HTTPResponse(status: match.status ?? 200, headers: match.headers ?? [:], body: body)
  }

  func readFile(_ path: String) async -> String? { world.files[path] }
  func readSecret(_ service: String) async -> String? { world.secrets[service] }

  func runCommand(_ file: String, _ arguments: [String]) async -> String? {
    world.commands.first { $0.file == file && $0.args == arguments }?.output
  }

  /// The corpus records Cursor's token as the original's `sqlite3` command;
  /// the Swift reader queries the same store directly, so the command's
  /// output is served as the query's single cell.
  func query(_ database: String, _ sql: String) async -> [[String]] {
    guard
      let command = world.commands.first(where: {
        $0.file == "sqlite3" && $0.args.count == 3 && $0.args[1] == database && $0.args[2] == sql
      }), let output = command.output, !jsTrim(output).isEmpty
    else { return [] }
    return [[output]]
  }

  func environment(_ name: String) -> String? { world.env[name] }
}

struct ReadOutcome: Decodable, Equatable {
  struct Refusal: Decodable, Equatable {
    let retryAfterMs: Int?
    let fallback: UsageSnapshot?
  }

  let snapshot: UsageSnapshot?
  let rateLimited: Refusal?
  let failed: Bool?
}

struct ReadExpected: Decodable {
  let outcome: ReadOutcome
  let requests: [RecordedRequest]
}

func provider(_ id: ProviderId) -> UsageProvider {
  switch id {
  case .claude: return ClaudeUsageProvider()
  case .codex: return CodexUsageProvider()
  case .grok: return GrokUsageProvider()
  case .cursor: return CursorUsageProvider()
  case .copilot: return CopilotUsageProvider()
  }
}

@Suite("Provider reads against a stub world, from the shared corpus")
struct ProviderReadTests {
  @Test("each provider asks the same questions and reaches the same answer")
  func reads() async throws {
    let file: FixtureFile<World, ReadExpected> = try Fixtures.load("usage/provider-reads")
    let now = try file.now()
    for testCase in file.cases {
      let host = StubUsageHost(testCase.input)
      let outcome: ReadOutcome
      do {
        let snapshot = try await provider(testCase.input.provider).fetchSnapshot(host, now: now)
        outcome = ReadOutcome(snapshot: snapshot, rateLimited: nil, failed: nil)
      } catch let refusal as RateLimited {
        outcome = ReadOutcome(
          snapshot: nil,
          rateLimited: .init(retryAfterMs: refusal.retryAfterMs, fallback: refusal.fallback),
          failed: nil
        )
      } catch {
        outcome = ReadOutcome(snapshot: nil, rateLimited: nil, failed: true)
      }
      #expect(outcome == testCase.expected.outcome, "\(testCase.name): outcome")
      #expect(host.requests == testCase.expected.requests, "\(testCase.name): requests")
    }
  }
}
