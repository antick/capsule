# Fixtures

Extracted test cases, in JSON, read by **both** the TypeScript suites and —
from Phase 1 — the Swift suites. They are the mechanism by which the
Swift/AppKit migration transfers proven behaviour instead of re-deriving it:
see `openspec/changes/native-appkit-migration/`.

Neither language's suite may keep a private copy of a case that lives here. A
provider changes its response shape, the fixture is corrected once, and both
suites read the correction.

## Shape

One JSON object per file:

```json
{
  "about": "the function this file covers, and in what terms",
  "timeZone": "UTC",
  "locale": "en-US",
  "frozenNow": "2026-08-27T11:22:00Z",
  "cases": [
    { "name": "...", "input": ..., "expected": ..., "note": "why this case exists" }
  ]
}
```

- `timeZone` is **required whenever a case formats or parses wall-clock time**,
  and a suite reading the file must run in it. The repo previously had no
  vitest config and no `TZ`, so the date tests passed only because local-time
  construction and local formatting cancelled out. Every package's `test`
  script now pins `TZ=UTC`.
- `frozenNow` stands in for "now". The loader throws rather than falling back
  to the real clock, so a case that needs it cannot pass by accident.
- `input` and `expected` must survive JSON. A case needing a callback, a spy,
  or a live socket is not portable and stays an inline test.

## Reading them

TypeScript, through `@capsule/fixtures`:

```ts
import { loadCases, loadFixture, frozenNow, openGolden } from "@capsule/fixtures";

for (const c of loadCases<number, string>("severity/for-percent")) { /* ... */ }
```

### Hand-written vs recorded expectations

Most `expected` values are hand-written. The provider mappings are **recorded**
from the TypeScript implementation via `openGolden`, because a full mapped
snapshot is too large to transcribe and the Swift port needs all of it, not the
four fields a hand-written assertion reached for. Each recorded case therefore
asserts deep equality, which subsumes the original assertion rather than
weakening it.

Re-record with `CAPSULE_WRITE_FIXTURES=1`. That rewrites the corpus, so it
belongs in a commit a human has read — never in CI.

## What is here

| Area | Files | Cases |
| --- | --- | --- |
| `usage/` | 14 | 64 |
| `dates/` | 5 | 17 |
| `severity/` | 1 | 10 |
| `activity/` | 1 | 8 |
| **Total** | **21** | **99** |

Still to extract (Phase 0 is not finished): the rest of `packages/activity`
(session reading, Codex JSON-RPC, local events, token totals), the geometry,
snapping, motion, settings-migration and update-state cases in
`packages/config`, the silhouette path cases in `packages/hud`, and the
portable cases among `apps/desktop`'s 13 test files.

## Deliberately not portable

These stayed inline because there is no value for a Swift suite to compare
against:

- `formatResetCopy` picking a style — the assertion is a shape (`/^Resets in /`),
  not a value.
- `startOfDay` zeroing the hour — a property of every result, not one mapping.
- Provider `fetchSnapshot` wiring — the rate-limit fallback, the cache
  rollover rejection, and the keychain fallback all need a stubbed `fetch`,
  `readFile`, and `readSecret`. The *scenarios* are worth porting; encoding
  them as data is a follow-up, not part of this pass.
- `rememberedSnapshots`, the poller's enabled-provider filtering, and the demo
  provider — all need injected hosts or spies.
- The corner-arc cases, once extracted, will sit unexecuted: the feature is
  dead behind `CORNER_ARC_ENABLED = false` and is not being ported. They are
  kept so the decision stays reversible.

## Findings from the extraction

Recording full snapshots surfaced behaviour the previous assertions never
reached, because no test passed an empty or unexpected payload:

**Three of the five providers invent a zero.** Given a payload with no
utilization in it, `mapClaudeUsage`, `mapCodexUsage`, and `mapGrokCredits`
return `primaryPercent: 0` with `status: "ok"`. Claude and Grok go further and
fabricate buckets — an "All models" row at 0% whose reset time is "now", a
"Weekly credits" row at 0%. `mapCursorUsage` and `mapCopilotUsage` return
`primaryPercent: null` for the same thing, which is right.

So a successful HTTP 200 carrying a body Capsule does not understand shows the
user a confident `0% Used`, contradicting the README's promise that Capsule
"marks it as stale instead of inventing a number". The affected cases are
recorded as-is and flagged in their `note`, so the port stays faithful — but
they should be fixed in the TypeScript app first, with the fixtures re-recorded,
rather than carried into Swift.
