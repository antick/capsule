import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One extracted test case. `input` and `expected` are whatever the function
 * under test takes and returns, encoded as JSON so a Swift suite can read the
 * same case. Anything that cannot survive that encoding — a callback, a live
 * clock, a spy — belongs in an inline test instead.
 */
export interface FixtureCase<Input = unknown, Expected = unknown> {
  name: string;
  input: Input;
  expected: Expected;
  /** Why this case exists, when the inputs alone do not say. */
  note?: string;
}

export interface FixtureFile<Input = unknown, Expected = unknown> {
  /** The function or behavior this file covers. */
  about: string;
  /**
   * Zone the cases are written in. Required whenever a case formats or parses
   * wall-clock time, because the same instant produces different copy in
   * different zones. Suites reading the file must run in this zone.
   */
  timeZone?: string;
  locale?: string;
  /** The instant that stands in for "now", ISO-8601 with an offset. */
  frozenNow?: string;
  cases: FixtureCase<Input, Expected>[];
}

/** Repo-root `fixtures/`, found by walking up from this file. */
function fixturesRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 10; depth += 1) {
    try {
      if (readdirSync(dir).includes("pnpm-workspace.yaml")) {
        return join(dir, "fixtures");
      }
    } catch {
      // Unreadable directory on the way up is not fatal; keep walking.
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(
    "fixtures root not found: no pnpm-workspace.yaml above this file",
  );
}

const ROOT = fixturesRoot();

/** `loadFixture("dates/reset-relative")` reads `fixtures/dates/reset-relative.json`. */
export function loadFixture<Input = unknown, Expected = unknown>(
  path: string,
): FixtureFile<Input, Expected> {
  const file = resolve(ROOT, `${path}.json`);
  if (!file.startsWith(ROOT)) {
    throw new Error(`fixture path escapes the corpus: ${path}`);
  }
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new Error(`fixture not found: ${path}.json`);
  }
  const parsed = JSON.parse(raw) as FixtureFile<Input, Expected>;
  if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) {
    throw new Error(`fixture has no cases: ${path}.json`);
  }
  return parsed;
}

/** The cases alone, for a file whose header the test does not need. */
export function loadCases<Input = unknown, Expected = unknown>(
  path: string,
): FixtureCase<Input, Expected>[] {
  return loadFixture<Input, Expected>(path).cases;
}

/**
 * `frozenNow` as a Date. Throws rather than falling back to the real clock,
 * so a case that depends on "now" cannot pass by accident.
 */
export function frozenNow(file: FixtureFile): Date {
  if (!file.frozenNow) {
    throw new Error(`fixture declares no frozenNow: ${file.about}`);
  }
  const now = new Date(file.frozenNow);
  if (Number.isNaN(now.getTime())) {
    throw new Error(`fixture frozenNow is not a date: ${file.frozenNow}`);
  }
  return now;
}

/** Every fixture path in the corpus, as `loadFixture` takes them. */
export function allFixturePaths(): string[] {
  const found: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith(".json")) {
        found.push(`${prefix}${entry.name.slice(0, -".json".length)}`);
      }
    }
  };
  walk(ROOT, "");
  return found.sort();
}

/**
 * A fixture whose `expected` values are recorded from the TypeScript
 * implementation rather than hand-written, because the full result of a
 * provider mapping is too large to transcribe by hand and a Swift port needs
 * all of it, not the handful of fields a hand-written assertion checked.
 *
 * Run a suite with `CAPSULE_WRITE_FIXTURES=1` to record. Recording is a
 * deliberate act: it rewrites the corpus, so it belongs in a commit a human
 * read, never in CI.
 */
export interface Golden<Input, Expected> {
  readonly about: string;
  readonly cases: FixtureCase<Input, Expected>[];
  readonly frozenNow?: string;
  readonly recording: boolean;
  /**
   * The value to compare against. While recording, takes `actual` as the new
   * expectation and returns it, so the assertion passes and the case is
   * stored. Otherwise returns what the corpus holds.
   */
  expect(testCase: FixtureCase<Input, Expected>, actual: Expected): Expected;
  /** Write recorded expectations back to disk. No-op when not recording. */
  flush(): void;
}

export function isRecording(): boolean {
  return process.env.CAPSULE_WRITE_FIXTURES === "1";
}

export function openGolden<Input = unknown, Expected = unknown>(
  path: string,
): Golden<Input, Expected> {
  const file = loadFixture<Input, Expected>(path);
  const recording = isRecording();
  const recorded = new Map<string, Expected>();
  return {
    about: file.about,
    cases: file.cases,
    frozenNow: file.frozenNow,
    recording,
    expect(testCase, actual) {
      if (!recording) {
        return testCase.expected;
      }
      recorded.set(testCase.name, actual);
      return actual;
    },
    flush() {
      if (!recording || recorded.size === 0) {
        return;
      }
      const next: FixtureFile<Input, Expected> = {
        ...file,
        cases: file.cases.map((testCase) =>
          recorded.has(testCase.name)
            ? { ...testCase, expected: recorded.get(testCase.name) as Expected }
            : testCase,
        ),
      };
      writeFileSync(
        resolve(ROOT, `${path}.json`),
        `${JSON.stringify(next, null, 2)}\n`,
        "utf8",
      );
    },
  };
}
