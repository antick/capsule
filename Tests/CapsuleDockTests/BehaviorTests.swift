import CapsuleCore
import Foundation
import Testing

@testable import CapsuleDock

@MainActor
@Suite("Dock behaviour")
struct BehaviorTests {
  let clock = ManualClock()
  let dock: DockBehavior

  init() {
    dock = DockBehavior(clock: clock)
    var inputs = DockBehavior.Inputs()
    inputs.snapshots = [reading(.claude, 40), reading(.codex, 70), reading(.grok, nil)]
    dock.update(inputs)
  }

  func autoHide(_ on: Bool, keepOpen: Bool = false) {
    var inputs = dock.inputs
    inputs.autoHide = on
    inputs.keepOpen = keepOpen
    dock.update(inputs)
  }

  @Test func hoverOpensACardAfterTheDelay() {
    dock.pointer(inside: true)
    dock.meterEntered(.codex)
    #expect(dock.openId == nil)
    clock.advance(Motion.hoverOpenDelayMs)
    #expect(dock.openId == .codex)
    #expect(dock.joinIndex == 1)
  }

  @Test func leavingClosesAfterTheCloseDelayAndKeepsTheLastCard() {
    dock.pointer(inside: true)
    dock.meterEntered(.claude)
    clock.advance(100)
    dock.pointer(inside: false)
    clock.advance(Motion.hoverCloseDelayMs - 1)
    #expect(dock.openId == .claude)
    clock.advance(1)
    #expect(dock.openId == nil)
    // The card keeps its contents while it animates shut.
    #expect(dock.cardSnapshot?.providerId == .claude)
  }

  @Test func movingBetweenMetersSwapsTheCard() {
    dock.pointer(inside: true)
    dock.meterEntered(.claude)
    clock.advance(100)
    dock.meterEntered(.grok)
    clock.advance(100)
    #expect(dock.openId == .grok)
  }

  @Test func aClickPinsRefreshesAndAClickAgainUnpins() {
    var refreshed: [ProviderId] = []
    dock.onRefresh = { refreshed.append($0) }
    dock.pointer(inside: true)
    dock.meterClicked(.codex)
    #expect(dock.pinned == .codex)
    #expect(dock.openId == .codex)
    dock.meterClicked(.codex)
    #expect(dock.pinned == nil)
    #expect(refreshed == [.codex, .codex])
  }

  @Test func leavingDropsAPin() {
    dock.pointer(inside: true)
    dock.meterClicked(.claude)
    dock.pointer(inside: false)
    clock.advance(Motion.hoverCloseDelayMs)
    #expect(dock.pinned == nil)
    #expect(dock.openId == nil)
  }

  @Test func autoHideRestsAsALatchAndWakesForThePointer() {
    autoHide(true)
    #expect(dock.peek)
    dock.pointer(inside: true)
    #expect(!dock.peek)
    dock.pointer(inside: false)
    clock.advance(Motion.peekHoldMs - 1)
    #expect(!dock.peek)
    clock.advance(1)
    #expect(dock.peek)
  }

  @Test func theHideDelayIsTheSettings() {
    var inputs = dock.inputs
    inputs.autoHide = true
    inputs.hideDelayMs = HideDelay.relaxed.milliseconds
    dock.update(inputs)
    dock.pointer(inside: true)
    dock.pointer(inside: false)
    clock.advance(1000)
    #expect(!dock.peek)
    clock.advance(100)
    #expect(dock.peek)
  }

  @Test func keepOpenHoldsTheDockOut() {
    autoHide(true, keepOpen: true)
    #expect(!dock.peek)
    dock.pointer(inside: true)
    dock.pointer(inside: false)
    clock.advance(5000)
    #expect(!dock.peek)
  }

  @Test func clickingTheRailTogglesKeepOpenOnlyWhenItHides() {
    var asked: [Bool] = []
    dock.onKeepOpenChange = { asked.append($0) }
    dock.railClicked()
    #expect(asked.isEmpty)
    autoHide(true)
    dock.railClicked()
    #expect(asked == [true])
  }

  @Test func revealHoldsTheDockOutThenLetsItGo() {
    autoHide(true)
    dock.reveal()
    #expect(!dock.peek)
    clock.advance(Motion.revealHoldMs - 1)
    #expect(!dock.peek)
    clock.advance(1)
    #expect(dock.peek)
  }

  @Test func aRevealWithThePointerOnTheDockStaysOut() {
    autoHide(true)
    dock.reveal()
    dock.pointer(inside: true)
    clock.advance(Motion.revealHoldMs)
    #expect(!dock.peek)
  }

  @Test func turningAutoHideOnPutsTheDockAway() {
    dock.pointer(inside: true)
    autoHide(true)
    #expect(dock.peek)
  }

  @Test func aDragClosesEverythingAndItsClickIsNotAClick() {
    var refreshed: [ProviderId] = []
    dock.onRefresh = { refreshed.append($0) }
    dock.pointer(inside: true)
    dock.meterClicked(.claude)
    dock.dragBegan()
    #expect(dock.openId == nil)
    #expect(dock.pinned == nil)
    dock.dragEnded()
    dock.meterClicked(.claude)
    #expect(refreshed == [.claude])
  }

  @Test func theBeaconSaysWaitingBeforeWorking() {
    var inputs = dock.inputs
    let since = "2026-01-01T00:00:00.000Z"
    func session(_ id: String, _ state: AgentSessionState) -> AgentSession {
      AgentSession(
        id: id, providerId: .claude, name: id, detail: "", state: state, waitingFor: nil, since: since
      )
    }
    inputs.activity = [.claude: [session("a", .busy)]]
    dock.update(inputs)
    #expect(dock.beacon == .working)
    inputs.activity = [.claude: [session("a", .busy), session("b", .waiting)]]
    dock.update(inputs)
    #expect(dock.beacon == .waiting)
    inputs.activity = [:]
    dock.update(inputs)
    #expect(dock.beacon == nil)
  }
}

@MainActor
@Suite("Activity notices on the dock")
struct NoticeTests {
  let clock = ManualClock()
  let dock: DockBehavior

  init() {
    dock = DockBehavior(clock: clock)
    var inputs = DockBehavior.Inputs()
    inputs.snapshots = [reading(.claude, 40), reading(.codex, 70)]
    inputs.autoHide = true
    dock.update(inputs)
  }

  @Test func aNewNoticePopsUpThenGoesAway() {
    dock.updateNotices([notice("1", .codex)])
    #expect(dock.openId == .codex)
    #expect(!dock.peek)
    #expect(dock.cardNotices.map(\.id) == ["1"])
    clock.advance(NoticePresentation.visibleMs)
    #expect(dock.openId == nil)
    #expect(dock.peek)
  }

  @Test func popupsOffShowsNothingButKeepsTheCount() {
    var inputs = dock.inputs
    inputs.notificationPopups = false
    dock.update(inputs)
    dock.updateNotices([notice("1", .codex)])
    #expect(dock.openId == nil)
    #expect(dock.notices.unreadCount(.codex) == 1)
    #expect(dock.beacon == .waiting)
  }

  @Test func hoveringHoldsItAndReadsItAfterASecond() {
    var read: [String] = []
    dock.notices.onRead = { read += $0 }
    dock.updateNotices([notice("1", .claude)])
    dock.pointer(inside: true)
    dock.cardEntered()
    clock.advance(NoticePresentation.readDelayMs)
    #expect(read == ["1"])
    clock.advance(NoticePresentation.visibleMs * 2)
    #expect(dock.openId == .claude)
    dock.cardLeft()
    clock.advance(NoticePresentation.visibleMs)
    #expect(dock.notices.providerId == nil)
  }

  @Test func theCountdownResumesWhereItStopped() {
    dock.updateNotices([notice("1", .claude)])
    clock.advance(4000)
    dock.pointer(inside: true)
    dock.cardEntered()
    clock.advance(10_000)
    dock.cardLeft()
    clock.advance(NoticePresentation.visibleMs - 4000 - 1)
    #expect(dock.notices.providerId == .claude)
    clock.advance(1)
    #expect(dock.notices.providerId == nil)
  }

  @Test func theBadgeReopensAProvidersNoticesAndMarksThemRead() {
    var read: [String] = []
    dock.notices.onRead = { read += $0 }
    dock.updateNotices([notice("1", .claude, read: true), notice("2", .claude)])
    clock.advance(NoticePresentation.visibleMs)
    #expect(dock.notices.providerId == nil)
    dock.noticeBadgeClicked(.claude)
    #expect(dock.notices.providerId == .claude)
    #expect(read == ["2"])
  }

  @Test func aWaitingNoticeKeepsTheDockOutWhilePopupsAreOn() {
    dock.updateNotices([notice("1", .claude, .waiting)])
    clock.advance(NoticePresentation.visibleMs)
    #expect(dock.notices.providerId == nil)
    #expect(!dock.peek)
  }

  @Test func alreadyReadNoticesDoNotPopUp() {
    dock.updateNotices([notice("1", .claude, read: true)])
    #expect(dock.notices.providerId == nil)
  }
}
