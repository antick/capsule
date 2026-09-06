# Account access and chat suspended

The user requested this change on September 6, 2026, because account safety takes priority over live usage and chat.

- Removed all three credential-based usage adapters, account endpoint constants, keychain access, and token refresh logic. The usage host now publishes only disabled snapshots or explicit demo data, with no timers, credential reads, or network capabilities.
- Kept the chat implementation in source, disconnected its startup and UI entry points, and set its shared guard to false. No user setting or environment variable enables it. Its old standalone launcher exits with a disabled message and does not import the channel implementation.
- Retained local passive session observation. It reads local activity records and does not launch an agent or send provider requests.
- Stopped the running Capsule development server and app. A subsequent process check found no running Capsule project processes; the user's Capsule channel directory contained zero socket files. No Capsule application was found in either standard Applications directory. The app was left stopped.

## Verification

- `pnpm test`: 230 pass. Six preserved integration tests are deliberately skipped while chat is suspended (four channel tests and two connection-manager tests). Remaining protocol checks use mocks only.
- New checks prove refresh/settings paths stay offline without polling timers, disabled usage clears old numbers, saved preload chat commands send no IPC, and the guarded connection manager performs no discovery, process launch, socket connection, send, or approval.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass. Lint reports one pre-existing unused-import warning in unchanged `overlay-window.ts`.
- Inspected the built JavaScript: no removed account endpoint strings, keychain reader, token refresh, agent manager, agent panel, or Claude channel transport. The chat renderer is absent. The standalone entry only prints the disabled message and sets its exit code.
- Did not invoke a live provider, start a channel transport, send an agent message, or relaunch Capsule for this change. No dependencies were added or upgraded. No account credentials or provider settings were modified.

These checks establish what this Capsule build does. They cannot guarantee account outcomes from earlier activity, other applications, or future provider policy changes.
