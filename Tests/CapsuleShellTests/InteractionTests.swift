import AppKit
import CapsuleCore
import Foundation
import Testing

@testable import CapsuleDock
@testable import CapsuleShell

/// A clock the test moves by hand.
@MainActor
final class StepClock: DockClock {
  private(set) var nowMs = 0.0
  private var pending: [(at: Double, timer: DockTimer)] = []

  func after(_ ms: Double, _ action: @escaping @MainActor () -> Void) -> DockTimer {
    let timer = DockTimer(action)
    pending.append((nowMs + max(0, ms), timer))
    return timer
  }

  func advance(_ ms: Double) {
    let end = nowMs + ms
    while let next = pending.filter({ $0.at <= end && $0.timer.isPending }).min(by: { $0.at < $1.at }) {
      nowMs = next.at
      next.timer.fire()
    }
    nowMs = end
  }
}

/// The real dock controller, panel and view, driven by synthetic pointer
/// moves and mouse events. The panel is ordered in fully transparent, so it
/// takes part in hit testing without showing on screen.
@MainActor
@Suite("Dock interaction", .serialized)
struct InteractionTests {
  let clock = StepClock()
  let dock: DockController

  init() throws {
    var settings = CapsuleSettings.defaults
    settings.autoHide = false
    dock = DockController(settings: settings, clock: clock)
    var state = ShellState()
    state.snapshots = Demo.snapshots
    dock.update(state: state, notices: [], keepOpen: false, demoNow: Demo.now)
    dock.panel.alphaValue = 0
    dock.panel.orderFrontRegardless()
    dock.relayout()
  }

  /// A point in the dock view, on screen.
  func onScreen(_ point: CGPoint) -> NSPoint {
    dock.panel.convertPoint(toScreen: dock.view.convert(point, to: nil))
  }

  func meterCentre(_ id: ProviderId) throws -> NSPoint {
    let meter = try #require(dock.view.meters.first { $0.providerId == id })
    let ringCentre = CGPoint(x: meter.frame.midX, y: meter.frame.minY + dock.view.look.spec.metrics.meterSize / 2)
    return onScreen(dock.view.railView.convert(ringCentre, to: dock.view))
  }

  func event(_ type: NSEvent.EventType, at screen: NSPoint) -> NSEvent {
    NSEvent.mouseEvent(
      with: type, location: dock.panel.convertPoint(fromScreen: screen), modifierFlags: [], timestamp: 0,
      windowNumber: dock.panel.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1
    )!
  }

  @Test func hoverTakesTheMouseOpensACardAndLeavingLetsGo() throws {
    dock.pointerMoved(try meterCentre(.codex))
    #expect(!dock.panel.ignoresMouseEvents)
    clock.advance(Motion.hoverOpenDelayMs)
    #expect(dock.behavior.openId == .codex)
    dock.pointerMoved(NSPoint(x: dock.panel.frame.minX - 200, y: dock.panel.frame.midY))
    #expect(dock.panel.ignoresMouseEvents)
    clock.advance(Motion.hoverCloseDelayMs)
    #expect(dock.behavior.openId == nil)
  }

  @Test func theConcaveFilletAndTheEmptyFrameLetClicksThrough() throws {
    let rail = dock.view.current?.railBox ?? .zero
    let flare = dock.view.look.spec.metrics.edgeFlare
    // Beside the rail's end, inside the fillet that blends it into the edge.
    let fillet = CGPoint(x: rail.maxX - 2, y: rail.minY - flare / 2)
    #expect(!dock.view.answers(fillet))
    dock.pointerMoved(onScreen(fillet))
    #expect(dock.panel.ignoresMouseEvents)
    // The transparent frame where the closed card would be.
    dock.pointerMoved(onScreen(CGPoint(x: 40, y: dock.view.bounds.midY)))
    #expect(dock.panel.ignoresMouseEvents)
  }

  @Test func aClickPinsTheCardAndRereadsTheProvider() throws {
    var refreshed: [ProviderId] = []
    dock.behavior.onRefresh = { refreshed.append($0) }
    let point = try meterCentre(.grok)
    dock.pointerMoved(point)
    dock.view.mouseDown(with: event(.leftMouseDown, at: point))
    dock.view.mouseUp(with: event(.leftMouseUp, at: point))
    #expect(dock.behavior.pinned == .grok)
    #expect(refreshed == [.grok])
    // A click — and the pin it makes — never takes focus from the app in use.
    #expect(!dock.panel.isKeyWindow)
    #expect(!dock.panel.isMainWindow)
  }

  @Test func draggingToTheTopReDocksThereAndSaysWhere() throws {
    var dropped: (PlacementPreset, DockPosition)?
    dock.onMoved = { dropped = ($0, $1) }
    let screen = try #require(NSScreen.screens.first)
    let start = try meterCentre(.claude)
    dock.pointerMoved(start)
    dock.view.mouseDown(with: event(.leftMouseDown, at: start))
    // Out toward the middle of the top edge, in steps, as a hand would.
    let target = NSPoint(x: screen.frame.midX, y: screen.frame.maxY - 4)
    for step in 1...12 {
      let t = Double(step) / 12
      let point = NSPoint(x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t)
      dock.view.mouseDragged(with: event(.leftMouseDragged, at: point))
    }
    #expect(dock.behavior.dragging)
    #expect(dock.view.look.spec.growth == .down)
    #expect(!dock.panel.isKeyWindow)
    dock.view.mouseUp(with: event(.leftMouseUp, at: target))
    #expect(!dock.behavior.dragging)
    #expect(dropped?.0 == .topEdge)
    // A drag's release is not a click: nothing was pinned.
    #expect(dock.behavior.pinned == nil)
  }

  @Test func aFoldedDockWakesFromItsLatch() throws {
    var settings = CapsuleSettings.defaults
    settings.autoHide = true
    dock.apply(settings: settings)
    var state = ShellState()
    state.snapshots = Demo.snapshots
    dock.update(state: state, notices: [], keepOpen: false, demoNow: Demo.now)
    #expect(dock.behavior.peek)
    let latch = try #require(dock.view.current?.latch)
    dock.pointerMoved(onScreen(CGPoint(x: latch.midX, y: latch.midY)))
    #expect(!dock.behavior.peek)
    #expect(!dock.panel.ignoresMouseEvents)
  }

  @Test func everyMeterIsALabelledButtonForVoiceOver() throws {
    let meters = dock.view.meters
    #expect(meters.count == 3)
    for meter in meters {
      #expect(meter.isAccessibilityElement())
      #expect(meter.accessibilityRole() == .button)
      let label = try #require(meter.accessibilityLabel())
      #expect(label.hasPrefix(ProviderLabels.label(meter.providerId)))
      #expect(label.hasSuffix("%"))
    }
    #expect(meters.first?.accessibilityLabel() == "Claude 73%")
  }

  @Test func aResizeEasesInsideAWindowHoldingBothSizes() throws {
    let before = dock.panel.frame
    var bigger = CapsuleSettings.defaults
    bigger.autoHide = false
    bigger.hudScale = HudScale.max
    dock.apply(settings: bigger)
    let held = dock.panel.frame
    let target = dock.view.frameSize
    #expect(held.width >= max(before.width, target.width) - 0.5)
    #expect(held.height >= max(before.height, target.height) - 0.5)
    // Pinned against the right edge throughout.
    #expect(abs(held.maxX - before.maxX) < 0.5)
    #expect(dock.view.layer?.animation(forKey: "zoom") != nil)
    RunLoop.main.run(until: Date().addingTimeInterval((Motion.zoomMs + Motion.zoomSettleMs) / 1000 + 0.2))
    #expect(abs(dock.panel.frame.width - target.width) < 0.5)
    #expect(abs(dock.panel.frame.height - target.height) < 0.5)
  }

  @Test func aDraggedRailLiftsAndSettlesBackOnDrop() throws {
    let start = try meterCentre(.claude)
    dock.pointerMoved(start)
    dock.view.mouseDown(with: event(.leftMouseDown, at: start))
    let away = NSPoint(x: start.x, y: start.y - 40)
    dock.view.mouseDragged(with: event(.leftMouseDragged, at: away))
    dock.view.draw()
    #expect(!CATransform3DIsIdentity(dock.view.railShape.transform))
    dock.view.mouseUp(with: event(.leftMouseUp, at: away))
    dock.view.draw()
    #expect(CATransform3DIsIdentity(dock.view.railShape.transform))
  }

  @Test func theCardsButtonsReachTheirHandlers() throws {
    var dismissed: [String] = []
    var cleared = 0
    dock.view.onDismissNotice = { dismissed.append($0) }
    dock.view.onClearNotices = { cleared += 1 }
    var state = ShellState()
    state.snapshots = Demo.snapshots
    let notices = [
      ActivityNotice(id: "n1", sessionId: "s", providerId: .claude, title: "Ship it", kind: .completed, at: isoString(Demo.now))
    ]
    dock.update(state: state, notices: notices, keepOpen: false, demoNow: Demo.now)
    #expect(dock.behavior.openId == .claude)
    let card = try #require(dock.view.cardContent)
    #expect(card.notices.map(\.id) == ["n1"])
    card.onDismissNotice("n1")
    card.onClearAll()
    #expect(dismissed == ["n1"])
    #expect(cleared == 1)
    // "View notifications" on a usage card reopens the provider's notices.
    dock.behavior.notices.close()
    card.onOpenNotices()
    #expect(dock.behavior.notices.providerId == .claude)
  }
}
