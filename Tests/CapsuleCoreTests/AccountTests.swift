import CapsuleCore
import Foundation
import Testing

@Suite("Added accounts")
struct AccountTests {
  let home = "/Users/me"

  @Test func pathsResolveAndDisplayUnderHome() {
    #expect(AccountPaths.resolve("~/.claude_second/", home: home) == "/Users/me/.claude_second")
    #expect(AccountPaths.resolve(".codex_sw", home: home) == "/Users/me/.codex_sw")
    #expect(AccountPaths.resolve("/opt/x/../codex", home: home) == "/opt/codex")
    #expect(AccountPaths.display("/Users/me/.claude_second", home: home) == "~/.claude_second")
    #expect(AccountPaths.display("/opt/codex", home: home) == "/opt/codex")
  }

  @Test func labelsComeFromTheFolderName() {
    #expect(AccountPaths.defaultLabel(.claude, path: "~/.claude_second", home: home) == "Claude · second")
    #expect(AccountPaths.defaultLabel(.codex, path: "~/.codex-work", home: home) == "Codex · work")
    #expect(AccountPaths.defaultLabel(.claude, path: "/opt/acme", home: home) == "Claude · acme")
  }

  @Test func discoveryFindsMarkedFoldersButNotTheDefaults() {
    let entries: [String: Set<String>] = [
      ".claude": [".credentials.json"],
      ".claude_second": [".claude.json", "sessions"],
      ".claude-server-commander": ["config.json"],
      ".codex": ["auth.json"],
      ".codex_sw": ["auth.json"],
      ".codexbar": ["cache"],
    ]
    let found = discoverAccounts(home: home, entries: entries, existing: [])
    #expect(
      found == [
        AccountCandidate(provider: .claude, path: "/Users/me/.claude_second"),
        AccountCandidate(provider: .codex, path: "/Users/me/.codex_sw"),
      ])
    let added = UsageAccount(id: "a", provider: .codex, path: "~/.codex_sw", label: "Codex · sw")
    #expect(discoverAccounts(home: home, entries: entries, existing: [added]).map(\.provider) == [.claude])
  }

  @Test func checksExplainWhyAFolderCannotBeAdded() {
    func check(_ path: String, exists: Bool = true, _ contents: Set<String> = ["auth.json"]) -> AccountCheck {
      let added = UsageAccount(id: "a", provider: .codex, path: "~/.codex_sw", label: "x")
      return checkAccount(.codex, path: path, home: home, exists: exists, contents: contents, existing: [added])
    }
    #expect(check("~/.codex-work") == .ok)
    #expect(check("~/.codex") == .isDefault)
    #expect(check("/Users/me/.codex_sw/") == .alreadyAdded)
    #expect(check("~/.nope", exists: false) == .missing)
    #expect(check("~/Documents", []) == .notAnAccount)
  }

  @Test func metersFollowEachProvidersOwnSignIn() {
    var settings = CapsuleSettings.defaults
    settings.enabledProviderIds = [.codex, .grok]
    settings.accounts = [
      UsageAccount(id: "c2", provider: .claude, path: "~/.claude_second", label: "Claude · second"),
      UsageAccount(id: "x2", provider: .codex, path: "~/.codex_sw", label: "Codex · sw"),
      UsageAccount(id: "x3", provider: .codex, path: "~/.codex_off", label: "Off", enabled: false),
    ]
    #expect(
      settings.enabledMeters == [
        MeterId(.claude, account: "c2"), .codex, MeterId(.codex, account: "x2"), .grok,
      ])
    #expect(settings.label(for: MeterId(.codex, account: "x2")) == "Codex · sw")
    #expect(settings.label(for: .grok) == "Grok")
  }

  @Test func accountsRoundTripAndBadOnesAreDropped() throws {
    var settings = CapsuleSettings.defaults
    settings.accounts = [UsageAccount(id: "c2", provider: .claude, path: "~/.claude_second", label: "Work")]
    let data = try #require(settings.documentData)
    #expect(CapsuleSettings.read(data: data) == settings)

    var raw = try #require(JSONValue.parse(String(decoding: data, as: UTF8.self))?.asObject)
    raw["accounts"] = .array([
      .object(["id": .string("g"), "provider": .string("grok"), "path": .string("~/.grok2")]),
      .object(["id": .string("c2"), "provider": .string("claude")]),
      .string("junk"),
      .object(["id": .string("k"), "provider": .string("codex"), "path": .string("~/.codex_sw")]),
    ])
    let read = try #require(CapsuleSettings.read(.object(raw)))
    #expect(read.accounts == [UsageAccount(id: "k", provider: .codex, path: "~/.codex_sw", label: "Codex")])
  }

  @Test func anOlderFileWithNoAccountsStillReads() throws {
    let data = try #require(CapsuleSettings.defaults.documentData)
    var raw = try #require(JSONValue.parse(String(decoding: data, as: UTF8.self))?.asObject)
    raw["accounts"] = nil
    #expect(CapsuleSettings.read(.object(raw))?.accounts == [])
  }
}
