import Foundation

/// Where each provider's usage lives, and what it expects to be sent. The only
/// place these values live. Reading them is reading the user's own session
/// with each provider; nothing here signs in or holds a credential.
public enum UsageEndpoints {
  public static let userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Capsule/0.1"

  public enum Claude {
    public static let usageURL = "https://api.anthropic.com/api/oauth/usage"
    public static let betaHeader = "oauth-2025-04-20"
    public static let credentialsPath = [".claude", ".credentials.json"]
    public static let keychainService = "Claude Code-credentials"
    public static let usageCacheFile = ".claude.json"
  }

  public enum Codex {
    public static let usageURL = "https://chatgpt.com/backend-api/wham/usage"
    public static let fallbackURL = "https://chatgpt.com/backend-api/codex/usage"
    public static let tokenURL = "https://auth.openai.com/oauth/token"
    public static let clientId = "app_EMohtA1zFfdvkohgPldNB5nP"
    public static let authPath = [".codex", "auth.json"]
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
