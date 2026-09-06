/**
 * Where each provider's numbers come from, and where each tool keeps the
 * login Capsule borrows to ask for them. None of these are published APIs:
 * they are what the tools' own dashboards call, and they can change without
 * notice, which is why every provider degrades to a visible status rather
 * than a made-up percentage.
 */
export const ANTHROPIC_OAUTH_USAGE_URL =
  "https://api.anthropic.com/api/oauth/usage";
export const ANTHROPIC_OAUTH_BETA_HEADER = "oauth-2025-04-20";
export const CLAUDE_KEYCHAIN_SERVICE = "Claude Code-credentials";
export const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
export const CODEX_USAGE_FALLBACK_URL =
  "https://chatgpt.com/backend-api/codex/usage";
export const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
export const CODEX_OAUTH_CLIENT_ID = "app_EMohtA1zFfdvkohgPldNB5nP";
export const GROK_BILLING_URL =
  "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
export const GROK_TOKEN_AUTH_VALUE = "xai-grok-cli";
export const GROK_USER_ID_HEADER = "x-userid";
export const USAGE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Capsule/0.1";
export const CLAUDE_USAGE_CACHE_FILE = ".claude.json";

export const CLAUDE_CREDENTIALS_PATH_SEGMENTS = [
  ".claude",
  ".credentials.json",
] as const;
export const CODEX_AUTH_PATH_SEGMENTS = [".codex", "auth.json"] as const;
export const GROK_AUTH_PATH_SEGMENTS = [".grok", "auth.json"] as const;
export const CODEX_HOME_ENV = "CODEX_HOME";
export const GROK_HOME_ENV = "GROK_HOME";

/** Cursor keeps the editor's own session token in its VS Code state store. */
export const CURSOR_STATE_DB_SEGMENTS = [
  "Library",
  "Application Support",
  "Cursor",
  "User",
  "globalStorage",
  "state.vscdb",
] as const;
export const CURSOR_TOKEN_SQL =
  "SELECT hex(value) FROM ItemTable WHERE key='cursorAuth/accessToken' LIMIT 1;";
export const CURSOR_USAGE_URL = "https://cursor.com/api/usage-summary";
export const CURSOR_LEGACY_USAGE_URL = "https://cursor.com/api/usage";
export const CURSOR_SESSION_COOKIE = "WorkosCursorSessionToken";

/** Copilot's quota, read with whatever GitHub login this Mac already has. */
export const COPILOT_USAGE_URL = "https://api.github.com/copilot_internal/user";
export const COPILOT_APPS_PATH_SEGMENTS = [
  ".config",
  "github-copilot",
  "apps.json",
] as const;
export const GITHUB_TOKEN_ENV = "GITHUB_TOKEN";
export const GH_CLI_COMMAND = "gh";
export const GH_CLI_TOKEN_ARGS = ["auth", "token"] as const;
