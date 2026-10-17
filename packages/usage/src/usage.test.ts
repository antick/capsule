import { describe, expect, it } from "vitest";
import { createDemoProvider } from "./providers/demo.ts";

/**
 * Pure mapping, each provider's whole read, and the poller are in the fixture
 * corpus; see `providers/mapping.test.ts`, `reads-fixtures.test.ts` and
 * `poller-fixtures.test.ts`. What is left here is the demo provider.
 */
describe("demo provider", () => {
  it("returns the reference Claude snapshot", async () => {
    const provider = createDemoProvider("claude");
    const snapshot = await provider.fetchSnapshot({
      now: new Date(),
      fetch: globalThis.fetch,
      readFile: async () => null,
      homeDir: "/tmp",
    });
    expect(snapshot.primaryPercent).toBe(73);
    expect(snapshot.buckets[0]?.percentUsed).toBe(73);
    expect(snapshot.buckets[1]?.percentUsed).toBe(7);
  });
});
