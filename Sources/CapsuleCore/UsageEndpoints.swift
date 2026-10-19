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
    /// What one Codex credit costs to buy, for showing a balance in dollars.
    public static let dollarsPerCredit = 0.04
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
    /// Prepaid credit grants, over Cursor's own RPC with the app's token.
    public static let creditGrantsURL = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCreditGrantsBalance"
    public static let connectProtocolHeader = "Connect-Protocol-Version"
    public static let connectProtocolVersion = "1"
    /// The Stripe account, whose negative balance is credit held.
    public static let stripeURL = "https://cursor.com/api/auth/stripe"
    /// The Grok Bot allowance.
    public static let grokBotURL = "https://cursor.com/api/dashboard/get-sand-usage-status"
    /// Each request's cost, for spend per day.
    public static let usageEventsURL = "https://cursor.com/api/dashboard/get-filtered-usage-events"
    public static let eventsPageSize = 1_000
    /// Enough for a very busy month; a longer history is cut off, not chased.
    public static let maxEventPages = 20
    /// Spend is read again at most this often.
    public static let spendRefreshSeconds = 3_600.0
    public static let stateDatabasePath = [
      "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb",
    ]
    public static let tokenSQL =
      "SELECT hex(value) FROM ItemTable WHERE key='cursorAuth/accessToken' LIMIT 1;"
  }
}

extension UsageEndpoints {
  public enum OpenRouter {
    public static let creditsURL = "https://openrouter.ai/api/v1/credits"
    public static let keyURL = "https://openrouter.ai/api/v1/key"
    public static let keyEnv = "OPENROUTER_API_KEY"
  }

  public enum DeepSeek {
    public static let balanceURL = "https://api.deepseek.com/user/balance"
    public static let keyEnv = "DEEPSEEK_API_KEY"
  }

  public enum Devin {
    /// Devin's desktop app keeps its Windsurf API key here.
    public static let stateDatabasePath = [
      "Library", "Application Support", "Devin", "User", "globalStorage", "state.vscdb",
    ]
    public static let authSQL = "SELECT value FROM ItemTable WHERE key='windsurfAuthStatus' LIMIT 1;"
    /// The CLI's own login, when there is one.
    public static let credentialsPath = [".local", "share", "devin", "credentials.toml"]
    public static let defaultServer = "https://server.codeium.com"
    public static let statusPath = "/exa.seat_management_pb.SeatManagementService/GetUserStatus"
    public static let clientVersion = "1.108.2"
  }

  public enum Antigravity {
    /// The local language server's RPC, reached on loopback.
    public static let servicePath = "/exa.language_server_pb.LanguageServerService/"
    public static let quotaMethod = "RetrieveUserQuotaSummary"
    public static let csrfHeader = "X-Codeium-Csrf-Token"
    public static let processNames = ["language_server", "language_server_macos", "language_server_macos_arm"]
    public static let processMarkers = ["antigravity"]
    /// The saved Google login, written by Antigravity through the keychain tool.
    public static let keychainService = "gemini"
    public static let keychainAccount = "antigravity"
    public static let keychainPrefix = "go-keyring-base64:"
    public static let cloudURL = "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary"
    public static let userAgent = "antigravity"
  }

  public enum ClaudeConsole {
    /// The Console's own web API, reached with its session cookie.
    public static let base = "https://platform.claude.com"
    public static let organizationsPath = "/api/organizations"
    public static let cookieName = "sessionKey"
    public static let subscriptionProgram = "subscription_api_credit"
  }
}

/// Keys the user pastes into Settings, kept in a file only they can read.
public enum StoredKey: String, Sendable, CaseIterable {
  case openrouter, deepseek, devin, claudeConsole = "claude-console"

  public static let fileName = "keys.json"
}

/// The tool every keychain read goes through. See `keychainPassword`.
public enum KeychainTool {
  public static let path = "/usr/bin/security"
  public static let timeoutSeconds = 5.0
}
