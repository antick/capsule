import CapsuleFixtures
import Testing

/// The Swift half of the parity gate from design decision 1: the corpus is
/// only a safety net if the suite actually executes it. A fixture that nothing
/// reads, and that nobody has declared as not-yet-ported, fails here rather
/// than sitting unnoticed until the port is finished.
@Suite("Corpus coverage")
struct CorpusCoverageTests {
  /// Every fixture this test target drives.
  static let covered: Set<String> = [
    "activity/compact-count",
    "dates/ago",
    "dates/day-keys",
    "dates/elapsed",
    "dates/reset-absolute",
    "dates/reset-relative",
    "severity/for-percent",
  ]

  /// Fixtures whose Swift port has not landed. Shrinks to empty by the end of
  /// Phase 1; anything left here at that point is a gap, not a plan.
  static let notYetPorted: Set<String> = [
    "usage/backoff",
    "usage/clamp-percent",
    "usage/claude-cache",
    "usage/claude-mapping",
    "usage/codex-mapping",
    "usage/copilot-mapping",
    "usage/cursor-mapping",
    "usage/grok-echo-row",
    "usage/grok-mapping",
    "usage/merge",
    "usage/retry-after",
    "usage/to-percent",
    "usage/tokens-from-file",
    "usage/unauthenticated",
  ]

  @Test("every fixture is either covered or explicitly not yet ported")
  func accountedFor() throws {
    let onDisk = Set(try Fixtures.allPaths())
    let accounted = Self.covered.union(Self.notYetPorted)

    let unaccounted = onDisk.subtracting(accounted)
    #expect(
      unaccounted.isEmpty,
      """
      New fixtures nothing reads. Port them, or add them to `notYetPorted`:
      \(unaccounted.sorted().joined(separator: "\n"))
      """
    )

    let stale = accounted.subtracting(onDisk)
    #expect(
      stale.isEmpty,
      """
      Listed fixtures that no longer exist on disk:
      \(stale.sorted().joined(separator: "\n"))
      """
    )
  }

  @Test("the corpus is reachable at all")
  func corpusFound() throws {
    #expect(Fixtures.root != nil)
    #expect(try !Fixtures.allPaths().isEmpty)
  }
}
