import CapsuleCore
import Foundation
import os

/// What the poller needs beyond a provider's read: a clock, and somewhere to
/// remember penalties and readings across launches.
public protocol PollerHost: Sendable {
  var usage: UsageHost { get }
  func now() -> Date
  /// Epoch millisecond each rate-limited provider may be asked again.
  func loadBackoff() -> [String: Double]
  func saveBackoff(_ until: [String: Double])
  func loadSnapshots() -> [UsageSnapshot]
  func saveSnapshots(_ snapshots: [UsageSnapshot])
}

/// Reads every enabled provider in turn, publishes what it has after each
/// step, backs off from rate limits, and keeps the last good numbers when a
/// read fails.
///
/// The original takes timer, wake and network callbacks; here the shell calls
/// ``tick()``, ``resume()`` and ``online()`` from its own notifications.
public actor UsagePoller {
  private var providers: [UsageProvider]
  private let host: PollerHost
  private let settings: @Sendable () -> CapsuleSettings
  private let onChange: @Sendable ([UsageSnapshot]) -> Void
  private let isBusy: @Sendable () -> Bool
  private let idleIntervalMs: Double
  /// When given, the wait between reads, in place of the busy/idle rule.
  private let delayMs: (@Sendable () -> Double)?

  public private(set) var snapshots: [UsageSnapshot] = []
  /// Resolves to whether a follow-up refresh is needed.
  private var inFlight: Task<Bool, Never>?
  private var lastAttempt: Double?
  private var blockedUntil: [String: Double]
  private var refusals: [String: Int] = [:]
  /// When each provider last answered "not signed in".
  private var signedOutAt: [String: Double] = [:]

  public init(
    providers: [UsageProvider],
    host: PollerHost,
    settings: @escaping @Sendable () -> CapsuleSettings,
    onChange: @escaping @Sendable ([UsageSnapshot]) -> Void,
    isBusy: @escaping @Sendable () -> Bool = { true },
    idleIntervalMs: Double = PollerTuning.idleIntervalMs,
    delayMs: (@Sendable () -> Double)? = nil
  ) {
    self.delayMs = delayMs
    self.providers = providers
    self.host = host
    self.settings = settings
    self.onChange = onChange
    self.isBusy = isBusy
    self.idleIntervalMs = idleIntervalMs
    self.blockedUntil = host.loadBackoff()
  }

  private var nowMs: Double { host.now().timeIntervalSince1970 * 1000 }

  /// Swaps the readers, for when accounts are added or removed. The next
  /// ``sync()`` and ``refresh()`` land the change.
  public func setProviders(_ next: [UsageProvider]) { providers = next }

  /// The meters shown now, and what each is called.
  private var enabledMeters: [MeterId] { settings().enabledMeters }
  private func label(_ meter: MeterId) -> String { settings().label(for: meter) }

  /// A provider's reading, marked with the meter it belongs to.
  private func stamped(_ snapshot: UsageSnapshot, _ meter: MeterId) -> UsageSnapshot {
    var marked = snapshot
    marked.accountId = meter.account
    marked.displayName = label(meter)
    return marked
  }

  private func publish() { onChange(snapshots) }

  /// Writes the readings down, minus the in-flight flag that means nothing later.
  private func remember() {
    host.saveSnapshots(snapshots.map { var item = $0; item.refreshing = nil; return item })
  }

  /// Flags the providers still being waited on, keeping their last numbers.
  /// Publishes only when a flag actually changed. An absent flag is not the
  /// same as false: the first pass writes `false` onto placeholders.
  private func markRefreshing(_ ids: Set<MeterId>) {
    var changed = false
    let next = snapshots.map { item -> UsageSnapshot in
      let wanted = ids.contains(item.meterId)
      guard item.refreshing != wanted else { return item }
      changed = true
      var flagged = item
      flagged.refreshing = wanted
      return flagged
    }
    guard changed else { return }
    snapshots = next
    publish()
  }

  /// The last numbers there were, dated, in place of a read that did not happen.
  private func heldBack(_ id: MeterId, previous: UsageSnapshot?) -> UsageSnapshot {
    mergeSnapshot(
      previous: previous,
      next: UsageSnapshot(
        providerId: id.provider, displayName: label(id), iconId: id.provider,
        primaryPercent: previous?.primaryPercent, buckets: previous?.buckets ?? [],
        status: .error, fetchedAt: isoString(host.now()), accountId: id.account
      )
    )
  }

  /// One provider's turn on the network, with a failure folded into a snapshot.
  private func fetchOne(_ provider: UsageProvider, asked: Bool = false) async -> UsageSnapshot {
    let meter = provider.meter
    let key = meter.rawValue
    let previous = snapshots.first { $0.meterId == meter }
    let now = nowMs
    // Signed out a moment ago: still signed out, most likely, and asking
    // again each poll spends the account's goodwill on a known answer.
    if !asked, let previous, let since = signedOutAt[key], now - since < PollerTuning.signedOutRetryMs {
      return previous
    }
    // Inside a penalty the answer is already known: show the dated numbers
    // rather than spend an attempt extending the penalty.
    if (blockedUntil[key] ?? 0) > now { return heldBack(meter, previous: previous) }
    do {
      let fresh = mergeSnapshot(
        previous: previous, next: stamped(try await provider.fetchSnapshot(host.usage, now: host.now()), meter)
      )
      if blockedUntil.removeValue(forKey: key) != nil { host.saveBackoff(blockedUntil) }
      refusals[key] = nil
      if fresh.status == .unauthenticated { signedOutAt[key] = now } else { signedOutAt[key] = nil }
      return fresh
    } catch let refusal as RateLimited {
      let attempt = (refusals[key] ?? 0) + 1
      refusals[key] = attempt
      let wait = backoffMs(refusals: attempt, retryAfterMs: refusal.retryAfterMs)
      blockedUntil[key] = now + Double(wait)
      host.saveBackoff(blockedUntil)
      UsageLog.poller.notice("\(key, privacy: .public) rate limited; asking again in \(wait / 1000, privacy: .public) s")
      if let fallback = refusal.fallback { return mergeSnapshot(previous: previous, next: stamped(fallback, meter)) }
    } catch {
      // What went wrong, never what was sent: a status, or the kind of error.
      UsageLog.poller.notice("\(key, privacy: .public) read failed: \(describe(error), privacy: .public)")
    }
    return heldBack(meter, previous: previous)
  }

  /// Re-reads every enabled provider. A refresh already running is the answer
  /// to a second request for one.
  public func refresh() async {
    if let inFlight {
      _ = await inFlight.value
      return
    }
    lastAttempt = nowMs
    let task = Task { await self.refreshBody() }
    inFlight = task
    let followUp = await task.value
    inFlight = nil
    if followUp { await refresh() }
  }

  /// Returns whether a follow-up refresh is needed.
  private func refreshBody() async -> Bool {
    let enabled = Set(enabledMeters)
    // Only a provider this poller can read is waited on. Demo mode reads
    // three; a fourth switched on would otherwise be flagged as refreshing
    // for good, its sweep spinning without end.
    let readable = Set(providers.map(\.meter))
    // Fetched in turn, so clearing each flag as it lands settles the rail in
    // order rather than all at once.
    var pending = enabled.intersection(readable)
    markRefreshing(pending)
    var fetched: [UsageSnapshot] = []
    for provider in providers where enabled.contains(provider.meter) {
      fetched.append(await fetchOne(provider))
      pending.remove(provider.meter)
      markRefreshing(pending)
    }
    // The enabled set may have changed while the network was slow. Land the
    // readings against what is enabled now: a provider switched off is
    // dropped, one switched on keeps its placeholder until the follow-up.
    let enabledNow = enabledMeters
    let now = host.now()
    snapshots = placeholderSnapshots(enabledNow, now: now, label: label).map { placeholder in
      if var reading = fetched.first(where: { $0.meterId == placeholder.meterId }) {
        reading.refreshing = false
        return reading
      }
      return snapshots.first { $0.meterId == placeholder.meterId } ?? placeholder
    }
    publish()
    remember()
    // Only a provider that is enabled now and was not read needs a follow-up.
    // The original asks of every placeholder instead, and with nothing enabled
    // the placeholders are the default set, none of them read — so it queues
    // refresh after refresh forever. That loop is fixed separately in the
    // TypeScript; this rule is the corrected one.
    // A provider with no reader is never read, so it never asks for one:
    // asking would refresh in a loop, and every pass re-flags every ring.
    return enabledNow.contains { id in readable.contains(id) && !fetched.contains { $0.meterId == id } }
  }

  /// Re-reads one provider, for when the user asks for that one.
  public func refreshProvider(_ id: MeterId) async {
    guard let provider = providers.first(where: { $0.meter == id }),
      enabledMeters.contains(id),
      !snapshots.contains(where: { $0.meterId == id && $0.refreshing == true })
    else { return }
    var flagged = Set(snapshots.filter { $0.refreshing == true }.map(\.meterId))
    flagged.insert(id)
    markRefreshing(flagged)
    let reading = await fetchOne(provider, asked: true)
    snapshots = snapshots.map { item in
      guard item.meterId == id else { return item }
      var landed = reading
      landed.refreshing = false
      return landed
    }
    publish()
    remember()
  }

  /// Reconciles the list with the enabled providers without the network, so a
  /// toggle lands at once. Anything already known is carried over.
  public func sync() {
    let next = placeholderSnapshots(enabledMeters, now: host.now(), label: label).map { placeholder in
      guard var known = snapshots.first(where: { $0.meterId == placeholder.meterId }) else { return placeholder }
      // A renamed account shows its new name at once.
      known.displayName = placeholder.displayName
      return known
    }
    guard next != snapshots else { return }
    snapshots = next
    publish()
  }

  /// Shows the remembered readings at once, then reads.
  public func start() async {
    snapshots = rememberedSnapshots(enabledMeters, host.loadSnapshots(), now: host.now(), label: label)
    publish()
    await refresh()
  }

  /// The poll interval elapsed. Reads only if an agent is working or the idle
  /// interval has passed.
  public func tick() async {
    let waited = lastAttempt.map { nowMs - $0 } ?? .infinity
    if let delayMs {
      guard waited >= delayMs() else { return }
    } else {
      guard shouldRefresh(busy: isBusy(), sinceLastAttemptMs: waited, idleIntervalMs: idleIntervalMs) else {
        return
      }
    }
    await refresh()
  }

  /// The Mac woke from sleep.
  public func resume() async { await refresh() }

  /// The network came back.
  public func online() async { await refresh() }
}

/// The poller's log: providers, statuses and waits only.
enum UsageLog {
  static let poller = Logger(subsystem: AppIdentity.logSubsystem, category: "usage")
}

/// A failed read in a few words, safe to log.
private func describe(_ error: Error) -> String {
  switch error {
  case UsageReadError.http(_, let status): return "HTTP \(status)"
  case UsageReadError.unreadable: return "unreadable response"
  case let url as URLError: return "network error \(url.code.rawValue)"
  default: return String(describing: type(of: error))
  }
}
