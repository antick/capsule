import CapsuleCore
import CapsuleUsage
import Foundation
import Testing

@Suite("Reading an added account")
struct AccountReadTests {
  /// A host with a file system and keychain of its own, answering usage
  /// requests by the token they carry.
  final class Host: UsageHost, @unchecked Sendable {
    let homeDir = "/Users/me"
    var files: [String: String] = [:]
    var secrets: [String: String] = [:]
    private let lock = NSLock()
    private var tokens: [String] = []
    var sentTokens: [String] { lock.withLock { tokens } }

    func send(_ request: HTTPRequest) async throws -> HTTPResponse {
      let token = request.headers["Authorization"]?.replacingOccurrences(of: "Bearer ", with: "") ?? ""
      lock.withLock { tokens.append(token) }
      let percent = token == "second-token" ? 70 : 10
      let body = #"{"five_hour":{"utilization":\#(percent),"resets_at":"2030-01-01T00:00:00Z"}}"#
      return HTTPResponse(status: 200, body: Data(body.utf8))
    }
    func readFile(_ path: String) async -> String? { files[path] }
    func readSecret(_ service: String) async -> String? { secrets[service] }
    func query(_ database: String, _ sql: String) async -> [[String]] { [] }
    func environment(_ name: String) -> String? { nil }
  }

  @Test func keychainServiceMatchesClaudeCodes() {
    // `printf %s /Users/pankaj/.claude_second | shasum -a 256 | cut -c1-8`
    #expect(claudeKeychainService(configDir: "/Users/pankaj/.claude_second") == "Claude Code-credentials-c5c7b0a5")
  }

  @Test func aClaudeAccountReadsOnlyItsOwnSignIn() async throws {
    let host = Host()
    host.secrets["Claude Code-credentials"] = #"{"claudeAiOauth":{"accessToken":"default-token-xxxxxxxxxx"}}"#
    host.secrets[claudeKeychainService(configDir: "/Users/me/.claude_second")] =
      #"{"claudeAiOauth":{"accessToken":"second-token"}}"#
    let account = UsageAccount(id: "c2", provider: .claude, path: "~/.claude_second", label: "Claude · second")
    let snapshot = try await ClaudeUsageProvider(account: account).fetchSnapshot(host, now: Date())
    #expect(snapshot.primaryPercent == 70)
    #expect(host.sentTokens == ["second-token"])
  }

  @Test func aClaudeAccountWithNoSignInNeverFallsBackToTheDefault() async throws {
    let host = Host()
    host.secrets["Claude Code-credentials"] = #"{"claudeAiOauth":{"accessToken":"default-token-xxxxxxxxxx"}}"#
    let account = UsageAccount(id: "c2", provider: .claude, path: "~/.claude_empty", label: "x")
    let snapshot = try await ClaudeUsageProvider(account: account).fetchSnapshot(host, now: Date())
    #expect(snapshot.status == .unauthenticated)
    #expect(host.sentTokens.isEmpty)
  }

  @Test func aCodexAccountReadsItsOwnAuthFile() async throws {
    let host = Host()
    host.files["/Users/me/.codex_sw/auth.json"] = #"{"tokens":{"access_token":"second-token"}}"#
    host.files["/Users/me/.codex/auth.json"] = #"{"tokens":{"access_token":"default-token"}}"#
    let account = UsageAccount(id: "x2", provider: .codex, path: "~/.codex_sw", label: "Codex · sw")
    _ = try? await CodexUsageProvider(account: account).fetchSnapshot(host, now: Date())
    #expect(host.sentTokens.first == "second-token")
    #expect(!host.sentTokens.contains("default-token"))
  }

  @Test func thePollerShowsEachAccountAsItsOwnMeter() async {
    let host = Host()
    host.secrets["Claude Code-credentials"] = #"{"claudeAiOauth":{"accessToken":"default-token-xxxxxxxxxx"}}"#
    host.secrets[claudeKeychainService(configDir: "/Users/me/.claude_second")] =
      #"{"claudeAiOauth":{"accessToken":"second-token"}}"#
    var settings = CapsuleSettings.defaults
    settings.enabledProviderIds = [.claude]
    let account = UsageAccount(id: "c2", provider: .claude, path: "~/.claude_second", label: "Claude · second")
    settings.accounts = [account]
    let frozen = settings
    struct PollHost: PollerHost {
      let usage: UsageHost
      func now() -> Date { Date(timeIntervalSince1970: 1_800_000_000) }
      func loadBackoff() -> [String: Double] { [:] }
      func saveBackoff(_ until: [String: Double]) {}
      func loadSnapshots() -> [UsageSnapshot] { [] }
      func saveSnapshots(_ snapshots: [UsageSnapshot]) {}
    }
    let poller = UsagePoller(
      providers: [ClaudeUsageProvider(), ClaudeUsageProvider(account: account)],
      host: PollHost(usage: host), settings: { frozen }, onChange: { _ in }
    )
    await poller.start()
    let shown = await poller.snapshots
    #expect(shown.map(\.meterId) == [.claude, account.meter])
    #expect(shown.map(\.primaryPercent) == [10, 70])
    #expect(shown.map(\.displayName) == ["Claude", "Claude · second"])
  }
}
