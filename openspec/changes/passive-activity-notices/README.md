# Passive activity notices

The latch observes existing local records and presents short notifications. It cannot send messages, approve actions, or control agents. Existing usage monitoring remains enabled; agent chat remains suspended. Activity readers themselves remain local and passive.

## Sources and limits

- Claude Code: local session registry, live PID check, and bounded transcript tails. A recorded waiting state can notify; transcript tool calls, questions, and responses supply status when the registry omits it; an assistant `end_turn` marks a finished response, not proof the user's entire project is complete.
- Codex: read-only thread index and bounded rollout tails. Explicit task completion and pending synchronous `request_user_input` calls can notify. Recent writes alone remain unconfirmed. Without fresh records, current execution is unknown; pending input notices remain available. Approval prompts that are not written to the log are unavailable.
- Grok: local active-session registry, PID/start-time checks, and bounded `events.jsonl` tails. Recent event files also cover CLI versions that do not update the registry. Turn completion and permission request/resolution events drive notices.

Log formats belong to the installed provider versions and may change. Unsupported or absent records produce no invented alerts. Readers do not invoke providers, install hooks, read credentials, or contact accounts. No claim is made about universal coverage or account-enforcement guarantees.

## Presentation

New events unfold the latch and its connected card without focusing the window. Notifications group by provider in a scrollable list with room for three rows at once. Amber marks input needed; green marks a finished response. Existing geometry and spring/reduced-motion rules apply across edges and themes.

The card closes after 6.5 seconds and pauses while hovered. Waiting notices keep the latch available. Unread count badges reopen notices and mark them read; a history dot reopens read notices; meter hover and click retain the usage card; dismissal affects only Capsule. Input is handled in the original app. The queue is bounded and in memory; events from before launch or discovered over a minute late are not replayed. General settings can disable automatic popups while keeping badges and icon animation. Completion previews contain a bounded first line of the final response when available.

The usage card's Activity button also opens that provider's notifications and marks them read. Opening a list cancels pending usage hover timers. Each row's × dismisses just that notification; Clear all removes retained notifications, including read history, across every provider. The clear-all tooltip states this scope. Ordinary provider clicks still open and refresh usage; pointer capture stays on the pressed button and transfers to the dock root only when a press becomes a drag.

## Verification

- Automated parser tests cover completion versus interruption, tool use versus end of response, input resolution, invalid records, process checks, old-event suppression, and deduplication.
- A filesystem check covers bounded reads, cache refresh, and rejection of outside paths and escaping symlinks.
- HUD tests cover grouping, badges, frame sizing, and activity rendering.
- Native Electron checks use temporary home/settings directories and synthetic notices: light/dark screenshots, all four edges, dismissal, auto-collapse, and no focus stealing. These do not invoke live providers or establish that every provider version emits supported records.
