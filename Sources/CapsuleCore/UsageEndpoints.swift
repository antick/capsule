import Foundation

/// Where each provider's usage lives, and what it expects to be sent. The only
/// place these values live. Reading them is reading the user's own session
/// with each provider; nothing here signs in or holds a credential.
public enum UsageEndpoints {
  public static let userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Capsule/0.1"

  public enum Claude {
    public static let usageURL = "https://api.anthropic.com/api/oauth/usage"
    public static let betaHeader = "oauth-2025-04-20"
    public static let credentialsFile = ".credentials.json"
    public static let credentialsPath = [".claude", credentialsFile]
    public static let keychainService = "Claude Code-credentials"
    /// An account in its own `CLAUDE_CONFIG_DIR` keeps its keychain item
    /// under the service name plus `-` and this many hex characters of the
    /// folder path's SHA-256.
    public static let keychainHashLength = 8
    public static let usageCacheFile = ".claude.json"
  }

  public enum Codex {
    public static let usageURL = "https://chatgpt.com/backend-api/wham/usage"
    public static let fallbackURL = "https://chatgpt.com/backend-api/codex/usage"
    public static let tokenURL = "https://auth.openai.com/oauth/token"
    public static let clientId = "app_EMohtA1zFfdvkohgPldNB5nP"
    public static let authFile = "auth.json"
    public static let authPath = [".codex", authFile]
    public static let homeEnv = "CODEX_HOME"
  }

  public enum Grok {
    public static let billingURL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits"
    public static let tokenAuthValue = "xai-grok-cli"
    public static let userIdHeader = "x-userid"
    public static let authPath = [".grok", "auth.json"]
    public static let homeEnv = "GROK_HOME"
  }

  public enum Cursor {
    /// The included usage for the current period — weekly on the newer
    /// plans — as the editor's dashboard shows it: total, Cursor's own
    /// models, and other models.
    public static let periodUsageURL = "https://cursor.com/api/dashboard/get-current-period-usage"
    public static let dashboardOrigin = "https://cursor.com"
    public static let dashboardReferer = "https://cursor.com/dashboard"
    public static let usageURL = "https://cursor.com/api/usage-summary"
    public static let legacyURL = "https://cursor.com/api/usage"
    public static let sessionCookie = "WorkosCursorSessionToken"
    public static let stateDatabasePath = [
      "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb",
    ]
    public static let tokenSQL =
      "SELECT hex(value) FROM ItemTable WHERE key='cursorAuth/accessToken' LIMIT 1;"
  }
}

/// The tool every keychain read goes through. See `keychainPassword`.
public enum KeychainTool {
  public static let path = "/usr/bin/security"
  public static let timeoutSeconds = 5.0
}
