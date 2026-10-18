import CapsuleCore
import Foundation

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
  private let providers: [UsageProvider]
  private let host: PollerHost
  private let settings: @Sendable () -> CapsuleSettings
  private let onChange: @Sendable ([UsageSnapshot]) -> Void
  private let isBusy: @Sendable () -> Bool
  private let idleIntervalMs: Double

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
    idleIntervalMs: Double = PollerTuning.idleIntervalMs
  ) {
    self.providers = providers
    self.host = host
    self.settings = settings
    self.onChange = onChange
    self.isBusy = isBusy
    self.idleIntervalMs = idleIntervalMs
    self.blockedUntil = host.loadBackoff()
  }

  private var nowMs: Double { host.now().timeIntervalSince1970 * 1000 }

  private func publish() { onChange(snapshots) }

  /// Writes the readings down, minus the in-flight flag that means nothing later.
  private func remember() {
    host.saveSnapshots(snapshots.map { var item = $0; item.refreshing = nil; return item })
  }

  /// Flags the providers still being waited on, keeping their last numbers.
  /// Publishes only when a flag actually changed. An absent flag is not the
  /// same as false: the first pass writes `false` onto placeholders.
  private func markRefreshing(_ ids: Set<ProviderId>) {
    var changed = false
    let next = snapshots.map { item -> UsageSnapshot in
      let wanted = ids.contains(item.providerId)
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
  private func heldBack(_ id: ProviderId, previous: UsageSnapshot?) -> UsageSnapshot {
    mergeSnapshot(
      previous: previous,
      next: UsageSnapshot(
        providerId: id, displayName: ProviderLabels.label(id), iconId: id,
        primaryPercent: previous?.primaryPercent, buckets: previous?.buckets ?? [],
        status: .error, fetchedAt: isoString(host.now())
      )
    )
  }

  /// One provider's turn on the network, with a failure folded into a snapshot.
  private func fetchOne(_ provider: UsageProvider, asked: Bool = false) async -> UsageSnapshot {
    let key = provider.id.rawValue
    let previous = snapshots.first { $0.providerId == provider.id }
    let now = nowMs
    // Signed out a moment ago: still signed out, most likely, and asking
    // again each poll spends the account's goodwill on a known answer.
    if !asked, let previous, let since = signedOutAt[key], now - since < PollerTuning.signedOutRetryMs {
      return previous
    }
    // Inside a penalty the answer is already known: show the dated numbers
    // rather than spend an attempt extending the penalty.
    if (blockedUntil[key] ?? 0) > now { return heldBack(provider.id, previous: previous) }
    do {
      let fresh = mergeSnapshot(
        previous: previous, next: try await provider.fetchSnapshot(host.usage, now: host.now())
      )
      if blockedUntil.removeValue(forKey: key) != nil { host.saveBackoff(blockedUntil) }
      refusals[key] = nil
      if fresh.status == .unauthenticated { signedOutAt[key] = now } else { signedOutAt[key] = nil }
      return fresh
    } catch let refusal as RateLimited {
      let attempt = (refusals[key] ?? 0) + 1
      refusals[key] = attempt
      blockedUntil[key] = now + Double(backoffMs(refusals: attempt, retryAfterMs: refusal.retryAfterMs))
      host.saveBackoff(blockedUntil)
      if let fallback = refusal.fallback { return mergeSnapshot(previous: previous, next: fallback) }
    } catch {}
    return heldBack(provider.id, previous: previous)
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
    let enabled = Set(settings().enabledProviderIds)
    // Only a provider this poller can read is waited on. Demo mode reads
    // three; a fourth switched on would otherwise be flagged as refreshing
    // for good, its sweep spinning without end.
    let readable = Set(providers.map(\.id))
    // Fetched in turn, so clearing each flag as it lands settles the rail in
    // order rather than all at once.
    var pending = enabled.intersection(readable)
    markRefreshing(pending)
    var fetched: [UsageSnapshot] = []
    for provider in providers where enabled.contains(provider.id) {
      fetched.append(await fetchOne(provider))
      pending.remove(provider.id)
      markRefreshing(pending)
    }
    // The enabled set may have changed while the network was slow. Land the
    // readings against what is enabled now: a provider switched off is
    // dropped, one switched on keeps its placeholder until the follow-up.
    let enabledNow = settings().enabledProviderIds
    let now = host.now()
    snapshots = placeholderSnapshots(enabledNow, now: now).map { placeholder in
      if var reading = fetched.first(where: { $0.providerId == placeholder.providerId }) {
        reading.refreshing = false
        return reading
      }
      return snapshots.first { $0.providerId == placeholder.providerId } ?? placeholder
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
    return enabledNow.contains { id in readable.contains(id) && !fetched.contains { $0.providerId == id } }
  }

  /// Re-reads one provider, for when the user asks for that one.
  public func refreshProvider(_ id: ProviderId) async {
    guard let provider = providers.first(where: { $0.id == id }),
      settings().enabledProviderIds.contains(id),
      !snapshots.contains(where: { $0.providerId == id && $0.refreshing == true })
    else { return }
    var flagged = Set(snapshots.filter { $0.refreshing == true }.map(\.providerId))
    flagged.insert(id)
    markRefreshing(flagged)
    let reading = await fetchOne(provider, asked: true)
    snapshots = snapshots.map { item in
      guard item.providerId == id else { return item }
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
    let next = placeholderSnapshots(settings().enabledProviderIds, now: host.now()).map { placeholder in
      snapshots.first { $0.providerId == placeholder.providerId } ?? placeholder
    }
    guard next != snapshots else { return }
    snapshots = next
    publish()
  }

  /// Shows the remembered readings at once, then reads.
  public func start() async {
    snapshots = rememberedSnapshots(settings().enabledProviderIds, host.loadSnapshots(), now: host.now())
    publish()
    await refresh()
  }

  /// The poll interval elapsed. Reads only if an agent is working or the idle
  /// interval has passed.
  public func tick() async {
    let waited = lastAttempt.map { nowMs - $0 } ?? .infinity
    guard shouldRefresh(busy: isBusy(), sinceLastAttemptMs: waited, idleIntervalMs: idleIntervalMs) else {
      return
    }
    await refresh()
  }

  /// The Mac woke from sleep.
  public func resume() async { await refresh() }

  /// The network came back.
  public func online() async { await refresh() }
}
