import CapsuleCore
import Foundation

public struct CursorPlan: Sendable, Codable, Equatable {
  public var used: Double?
  public var limit: Double?
  public var totalPercentUsed: Double?
}

public struct CursorSummary: Sendable, Codable, Equatable {
  public struct Individual: Sendable, Codable, Equatable {
    public var plan: CursorPlan?
    public var overall: CursorPlan?
  }
  public var billingCycleEnd: String?
  public var individualUsage: Individual?
}

/// Cursor stores the token as a blob, so it is read back as hex to survive the
/// trip through the shell. Anything that is not hex is taken as the token.
public func cursorTokenFromHex(_ output: String?) -> String? {
  let trimmed =
    output?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  if trimmed.isEmpty { return nil }

  let isHex =
    trimmed.count % 2 == 0
    && trimmed.allSatisfy { $0.isHexDigit }
  if !isHex { return trimmed }

  var bytes: [UInt8] = []
  bytes.reserveCapacity(trimmed.count / 2)
  var index = trimmed.startIndex
  while index < trimmed.endIndex {
    let next = trimmed.index(index, offsetBy: 2)
    guard let byte = UInt8(trimmed[index..<next], radix: 16) else { return nil }
    bytes.append(byte)
    index = next
  }
  let decoded = String(decoding: bytes, as: UTF8.self)
    .trimmingCharacters(in: .whitespacesAndNewlines)
  return decoded.isEmpty ? nil : decoded
}

/// The `sub` claim of a JWT, which Cursor uses as the user id. The signature
/// is irrelevant here: this reads the token, it does not trust it.
public func jwtSubject(_ token: String) -> String? {
  let parts = token.split(separator: ".", omittingEmptySubsequences: false)
  guard parts.count > 1, let data = base64URLDecoded(String(parts[1])) else {
    return nil
  }
  struct Claims: Decodable { var sub: String? }
  guard let claims = try? JSONDecoder().decode(Claims.self, from: data),
    let sub = claims.sub, !sub.isEmpty
  else { return nil }
  return sub
}

func base64URLDecoded(_ raw: String) -> Data? {
  var text = raw.replacingOccurrences(of: "-", with: "+")
    .replacingOccurrences(of: "_", with: "/")
  let remainder = text.count % 4
  if remainder > 0 { text += String(repeating: "=", count: 4 - remainder) }
  return Data(base64Encoded: text)
}

public func mapCursorUsage(
  _ payload: CursorSummary,
  fetchedAt: Date
) -> UsageSnapshot {
  let plan = payload.individualUsage?.plan ?? payload.individualUsage?.overall
  var percent: Double?
  if let stated = plan?.totalPercentUsed {
    percent = toPercent(stated)
  } else if let used = plan?.used, let limit = plan?.limit, limit > 0 {
    percent = toPercent((used / limit) * 100)
  }

  return UsageSnapshot(
    providerId: .cursor,
    displayName: ProviderLabels.label(.cursor),
    iconId: .cursor,
    primaryPercent: percent,
    buckets: percent.map {
      [
        UsageBucket(
          id: "plan",
          label: Copy.cursorPlan,
          percentUsed: $0,
          resetsAt: resetIso(
            payload.billingCycleEnd.map(NumberOrString.string),
            fallback: fetchedAt
          ),
          resetStyle: .absolute
        )
      ]
    } ?? [],
    status: .ok,
    fetchedAt: isoString(fetchedAt)
  )
}
