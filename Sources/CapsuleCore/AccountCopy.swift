import Foundation

/// What the settings window says about added accounts.
extension Copy {
  public static let otherAccounts = "Other accounts"
  public static let otherAccountsHint =
    "Another Claude Code or Codex sign-in, kept in its own folder (the one CLAUDE_CONFIG_DIR or CODEX_HOME points at). Each gets its own ring after the provider's own."
  public static let foundAccount = "Found on this Mac"
  public static let addAccount = "Add"
  public static let chooseFolder = "Choose…"
  public static let accountPathPlaceholder = "~/.claude-work"
  public static let accountProvider = "Provider"
  public static let removeAccount = "Remove account"
  public static let accountLabel = "Name"
  public static let renameHint = "Click to rename. Shown on the dock's card."

  public static func accountCheck(_ check: AccountCheck) -> String? {
    switch check {
    case .ok: return nil
    case .missing: return "There is no folder there."
    case .notAnAccount: return "That folder has no sign-in in it. Sign in with that folder set first."
    case .isDefault: return "That is the default sign-in, which is already shown."
    case .alreadyAdded: return "That account is already added."
    case .full: return "That is as many accounts as Capsule shows."
    }
  }
}
