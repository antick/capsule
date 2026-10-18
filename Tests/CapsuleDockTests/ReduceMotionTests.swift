import AppKit
import CapsuleCore
import CapsuleHUD
import Testing

@testable import CapsuleDock

/// With Reduce Motion on the dock snaps rather than animates. Snapping once
/// re-entered itself without end and crashed the app at launch.
@MainActor
@Suite("Reduce Motion", .serialized)
struct ReduceMotionTests {
  func look() -> DockLook {
    let m = hudMetrics()
    let layout = layoutForPreset(.rightEdge)
    return DockLook(
      spec: FrameSpec(
        metrics: m, style: .rail, growth: layout.cardGrowth, notch: false, compact: false,
        railLength: railLengthForCount(m, 3, compact: false), railBias: nil, joined: nil),
      theme: .midnight, display: .used, demoNow: Demo.now)
  }

  @Test func theDockSnapsStraightToEachStateAndReturns() {
    reduceMotionOverride = true
    defer { reduceMotionOverride = nil }
    let behavior = DockBehavior(clock: MainClock())
    let view = DockView(look: look(), behavior: behavior)
    var inputs = DockBehavior.Inputs()
    inputs.snapshots = Demo.snapshots
    inputs.autoHide = true
    behavior.update(inputs)
    // Folded: the latch, at once, with no link left running.
    #expect(view.openness.value == 0)
    #expect(view.link == nil)
    inputs.forceOpen = .claude
    behavior.update(inputs)
    #expect(view.openness.value == 1)
    #expect(view.along.value == view.targets.cardAlong)
    #expect(view.link == nil)
  }
}
