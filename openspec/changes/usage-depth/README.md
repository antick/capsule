# Usage depth, menu bar, and more providers

Brings Capsule level with CodexBar and OpenUsage where it matters for one
question: can I start that long task now? Usage monitoring stays as it is;
agent chat stays suspended. Widgets are deferred.

## Items

Each item ships as its own commit, verified in the running dev app.

1. **Where Capsule lives.** Settings choose the edge dock (latch), the menu
   bar, or both. In the menu bar a click opens a panel listing every meter's
   card; a right-click opens the commands.
2. **Dollar spend from local logs.** Today, yesterday and the last 30 days
   for Claude, Codex and Grok, estimated from token counts in their local
   logs and published model prices, refreshed daily, with a bundled fallback.
3. **Pace.** Each window's used share against the share of the window that
   has passed: ahead, on track or behind, and when it would run out at the
   current rate.
4. **Claude extra usage and API credit grant.** The paid overage beyond the
   plan, and the monthly API credit that Max plans include, where a source
   exists.
5. **Codex credits.** The credit balance next to the windows.
6. **Cursor detail.** Credits, total usage, Grok Bot pool, Cursor and other
   models, requests, on-demand spend, spend per day.
7. **Usage history charts.** Readings stored over time and drawn per window.
8. **New providers.** Gemini (CLI login), Antigravity, Devin, OpenRouter,
   DeepSeek.
9. **API keys.** A place in Settings to paste a key for providers with no
   local login, kept in Capsule's own keychain item. Devin reads Chrome's
   session first and falls back to a pasted token.
10. **Provider status.** Each provider's status page polled; an incident
    shows as a badge on its ring and in its card.
11. **Quota notifications.** A macOS notification when a window crosses a
    chosen threshold, once per window, and a celebration when a weekly
    window resets.
12. **Menu-bar display.** The menu-bar item shows the app icon, one meter's
    icon and percentage (chosen or the highest), or pinned metrics as text or
    mini bars.
13. **Rows.** Hide, star (pin to the top) and reorder individual metrics.
14. **Flip in place.** Clicking a percentage flips used/left everywhere;
    clicking a reset time flips countdown/date.
15. **Adaptive refresh.** Polls quicker while agents work and right after a
    change, slower while idle, slowest on battery saver or a locked screen.
16. **CLI.** `capsule` prints the current limits as JSON from the app's own
    cache, with `--refresh` to read the providers itself.
17. **Homebrew.** A cask in `antick/homebrew-tap`, bumped by the release
    workflow.

Deferred: WidgetKit widgets (they need an Xcode-built extension).

## Verification

Unit tests for every mapper, formula and setting; the dock and settings
driven through Accessibility in the dev build; no live chat or provider
writes.
