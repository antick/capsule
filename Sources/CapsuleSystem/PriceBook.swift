import CapsuleActivity
import CapsuleCore
import Foundation
import os

/// Model prices for spend estimates: the table last downloaded, else the
/// one the app ships with. Refreshed from LiteLLM's public table at most
/// once a day; a failed download keeps what there was.
public final class PriceBook: @unchecked Sendable {
  private struct Saved: Codable {
    var table: PriceTable
    var fetchedAt: Date
  }

  private let store: JSONStore
  private let state: OSAllocatedUnfairLock<Saved?>
  private let fetching = OSAllocatedUnfairLock(initialState: false)

  public init(store: JSONStore) {
    self.store = store
    state = OSAllocatedUnfairLock(initialState: store.load(PricingRules.pricesFile, as: Saved.self))
  }

  /// The prices to use now: downloaded ones, with the bundled table filling
  /// in models the download lacks.
  public var table: PriceTable {
    var merged = PriceTable.bundled
    if let saved = state.withLock({ $0 }) { merged.merge(saved.table) }
    return merged
  }

  /// Downloads the table if the saved one is a day old or missing.
  public func refreshIfStale(now: Date = Date()) async {
    let age = state.withLock { $0.map { now.timeIntervalSince($0.fetchedAt) } } ?? .infinity
    guard age >= PricingRules.refreshSeconds, let url = URL(string: PricingRules.sourceURL) else { return }
    guard fetching.withLock({ busy in
      if busy { return false }
      busy = true
      return true
    }) else { return }
    defer { fetching.withLock { $0 = false } }
    guard let (data, response) = try? await URLSession.shared.data(from: url),
      (response as? HTTPURLResponse)?.statusCode == 200, let table = PriceTable.parseLiteLLM(data)
    else {
      SystemLog.prices.notice("model prices not refreshed; keeping the last table")
      return
    }
    let saved = Saved(table: table, fetchedAt: now)
    state.withLock { $0 = saved }
    store.save(PricingRules.pricesFile, saved)
    SystemLog.prices.notice("model prices refreshed: \(table.prices.count, privacy: .public) models")
  }
}

/// Re-reads the logs for tokens and spend, refreshing prices first when
/// they are a day old.
public struct PricedTokenScan: Sendable {
  public let scanner: TokenScanner
  public let prices: PriceBook

  public init(scanner: TokenScanner, prices: PriceBook) {
    self.scanner = scanner
    self.prices = prices
  }

  public func rescan() async {
    await prices.refreshIfStale()
    await scanner.rescan()
  }
}

enum SystemLog {
  static let prices = Logger(subsystem: AppIdentity.logSubsystem, category: "prices")
}
