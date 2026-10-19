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

  public static let commandLine = "Command line"
  public static let commandLineHint =
    "Adds the capsule command, which prints these limits as JSON for scripts and agents. Linked in ~/.local/bin; no password needed."
  public static let installCommandLine = "Install"
  public static let reinstallCommandLine = "Reinstall"
  public static let apiKeys = "API keys and sessions"
  public static let apiKeysHint =
    "For providers with no login on this Mac. Kept in a file only your account can read, in Capsule's own folder; never shown again once saved."
  public static let keySaved = "Saved"
  public static let keyNotSet = "Not set"
  public static let saveKey = "Save"
  public static let clearKey = "Clear"
  public static let pasteKey = "Paste here"

  public static func label(_ key: StoredKey) -> String {
    switch key {
    case .openrouter: return "OpenRouter API key"
    case .deepseek: return "DeepSeek API key"
    case .devin: return "Devin (Windsurf) API key"
    case .claudeConsole: return "Claude Console session"
    }
  }

  public static func hint(_ key: StoredKey) -> String {
    switch key {
    case .openrouter: return "openrouter.ai → Keys. Shows balance, key limit and spend."
    case .deepseek: return "platform.deepseek.com → API keys. Shows the balance."
    case .devin: return "Only needed when Devin's app isn't signed in on this Mac."
    case .claudeConsole:
      return "The sessionKey cookie from platform.claude.com, for the API credit your Max plan includes each month."
    }
  }

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
