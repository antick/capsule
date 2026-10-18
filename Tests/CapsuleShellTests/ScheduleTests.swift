import CapsuleCore
import Foundation
import Testing

@testable import CapsuleShell

/// Counts what the schedule asked for.
actor Calls {
  private(set) var log: [String] = []
  func add(_ name: String) { log.append(name) }
}

struct FakeUsage: UsageDriving {
  let calls: Calls
  func start() async { await calls.add("start") }
  func tick() async { await calls.add("tick") }
  func resume() async { await calls.add("resume") }
  func online() async { await calls.add("online") }
}

struct FakeRescan: Rescanning {
  let calls: Calls
  let name: String
  func rescan() async { await calls.add(name) }
}

/// Event sources the test fires by hand.
@MainActor
final class FakeEvents {
  struct Timer {
    let seconds: TimeInterval
    let action: ShellAction
    var live = true
  }
  var timers: [Timer] = []
  var wake: [ShellAction] = []
  var unlock: [ShellAction] = []
  var online: [ShellAction] = []
  var watched: [(dir: String, action: ShellAction)] = []
  var cancelled = 0

  var events: ShellEvents {
    ShellEvents(
      every: { seconds, action in
        self.timers.append(Timer(seconds: seconds, action: action))
        let index = self.timers.count - 1
        return Subscription {
          self.timers[index].live = false
          self.cancelled += 1
        }
      },
      onWake: { self.wake.append($0); return Subscription { self.cancelled += 1 } },
      onUnlock: { self.unlock.append($0); return Subscription { self.cancelled += 1 } },
      onOnline: { self.online.append($0); return Subscription { self.cancelled += 1 } },
      watch: { dir, action in
        self.watched.append((dir, action))
        return Subscription { self.cancelled += 1 }
      }
    )
  }

  func fire(every seconds: TimeInterval) {
    for timer in timers where timer.live && timer.seconds == seconds { timer.action() }
  }
}

/// Waits for the tasks the schedule spawned to have made `expected` calls,
/// counted by name. They land on the global executor, which under
/// background priority can take a while, so this polls with a deadline
/// rather than yielding a fixed number of times. A little extra settling
/// afterwards lets a call that should not happen show up if it would.
func waitFor(_ calls: Calls, _ expected: [String: Int]) async -> [String: Int] {
  func counts() async -> [String: Int] {
    var counts: [String: Int] = [:]
    for name in await calls.log { counts[name, default: 0] += 1 }
    return counts
  }
  let deadline = ContinuousClock.now + .seconds(5)
  while ContinuousClock.now < deadline {
    let now = await counts()
    if expected.allSatisfy({ now[$0.key, default: 0] >= $0.value }) { break }
    try? await Task.sleep(for: .milliseconds(10))
  }
  try? await Task.sleep(for: .milliseconds(50))
  return await counts()
}

/// A clock the schedule tests move by hand.
@MainActor
final class Millis {
  var now = 0.0
}

@MainActor
@Suite("Shell schedule")
struct ScheduleTests {
  let calls = Calls()
  let fake = FakeEvents()
  let time = Millis()

  func schedule() -> ShellSchedule {
    let time = time
    return ShellSchedule(
      usage: FakeUsage(calls: calls), activity: FakeRescan(calls: calls, name: "activity"),
      tokens: FakeRescan(calls: calls, name: "tokens"), events: fake.events,
      watchedDirectory: "/home/.claude/sessions", clock: { time.now }
    )
  }

  @Test func startsEverythingAndReadsOnce() async {
    schedule().start(pollIntervalMs: 60_000)
    let counts = await waitFor(calls, ["start": 1, "activity": 1, "tokens": 1])
    #expect(counts == ["start": 1, "activity": 1, "tokens": 1])
    #expect(fake.timers.map(\.seconds).sorted() == [2, 60, 60])
    #expect(fake.watched.map(\.dir) == ["/home/.claude/sessions"])
  }

  @Test func pollIntervalTicksThePoller() async {
    schedule().start(pollIntervalMs: 45_000)
    fake.fire(every: 45)
    fake.fire(every: 45)
    #expect(await waitFor(calls, ["tick": 2])["tick"] == 2)
  }

  @Test func wakeUnlockAndNetworkTogetherMakeOneRead() async {
    let running = schedule()
    running.start(pollIntervalMs: 60_000)
    fake.wake.forEach { $0() }
    fake.unlock.forEach { $0() }
    fake.online.forEach { $0() }
    let counts = await waitFor(calls, ["resume": 1])
    #expect(counts["resume"] == 1)
    #expect(counts["online"] == nil)
    running.stop()
  }

  @Test func aComeBackAfterTheGapReadsAgain() async {
    let running = schedule()
    running.start(pollIntervalMs: 60_000)
    fake.wake.forEach { $0() }
    time.now += PollerTuning.comeBackGapMs - 1
    fake.unlock.forEach { $0() }
    time.now += 1
    fake.online.forEach { $0() }
    let counts = await waitFor(calls, ["resume": 1, "online": 1])
    #expect(counts["resume"] == 1)
    #expect(counts["online"] == 1)
    running.stop()
  }

  @Test func activityRescansOnItsPollAndOnADirectoryChange() async {
    schedule().start(pollIntervalMs: 60_000)
    fake.fire(every: ActivityTuning.pollMs / 1000)
    fake.watched.forEach { $0.action() }
    let counts = await waitFor(calls, ["activity": 3, "tokens": 1])
    #expect(counts["activity"] == 3)
    #expect(counts["tokens"] == 1)
  }

  @Test func tokensRescanOnTheirOwnInterval() async {
    let schedule = schedule()
    schedule.start(pollIntervalMs: 30_000)
    fake.fire(every: TokenTuning.scanIntervalMs / 1000)
    let counts = await waitFor(calls, ["tokens": 2])
    #expect(counts["tokens"] == 2)
    #expect(counts["tick"] == nil)
  }

  @Test func retimingReplacesOnlyThePollTimer() async {
    let schedule = schedule()
    schedule.start(pollIntervalMs: 60_000)
    schedule.setPollInterval(120_000)
    fake.fire(every: 60)
    fake.fire(every: 120)
    // 60 s is also the token interval; only the token timer is still live.
    let counts = await waitFor(calls, ["tick": 1, "tokens": 2])
    #expect(counts["tick"] == 1)
    #expect(counts["tokens"] == 2)
    #expect(fake.cancelled == 1)
  }

  @Test func stopCancelsEverySubscription() async {
    let schedule = schedule()
    schedule.start(pollIntervalMs: 60_000)
    schedule.stop()
    // Poll, wake, unlock, online, activity poll, token poll, directory watch.
    #expect(fake.cancelled == 7)
    #expect(fake.timers.allSatisfy { !$0.live })
  }

  @Test func aDirectoryThatCannotBeWatchedStillPolls() async {
    var events = fake.events
    events.watch = { _, _ in nil }
    let schedule = ShellSchedule(
      usage: FakeUsage(calls: calls), activity: FakeRescan(calls: calls, name: "activity"),
      tokens: FakeRescan(calls: calls, name: "tokens"), events: events, watchedDirectory: "/missing"
    )
    schedule.start(pollIntervalMs: 60_000)
    fake.fire(every: ActivityTuning.pollMs / 1000)
    #expect(await waitFor(calls, ["activity": 2])["activity"] == 2)
    schedule.stop()
    #expect(fake.cancelled == 6)
  }

  @Test func onlyAReturnCountsAsOnline() {
    #expect(networkReturned(was: false, now: true))
    #expect(!networkReturned(was: nil, now: true))
    #expect(!networkReturned(was: true, now: true))
    #expect(!networkReturned(was: false, now: false))
    #expect(!networkReturned(was: true, now: false))
  }
}
