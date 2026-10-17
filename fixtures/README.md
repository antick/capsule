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

The recorder is the corpus's only writer, so every file is exactly
`JSON.stringify(value, null, 2)` plus a newline. Biome is told to leave
`fixtures/**/*.json` alone: a formatter collapsing short arrays would turn
every re-record into a whitespace diff that hides the change that matters.

## What is here

| Area | Files | Cases |
| --- | --- | --- |
| `usage/` | 14 | 67 |
| `activity/` | 13 | 126 |
| `placement/` | 6 | 129 |
| `hud-metrics/` | 9 | 173 |
| `hud-paths/` | 8 | 271 |
| `settings/` | 3 | 41 |
| `updates/` | 6 | 43 |
| `dates/` | 5 | 17 |
| `severity/` | 1 | 10 |
| **Total** | **65** | **877** |

Phase 0's extraction is done for everything the native app ports — usage,
activity, placement and sizing, settings, updates, and the dock's
silhouettes. Two pieces remain, neither of which blocks a Swift module:

- **The stubbed-host scenarios** (task 1.3a): a provider's full read with a
  stubbed `fetch`, `readFile` and `readSecret`, and the activity readers'
  walks over a stubbed filesystem. Their parsers are in the corpus; the wiring
  around them is not yet data.
- **`apps/desktop`'s 13 test files**, which cover the Electron main process —
  overlay placement, Dock and notch probing, the update host. They matter to
  the Phase 2 shell, not to the logic modules.

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
- Reading activity off disk — the Claude registry walk, the Codex state
  database and rollout scan, Grok session discovery, the token log scanner, and
  the activity monitor itself. Each needs a stubbed host. Everything they hand
  their parsers *is* in the corpus.
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

`mapCursorUsage` and `mapCopilotUsage` already returned `primaryPercent: null`
with no buckets and were left alone. They keep `status: "ok"`, because for
Copilot an absent percentage is often a legitimate, permanent answer — an
unlimited quota has no percentage to show — and calling that an error would pin
a stale reading on it forever.
