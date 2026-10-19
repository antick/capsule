import CapsuleCore

/// Every reader there is, in the dock's order: each provider's own sign-in,
/// then any account added for it. Shared by the app and the command line.
public func usageProviders(_ settings: CapsuleSettings) -> [UsageProvider] {
  let added: [UsageProvider] = settings.accounts.compactMap { account in
    switch account.provider {
    case .claude: return ClaudeUsageProvider(account: account)
    case .codex: return CodexUsageProvider(account: account)
    default: return nil
    }
  }
  return [
    ClaudeUsageProvider(), CodexUsageProvider(), GrokUsageProvider(), CursorUsageProvider(),
    AntigravityUsageProvider(), DevinUsageProvider(), OpenRouterUsageProvider(), DeepSeekUsageProvider(),
  ] + added
}
