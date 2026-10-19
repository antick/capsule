import Foundation

/// What `capsule` prints: every meter's windows and amounts, plain enough
/// for a script or an agent to act on.
public struct LimitsReport: Encodable, Equatable {
  public struct Window: Encodable, Equatable {
    public var id: String
    public var label: String
    public var percentUsed: Double
    public var percentLeft: Double
    /// Nil for a window that has not started.
    public var resetsAt: String?
    /// Points ahead of an even pace; positive runs out early.
    public var paceDelta: Double?
    /// When it runs out at the current rate, if before the reset.
    public var runsOutAt: String?

    // Absent values are written as null, so every window has one shape.
    public func encode(to encoder: Encoder) throws {
      var c = encoder.container(keyedBy: Keys.self)
      try c.encode(id, forKey: .id)
      try c.encode(label, forKey: .label)
      try c.encode(percentUsed, forKey: .percentUsed)
      try c.encode(percentLeft, forKey: .percentLeft)
      try c.encode(resetsAt, forKey: .resetsAt)
      try c.encode(paceDelta, forKey: .paceDelta)
      try c.encode(runsOutAt, forKey: .runsOutAt)
    }
    enum Keys: String, CodingKey { case id, label, percentUsed, percentLeft, resetsAt, paceDelta, runsOutAt }
  }
  public struct Amount: Encodable, Equatable {
    public var id: String
    public var label: String
    public var value: String
    public var percentUsed: Double?
    public var resetsAt: String?

    public func encode(to encoder: Encoder) throws {
      var c = encoder.container(keyedBy: Keys.self)
      try c.encode(id, forKey: .id)
      try c.encode(label, forKey: .label)
      try c.encode(value, forKey: .value)
      try c.encode(percentUsed, forKey: .percentUsed)
      try c.encode(resetsAt, forKey: .resetsAt)
    }
    enum Keys: String, CodingKey { case id, label, value, percentUsed, resetsAt }
  }
  public struct Meter: Encodable, Equatable {
    public var provider: String
    public var account: String?
    public var name: String
    public var status: String
    /// The ring's figure: the top window's share used.
    public var percentUsed: Double?
    public var fetchedAt: String
    public var staleSince: String?
    public var windows: [Window]
    public var amounts: [Amount]

    public func encode(to encoder: Encoder) throws {
      var c = encoder.container(keyedBy: Keys.self)
      try c.encode(provider, forKey: .provider)
      try c.encode(account, forKey: .account)
      try c.encode(name, forKey: .name)
      try c.encode(status, forKey: .status)
      try c.encode(percentUsed, forKey: .percentUsed)
      try c.encode(fetchedAt, forKey: .fetchedAt)
      try c.encode(staleSince, forKey: .staleSince)
      try c.encode(windows, forKey: .windows)
      try c.encode(amounts, forKey: .amounts)
    }
    enum Keys: String, CodingKey {
      case provider, account, name, status, percentUsed, fetchedAt, staleSince, windows, amounts
    }
  }

  public var generatedAt: String
  /// "cache": the app's last readings; "live": read just now.
  public var source: String
  public var meters: [Meter]
}

public func limitsReport(_ snapshots: [UsageSnapshot], source: String, now: Date) -> LimitsReport {
  LimitsReport(
    generatedAt: isoString(now), source: source,
    meters: snapshots.map { snapshot in
      LimitsReport.Meter(
        provider: snapshot.providerId.rawValue, account: snapshot.accountId, name: snapshot.displayName,
        status: snapshot.status.rawValue, percentUsed: snapshot.primaryPercent, fetchedAt: snapshot.fetchedAt,
        staleSince: snapshot.staleSince,
        windows: snapshot.buckets.map { bucket in
          let paced = pace(snapshot.providerId, bucket, now: now)
          return LimitsReport.Window(
            id: bucket.id, label: bucket.label, percentUsed: bucket.percentUsed, percentLeft: 100 - bucket.percentUsed,
            resetsAt: bucket.hasStarted ? bucket.resetsAt : nil, paceDelta: paced.map { ($0.delta * 10).rounded() / 10 },
            runsOutAt: paced?.runsOutAt.map(isoString))
        },
        amounts: (snapshot.extras ?? []).map {
          LimitsReport.Amount(id: $0.id, label: $0.label, value: $0.value, percentUsed: $0.percentUsed, resetsAt: $0.resetsAt)
        })
    })
}

public enum CLICopy {
  public static let usage = """
    capsule — your AI usage limits as JSON.

    Usage: capsule [--refresh] [--provider <id>] [--pretty] [--dev]

      (no options)      Print the readings Capsule last made, from its cache.
      --refresh         Read every switched-on provider now instead.
      --provider <id>   Only one provider: claude, codex, grok, cursor, antigravity,
                        devin, openrouter, deepseek.
      --pretty          Indent the JSON.
      --dev             Read Capsule Dev's data rather than Capsule's.
      --version         Print the version.

    Exits 1 when there is nothing to report.
    """
  public static let nothing = "capsule: no readings yet. Open Capsule, or run capsule --refresh."
  public static func unknownProvider(_ name: String) -> String {
    "capsule: no provider called \"\(name)\". Run capsule --help for the list."
  }
}
