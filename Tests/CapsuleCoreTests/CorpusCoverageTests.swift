import CapsuleFixtures
import Testing

/// The Swift half of the parity gate from design decision 1: the corpus is
/// only a safety net if the suite actually executes it. A fixture that nothing
/// reads, and that nobody has declared as not-yet-ported, fails here rather
/// than sitting unnoticed until the port is finished.
@Suite("Corpus coverage")
struct CorpusCoverageTests {
  /// Every fixture the Swift suites drive, across all test targets —
  /// `CapsuleCoreTests` and `CapsuleUsageTests`. The gate is about the corpus
  /// as a whole, so it lists the whole corpus rather than one target's share.
  static let covered: Set<String> = [
    // CapsuleCoreTests
    "activity/compact-count",
    "dates/ago",
    "dates/day-keys",
    "dates/elapsed",
    "dates/reset-absolute",
    "dates/reset-relative",
    "severity/for-percent",
    // CapsuleUsageTests
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
    // CapsuleCoreTests — HUD metrics
    "hud-metrics/card-height",
    "hud-metrics/clamp-scale",
    "hud-metrics/metrics",
    "hud-metrics/next-scale",
    "hud-metrics/notch",
    "hud-metrics/rail-sizes",
    "hud-metrics/scale-range",
    "hud-metrics/scale-steps",
    "hud-metrics/session-rows",
    // CapsuleCoreTests — placement and snapping
    "placement/compute-placement",
    "placement/dock-along-edge",
    "placement/layout-for-preset",
    "placement/nearest-edge",
    "placement/slide-along-edge",
    "placement/zoom-hold-bounds",
    // CapsuleCoreTests — settings
    "settings/defaults",
    "settings/parse-current",
    // CapsuleCoreTests — session summary and ordering
    "activity/any-active",
    "activity/order-sessions",
    "activity/summarize",
    // CapsuleHUDTests — dock silhouettes
    "hud-paths/blob-layout",
    "hud-paths/bubble-path",
    "hud-paths/frame-padding",
    "hud-paths/hit-regions",
    "hud-paths/latch",
    "hud-paths/primitives",
    "hud-paths/rail-morph",
    "hud-paths/rail-path",
    // CapsuleActivityTests — passive activity
    "activity/claude-row-tokens",
    "activity/claude-session",
    "activity/codex-row-tokens",
    "activity/codex-session",
    "activity/histogram-totals",
    "activity/local-events",
    "activity/notice-tracker",
    "activity/proc-start",
    "activity/prune-token-cache",
  ]

  /// Fixtures whose Swift port has not landed. Must be empty by the end of
  /// Phase 1; anything left here at that point is a gap, not a plan.
  static let notYetPorted: Set<String> = [
    "updates/format-bytes",
    "updates/format-progress",
    "updates/initial-state",
    "updates/plain-release-notes",
    "updates/release-url",
    "updates/wording",
    "usage/provider-reads",
  ]

  /// Fixtures the native app deliberately does not match, each with the
  /// decision that says why. They stay in the corpus because they pin the
  /// Electron behaviour the TypeScript suites still check.
  static let wontPort: [String: String] = [
    "settings/migrate-legacy":
      "Design decision 9: a settings file older than schema v7 falls back to defaults and onboarding rather than being migrated.",
  ]

  @Test("every fixture is either covered or explicitly not yet ported")
  func accountedFor() throws {
    let onDisk = Set(try Fixtures.allPaths())
    let accounted = Self.covered.union(Self.notYetPorted)
      .union(Self.wontPort.keys)

    let unaccounted = onDisk.subtracting(accounted)
    #expect(
      unaccounted.isEmpty,
      """
      New fixtures nothing reads. Port them, or add them to `notYetPorted` or `wontPort`:
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
