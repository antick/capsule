import Foundation

/// One meter on the dock: a provider's own sign-in, or another account of the
/// same provider kept in a folder of its own.
public struct MeterId: Hashable, Sendable, Codable, CustomStringConvertible {
  public var provider: ProviderId
  /// The added account's id, or nil for the sign-in the tool keeps by default.
  public var account: String?

  public init(_ provider: ProviderId, account: String? = nil) {
    self.provider = provider
    self.account = account
  }

  /// A stable key for logs, dictionaries and view identity. Never a path.
  public var rawValue: String { account.map { "\(provider.rawValue):\($0)" } ?? provider.rawValue }
  public var description: String { rawValue }

  public static let claude = MeterId(.claude)
  public static let codex = MeterId(.codex)
  public static let grok = MeterId(.grok)
  public static let cursor = MeterId(.cursor)
}

/// Another account of a provider: the folder its CLI keeps that sign-in in,
/// as `CLAUDE_CONFIG_DIR` or `CODEX_HOME` would name it.
public struct UsageAccount: Sendable, Codable, Equatable, Identifiable {
  public var id: String
  public var provider: ProviderId
  /// As the user gave it; may start with `~`.
  public var path: String
  public var label: String
  public var enabled: Bool

  public init(id: String, provider: ProviderId, path: String, label: String, enabled: Bool = true) {
    self.id = id
    self.provider = provider
    self.path = path
    self.label = label
    self.enabled = enabled
  }

  public var meter: MeterId { MeterId(provider, account: id) }
}

/// A folder on this Mac that looks like another account's.
public struct AccountCandidate: Sendable, Equatable, Hashable {
  public var provider: ProviderId
  /// Absolute.
  public var path: String

  public init(provider: ProviderId, path: String) {
    self.provider = provider
    self.path = path
  }
}

/// What a folder is, checked before it is added.
public enum AccountCheck: Sendable, Equatable {
  case ok
  case missing
  case notAnAccount
  case isDefault
  case alreadyAdded
  case full
}

public enum AccountRules {
  /// Providers whose CLI can keep more than one sign-in, one per folder.
  public static let supported: [ProviderId] = [.claude, .codex]
  /// Enough for anyone; keeps the rail on screen.
  public static let maxAccounts = 8
  /// Characters of a generated account id.
  public static let idLength = 8

  /// The folder each provider uses when nothing moves it, under home.
  public static func defaultFolder(_ provider: ProviderId) -> [String]? {
    switch provider {
    case .claude: return [".claude"]
    case .codex: return [".codex"]
    default: return nil
    }
  }

  /// The files, any one of which marks a folder as holding a sign-in.
  public static func markers(_ provider: ProviderId) -> [String] {
    switch provider {
    case .claude: return [UsageEndpoints.Claude.usageCacheFile, UsageEndpoints.Claude.credentialsFile]
    case .codex: return [UsageEndpoints.Codex.authFile]
    default: return []
    }
  }

  /// The prefix of a folder under home that may be another account's:
  /// `.claude_second`, `.claude-work`, `.codex_sw`.
  public static func folderPrefix(_ provider: ProviderId) -> String? {
    defaultFolder(provider)?.first
  }
}

/// Paths as the user types them and as the readers need them.
public enum AccountPaths {
  /// Absolute, with `~` expanded, `.` and `..` resolved and no trailing slash.
  public static func resolve(_ path: String, home: String) -> String {
    var text = jsTrim(path)
    if text == "~" {
      text = home
    } else if text.hasPrefix("~/") {
      text = joinPath(home, [String(text.dropFirst(2))])
    } else if !text.hasPrefix("/") {
      text = joinPath(home, [text])
    }
    let standard = (text as NSString).standardizingPath
    return standard.count > 1 && standard.hasSuffix("/") ? String(standard.dropLast()) : standard
  }

  /// A path under home written with `~`, for showing.
  public static func display(_ path: String, home: String) -> String {
    let absolute = resolve(path, home: home)
    if absolute == home { return "~" }
    return absolute.hasPrefix(home + "/") ? "~" + absolute.dropFirst(home.count) : absolute
  }

  /// "Claude · second" for `~/.claude_second`: the folder's name without the
  /// provider's own prefix, or the whole name when nothing is left.
  public static func defaultLabel(_ provider: ProviderId, path: String, home: String) -> String {
    let name = (resolve(path, home: home) as NSString).lastPathComponent
    var rest = Substring(name)
    if let prefix = AccountRules.folderPrefix(provider), rest.hasPrefix(prefix) { rest = rest.dropFirst(prefix.count) }
    let trimmed = rest.trimmingCharacters(in: CharacterSet(charactersIn: "._- "))
    let suffix = trimmed.isEmpty ? name.trimmingCharacters(in: CharacterSet(charactersIn: ".")) : trimmed
    return "\(ProviderLabels.label(provider))\(Copy.accountLabelSeparator)\(suffix)"
  }

  /// Whether the folder is the one the provider reads with no account added.
  public static func isDefault(_ provider: ProviderId, path: String, home: String) -> Bool {
    guard let folder = AccountRules.defaultFolder(provider) else { return false }
    return resolve(path, home: home) == joinPath(home, folder)
  }
}

/// Which folders under home look like other accounts. `entries` maps each
/// directory's name to the names inside it; the caller lists the disk.
public func discoverAccounts(
  home: String, entries: [String: Set<String>], existing: [UsageAccount]
) -> [AccountCandidate] {
  var found: [AccountCandidate] = []
  for provider in AccountRules.supported {
    guard let prefix = AccountRules.folderPrefix(provider) else { continue }
    let markers = AccountRules.markers(provider)
    for name in entries.keys.sorted() where name.hasPrefix(prefix) {
      let path = joinPath(home, [name])
      guard !AccountPaths.isDefault(provider, path: path, home: home),
        let contents = entries[name], markers.contains(where: contents.contains),
        !existing.contains(where: { $0.provider == provider && AccountPaths.resolve($0.path, home: home) == path })
      else { continue }
      found.append(AccountCandidate(provider: provider, path: path))
    }
  }
  return found
}

/// Whether a folder can be added as another account, given what is on disk.
public func checkAccount(
  _ provider: ProviderId, path: String, home: String, exists: Bool, contents: Set<String>,
  existing: [UsageAccount]
) -> AccountCheck {
  let absolute = AccountPaths.resolve(path, home: home)
  if AccountPaths.isDefault(provider, path: absolute, home: home) { return .isDefault }
  if existing.contains(where: { $0.provider == provider && AccountPaths.resolve($0.path, home: home) == absolute }) {
    return .alreadyAdded
  }
  guard exists else { return .missing }
  return AccountRules.markers(provider).contains(where: contents.contains) ? .ok : .notAnAccount
}

extension CapsuleSettings {
  /// The meters the dock shows, in its order: each provider's own sign-in if
  /// it is on, followed by that provider's added accounts that are on.
  public var enabledMeters: [MeterId] {
    ProviderId.allCases.flatMap { provider -> [MeterId] in
      let base = enabledProviderIds.contains(provider) ? [MeterId(provider)] : []
      return base + accounts.filter { $0.provider == provider && $0.enabled }.map(\.meter)
    }
  }

  /// What a meter is called: the account's label, or the provider's name.
  public func label(for meter: MeterId) -> String {
    meter.account.flatMap { id in accounts.first { $0.id == id }?.label } ?? ProviderLabels.label(meter.provider)
  }

  /// An id no account here has yet.
  public func newAccountId() -> String {
    var id: String
    repeat {
      id = String(UUID().uuidString.lowercased().filter(\.isHexDigit).prefix(AccountRules.idLength))
    } while accounts.contains { $0.id == id }
    return id
  }
}
