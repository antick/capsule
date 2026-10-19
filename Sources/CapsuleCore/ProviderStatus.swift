import Foundation

/// How a provider's status page describes it right now.
public enum StatusLevel: String, Sendable, Codable, Comparable {
  case none, maintenance, minor, major, critical

  var rank: Int {
    switch self {
    case .none: return 0
    case .maintenance: return 1
    case .minor: return 2
    case .major: return 3
    case .critical: return 4
    }
  }

  public static func < (lhs: StatusLevel, rhs: StatusLevel) -> Bool { lhs.rank < rhs.rank }

  /// An outage, as opposed to maintenance or a minor issue.
  public var isOutage: Bool { self >= .major }
}

/// A provider's current status: the level and the page's own words.
public struct ProviderStatus: Sendable, Codable, Equatable {
  public var level: StatusLevel
  public var description: String
  public var checkedAt: String

  public init(level: StatusLevel, description: String, checkedAt: String) {
    self.level = level
    self.description = description
    self.checkedAt = checkedAt
  }
}

/// Where each provider's status is published.
public enum StatusSource: Sendable, Equatable {
  /// An Atlassian Statuspage, read at `/api/v2/status.json`.
  case statuspage(String)
  /// Google's Workspace incident feed, for one product.
  case google(product: String)

  public static func of(_ provider: ProviderId) -> StatusSource? {
    switch provider {
    case .claude: return .statuspage("https://status.claude.com")
    case .codex: return .statuspage("https://status.openai.com")
    case .cursor: return .statuspage("https://status.cursor.com")
    case .antigravity: return .google(product: StatusTuning.googleProduct)
    case .grok, .devin, .openrouter, .deepseek: return nil
    }
  }
}

public enum StatusTuning {
  /// Status pages change by the minute at most; every five is plenty.
  public static let intervalSeconds = 300.0
  public static let statuspagePath = "/api/v2/status.json"
  public static let googleFeed = "https://www.google.com/appsstatus/dashboard/incidents.json"
  /// Gemini's product id in Google's feed, which Antigravity runs on.
  public static let googleProduct = "npdyhgECDJ6tB66MxXyo"
}

/// A Statuspage `status.json`, or nil if it is not one.
public func parseStatuspage(_ text: String, checkedAt: Date) -> ProviderStatus? {
  guard let status = JSONValue.parse(text)?["status"], let indicator = status["indicator"]?.asString else { return nil }
  let level: StatusLevel
  switch indicator {
  case "none": level = .none
  case "minor": level = .minor
  case "major": level = .major
  case "critical": level = .critical
  case "maintenance": level = .maintenance
  default: level = .minor
  }
  return ProviderStatus(
    level: level, description: status["description"]?.asString ?? "", checkedAt: isoString(checkedAt))
}

/// The worst open incident for a product in Google's feed. No open
/// incident is all clear.
public func parseGoogleIncidents(_ text: String, product: String, checkedAt: Date) -> ProviderStatus? {
  guard let incidents = JSONValue.parse(text)?.asArray else { return nil }
  var worst: (level: StatusLevel, text: String)?
  for incident in incidents where incident["end"] == nil || incident["end"] == .null {
    let products = incident["currently_affected_products"]?.asArray ?? incident["affected_products"]?.asArray ?? []
    guard products.contains(where: { $0["id"]?.asString == product }) else { continue }
    let level: StatusLevel
    switch incident["status_impact"]?.asString ?? "" {
    case "AVAILABLE": level = .none
    case "SERVICE_INFORMATION": level = .minor
    case "SERVICE_DISRUPTION": level = .major
    case "SERVICE_OUTAGE": level = .critical
    case "SERVICE_MAINTENANCE", "SCHEDULED_MAINTENANCE": level = .maintenance
    default:
      switch incident["severity"]?.asString ?? "" {
      case "medium": level = .major
      case "high": level = .critical
      default: level = .minor
      }
    }
    let words = incident["external_desc"]?.asString ?? ""
    if worst == nil || level > worst!.level { worst = (level, words) }
  }
  guard let worst else {
    return ProviderStatus(level: .none, description: Copy.allOperational, checkedAt: isoString(checkedAt))
  }
  return ProviderStatus(level: worst.level, description: worst.text, checkedAt: isoString(checkedAt))
}

extension Copy {
  public static let allOperational = "All systems operational"
  public static let statusRow = "Status"
  public static let checkStatus = "Check provider status"
  public static let checkStatusHint =
    "Reads each provider's public status page every five minutes and marks a ring when there is an incident."

  public static func label(_ level: StatusLevel) -> String {
    switch level {
    case .none: return "Operational"
    case .maintenance: return "Maintenance"
    case .minor: return "Minor issue"
    case .major: return "Partial outage"
    case .critical: return "Major outage"
    }
  }
}
