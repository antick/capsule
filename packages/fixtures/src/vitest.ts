import { afterAll, describe, expect, it } from "vitest";
import { openGolden } from "./index.ts";

/**
 * One `describe` per fixture file, one `it` per case, comparing the whole
 * result by deep equality against the recorded expectation. Under
 * `CAPSULE_WRITE_FIXTURES=1` it records instead; see `openGolden`.
 *
 * Kept apart from the loader so `@capsule/fixtures` itself never depends on
 * vitest — the Swift side reads the same files with no test runner involved.
 */
export function goldenSuite<Input, Expected>(
  path: string,
  run: (input: Input, now: Date) => Expected,
): void {
  const golden = openGolden<Input, Expected>(path);
  const now = golden.frozenNow ? new Date(golden.frozenNow) : new Date(0);

  describe(`${path}: ${golden.about}`, () => {
    for (const testCase of golden.cases) {
      it(testCase.name, () => {
        const actual = asJson(run(testCase.input, now));
        expect(actual).toEqual(golden.expect(testCase, actual));
      });
    }
    afterAll(() => golden.flush());
  });
}

/**
 * The value as the corpus stores it. A `Date` becomes its ISO string and an
 * absent field disappears, exactly as recording would write them, so a result
 * is compared in the same shape a Swift suite will see — not as a live object
 * that can never equal its own serialised form.
 */
function asJson<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/**
 * For a function that may refuse its input. Records a refusal as
 * `{ rejected: true }` rather than the error's text, which is a property of
 * the library that threw it and means nothing to another language.
 */
export function acceptedOrRejected<T>(
  run: () => T,
): { accepted: T } | { rejected: true } {
  try {
    return { accepted: run() };
  } catch {
    return { rejected: true };
  }
}
