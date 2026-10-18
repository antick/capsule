import CapsuleCore
import CapsuleFixtures
import CapsuleUsage
import Foundation
import Testing

/// Each case compares a whole mapped snapshot, not the handful of fields a
/// hand-written assertion would reach for. The expectations were recorded from
/// the TypeScript implementation, so a difference anywhere in the snapshot is
/// a difference in the port.
private func checkMapping<Payload: Decodable>(
  _ path: String,
  _ map: (Payload, Date) -> UsageSnapshot
) throws {
  let file: FixtureFile<Payload, UsageSnapshot> = try Fixtures.load(path)
  let now = try file.now()
  for testCase in file.cases {
    #expect(map(testCase.input, now) == testCase.expected, "\(path): \(testCase.name)")
  }
}

@Suite("Provider mapping, against the shared corpus")
struct MappingTests {
  @Test("mapClaudeUsage")
  func claude() throws {
    try checkMapping("usage/claude-mapping", mapClaudeUsage)
  }

  @Test("mapCodexUsage")
  func codex() throws {
    try checkMapping("usage/codex-mapping", mapCodexUsage)
  }

  @Test("mapGrokCredits")
  func grok() throws {
    try checkMapping("usage/grok-mapping", mapGrokCredits)
  }

  @Test("mapGrokCredits drops a product row that echoes the headline")
  func grokEchoRow() throws {
    try checkMapping("usage/grok-echo-row", mapGrokCredits)
  }

  @Test("mapCursorUsage")
  func cursor() throws {
    try checkMapping("usage/cursor-mapping", mapCursorUsage)
  }

  @Test("unauthenticatedSnapshot")
  func unauthenticated() throws {
    let file: FixtureFile<ProviderId, UsageSnapshot> = try Fixtures.load(
      "usage/unauthenticated"
    )
    let now = try file.now()
    for testCase in file.cases {
      #expect(
        unauthenticatedSnapshot(testCase.input, fetchedAt: now)
          == testCase.expected,
        "\(testCase.name)"
      )
    }
  }

  @Test("claudeUsageFromCache")
  func claudeCache() throws {
    let file: FixtureFile<String, ClaudeUsagePayload?> = try Fixtures.load(
      "usage/claude-cache"
    )
    for testCase in file.cases {
      #expect(
        claudeUsageFromCache(testCase.input) == testCase.expected,
        "\(testCase.name)"
      )
    }
  }
}

struct MergeInput: Decodable {
  let previous: UsageSnapshot?
  let next: UsageSnapshot
}

@Suite("Snapshot merging, against the shared corpus")
struct MergeTests {
  @Test("mergeSnapshot")
  func merge() throws {
    let file: FixtureFile<MergeInput, UsageSnapshot> = try Fixtures.load(
      "usage/merge"
    )
    for testCase in file.cases {
      let actual = mergeSnapshot(
        previous: testCase.input.previous, next: testCase.input.next
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }
}

struct TokenInput: Decodable {
  let reader: String
  let raw: String
}

@Suite("Token readers, against the shared corpus")
struct TokenReaderTests {
  @Test("tokens read out of each tool's own auth file")
  func tokens() throws {
    let file: FixtureFile<TokenInput, String?> = try Fixtures.load(
      "usage/tokens-from-file"
    )
    // Grok prefers an unexpired token and so reads the clock. Pin it, or a
    // case about an expired entry would mean something different each run.
    let now = Date(timeIntervalSince1970: 1_787_000_000)
    for testCase in file.cases {
      let actual: String?
      switch testCase.input.reader {
      case "grok":
        actual = grokTokenFromFile(testCase.input.raw, now: now)
      case "cursor-hex":
        actual = cursorTokenFromHex(testCase.input.raw)
      case "cursor-subject":
        actual = jwtSubject(testCase.input.raw)
      default:
        Issue.record("unknown token reader: \(testCase.input.reader)")
        continue
      }
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }
}
