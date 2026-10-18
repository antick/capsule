# Fixtures

Test cases, in JSON, read by the Swift suites through `CapsuleFixtures`. They
were extracted from the Electron app's TypeScript suites and are how the
Swift/AppKit migration transferred proven behaviour instead of re-deriving it:
see `openspec/changes/native-appkit-migration/`. The TypeScript that recorded
them is kept in git history at the `electron-final` tag.

No suite may keep a private copy of a case that lives here. A provider changes
its response shape, the fixture is corrected once, and every test reads the
correction.

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

## Values, not properties

A case is a **value**: an input and the exact output it must produce. An
inline test that asserts a **property** of the output — "the rail rides the
whole edge", "the window grows inward when the card opens" — explains intent
and stays where it is, even over inputs the corpus also covers. A test that
only re-asserts a value the corpus records is a duplicate and is removed.

That is why most geometry and placement tests are still inline while the
corpus holds their exact numbers over a wider matrix.

## Traps for a port

Things the TypeScript does that a straightforward Swift port will get wrong:

- **Rounding.** JavaScript's `Math.round` rounds halves toward +∞, so
  `Math.round(-2.5)` is `-2`. Swift's `.rounded()` rounds halves away from
  zero and gives `-3`. Use `(x + 0.5).rounded(.down)` wherever the original
  calls `Math.round`. Positive halves agree; negative ones do not.
- **Two-decimal coordinates.** Path builders round every coordinate with
  `Math.round(v * 100) / 100`. `hud-paths/` records paths as commands —
  `M`, `L`, `A` (radius, sweep, end), `C` (two controls, end), `Z` — with
  coordinates already rounded, so compare numbers rather than SVG text.
  `hud-paths/primitives` pins the rounding itself, negative halves included.
- **Scale snapping is floating-point sensitive.** `clampHudScale(1.15)` is
  `1.1` but `clampHudScale(1.25)` is `1.3`, because of how `1.15 / 0.1` and
  `1.25 / 0.1` land in binary. The cases in `hud-metrics/clamp-scale` pin it;
  do the same divisions in the same order rather than reasoning in decimal.
- **Stable sorts.** `orderSessions` and `nearestEdgeForPoint` rely on
  JavaScript's stable `sort` to break ties in insertion order. A port must sort
  stably, and `nearestEdgeForPoint` must break ties in the order left, right,
  top, bottom.
- **String ordering of timestamps.** `orderSessions` compares `since` as
  strings, not dates. See the note in `activity/order-sessions`.
- **Three epoch heuristics.** Numbers are read as times in three different
  ways, each deliberate where it lives: `resetIso` treats anything under
  `1e12` as seconds, the token readers treat anything under `1e11` as seconds,
  and local event logs treat every number as milliseconds. Port each one as
  written rather than sharing a helper between them.
- **Insertion-ordered sets.** The notice tracker evicts the oldest remembered
  id first once it holds `maxSeen`, which relies on JavaScript's `Set`
  iterating in insertion order. A Swift `Set` does not; use an ordered
  structure.
- **Unordered dictionaries.** JSON object key order does not survive a Swift
  `Dictionary`. Anything that takes "the first entry" of an object needs an
  ordered decode, or a deliberate, documented tie-break.
- **Refusals.** A function that may refuse its input records
  `{ "rejected": true }`, never the error text, which belongs to the library
  that threw it.

## Won't port

Some fixtures pin Electron behaviour the native app deliberately does not
match. The Swift coverage gate lists each in `wontPort` with the decision that
says why, so they cannot be mistaken for gaps:

- `settings/migrate-legacy` — design decision 9: a settings file older than
  schema v7 falls back to defaults and onboarding instead of being migrated.

## Reading them

Swift, through `CapsuleFixtures`, which finds this folder by walking up to
`Package.swift`:

```swift
let file: FixtureFile<Double, String> = try Fixtures.load("severity/for-percent")
for testCase in file.cases { /* ... */ }
```

The coverage gate in `Tests/CapsuleCoreTests/CorpusCoverageTests.swift` fails
when a file here is read by no test and is not listed as deliberately not
ported.

### Hand-written vs recorded expectations

Most `expected` values are hand-written. The provider mappings, the stub
worlds and much of the geometry were **recorded** from the TypeScript
implementation, because a full mapped snapshot is too large to transcribe.
With that implementation retired, a case is now changed by hand, in a commit
that says why — the same way a recorded case was re-recorded before: never in
CI, and only after the Swift behaviour it pins has been decided.

## What is here

| Area | Files | Cases |
| --- | --- | --- |
| `usage/` | 15 | 120 |
| `activity/` | 19 | 168 |
| `placement/` | 6 | 132 |
| `hud-metrics/` | 9 | 173 |
| `hud-paths/` | 8 | 271 |
| `settings/` | 3 | 41 |
| `updates/` | 6 | 43 |
| `dates/` | 5 | 17 |
| `severity/` | 1 | 10 |
| **Total** | **72** | **975** |

Every file here is read by the Swift suite except `settings/migrate-legacy`,
which pins Electron behaviour the native app deliberately does not match.

## Stub worlds

Some cases describe a world rather than a value, and the function runs
against a stub built from it:

- **`usage/provider-reads`** — files, keychain secrets, commands,
  environment variables and canned HTTP responses. A response matches on url,
  and on method and authorization when it names them; a request nothing
  matches fails as a network error. Each case records the outcome and **every
  request made**, headers lower-cased, so a port has to ask the same questions
  in the same order. Cursor's token is recorded as the original's `sqlite3`
  command; a port that queries the store directly serves that command's
  output as the query's single cell.
- **`usage/poller`** — providers with scripted answers and a script of steps.
  Each step records what was emitted, fetched and published, and the backoff
  and snapshots saved. A provider call the scenario did not script fails the
  recording, since the poller swallows provider errors.
- **`activity/*-reader`, `activity/token-scan`, `activity/token-scanner`,
  `activity/monitor`** — files, directory listings, modification times, live
  processes with their start times, and SQLite rows. Each records what was
  found and every SQL query and tail read made.

The recorders clear `CODEX_HOME`, `GROK_HOME` and `GITHUB_TOKEN` for every
case, so nothing on the recording machine leaks into the corpus.

## Deliberately not portable

These stayed inline because there is no value for a Swift suite to compare
against:

- `formatResetCopy` picking a style — the assertion is a shape (`/^Resets in /`),
  not a value.
- `startOfDay` zeroing the hour — a property of every result, not one mapping.
- The demo provider, which returns fixed numbers and has nothing to port.
- A poller with nothing enabled. The original loops forever there, and a hang
  cannot be a fixture; the Swift poller's corrected rule is pinned by a
  native test instead.
- The dock's React rendering: `UsageDock.test.ts` and
  `activity-notices.test.ts` assert on rendered markup. The native dock is
  drawn with layers, and its look is checked by the snapshot target (design
  decision 13), not by values in this corpus.
- CSS-only helpers in `packages/hud`: `reveal.ts`, `shadow.ts`,
  `dock-stylesheet.ts`, and the `transform-origin` strings from
  `bubbleOrigin` and `cardOrigin`. Core Animation replaces all of them; the
  tail tip and card they were computed from are in `hud-paths/blob-layout`.
- The corner arc's silhouettes in `corner-path.test.ts`, for the same reason
  as its geometry above.
- The agent chat: `claude-channel.test.ts` and `codex-connection.test.ts`. The
  feature is suspended — its source is kept but inactive, per `AGENTS.md` — and
  it is not part of the native app, so nothing about it is extracted.
- The corner arc. It is dead behind `CORNER_ARC_ENABLED = false` and is not
  being ported, so its cases are **not extracted**. The TypeScript source and
  its tests stay in the tree until Phase 4 and in git history after it; if the
  arc is ever revived, author inputs and record its goldens then.
- The spring and animated-number helpers in `packages/config/src/motion.ts`.
  Design decision 6 replaces them with Core Animation, so there is no Swift
  function to hold to their values.

## Findings from the extraction

Recording full snapshots surfaced behaviour the previous assertions never
reached, because no test passed an empty or unexpected payload.

**Three of the five providers invented a zero — fixed.** Given a payload with
no utilization in it, `mapClaudeUsage`, `mapCodexUsage` and `mapGrokCredits`
returned `primaryPercent: 0` with `status: "ok"`. Claude and Grok went further
and fabricated buckets: an "All models" row at 0% whose reset time was "now",
a "Weekly credits" row at 0%. So a successful HTTP 200 carrying a body Capsule
could not read showed the user a confident `0% Used`, contradicting the
README's promise that Capsule "marks it as stale instead of inventing a
number".

All three now build a bucket only for a window the payload actually carried,
take `primaryPercent` from the first bucket there is, and report
`status: "error"` when there is none — which is what `mergeSnapshot` needs to
keep the last good reading and date it, rather than publishing the nothing over
it. The affected cases were re-recorded, and cases were added for the paths the
fix opens up: a Claude payload with only a weekly window, a Codex window that
reports a reset but no percentage, a Grok product row with no headline credit
percent. The real mappings (Claude 73/7, Codex 21/8, Grok 52/18) are unchanged.

`mapCursorUsage` already returned `primaryPercent: null` with no buckets and was
left alone. (So did the Copilot mapping, before Copilot was removed from the
app.)

### Found while recording the stub worlds

- **Grok had no 429 branch.** A rate-limited Grok read failed as a generic
  error, so the poller never backed off for it. Fixed: `usage/provider-reads`
  now expects a rate-limit outcome, and honours `Retry-After`.
- **A poller with nothing enabled loops forever.** It lands the default
  placeholder set, finds every one of them unread, and queues another refresh.
  Reachable from Settings by switching off the last provider. Not recorded —
  it cannot be — and fixed in the Swift poller.
- **The follow-up after a mid-fetch toggle re-reads every enabled provider**,
  not only the one switched on. Noted in its `usage/poller` case.
