import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  COLUMN_SEPARATOR,
  createActivityHost,
  parsePsStart,
  parseSqliteRows,
} from "./activity-host.ts";

const environment = vi.hoisted(() => ({ home: "" }));
vi.mock("electron", () => ({ app: { getPath: () => environment.home } }));

it("reads bounded complete log lines only inside passive session directories", async () => {
  const home = await mkdtemp(join(tmpdir(), "capsule-activity-test-"));
  environment.home = home;
  try {
    const sessions = join(home, ".codex", "sessions");
    await mkdir(sessions, { recursive: true });
    const log = join(sessions, "session.jsonl");
    await writeFile(log, 'partial record\n{"type":"done"}\n');
    const host = createActivityHost();
    expect(await host.readTail?.(log, 20)).toBe('{"type":"done"}\n');
    await writeFile(log, '{"type":"updated"}\n');
    expect(await host.readTail?.(log, 20)).toBe('{"type":"updated"}\n');
    const outside = join(home, "outside.jsonl");
    await writeFile(outside, "private");
    expect(await host.readTail?.(outside, 20)).toBeNull();
    const linked = join(sessions, "linked.jsonl");
    await symlink(outside, linked);
    expect(await host.readTail?.(linked, 20)).toBeNull();
    expect(
      await host.readTail?.(join(sessions, "credentials.json"), 20),
    ).toBeNull();
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

describe("parsePsStart", () => {
  it("reads ps's space-padded local start time", () => {
    const parsed = parsePsStart("Sat Sep  5 23:05:22 2026    \n");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(5);
    expect(parsed?.getHours()).toBe(23);
    expect(parsePsStart("")).toBeNull();
  });
});

describe("parseSqliteRows", () => {
  it("splits rows on newlines and columns on the unit separator", () => {
    const out = `a${COLUMN_SEPARATOR}b\nc${COLUMN_SEPARATOR}d\n`;
    expect(parseSqliteRows(out)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseSqliteRows("")).toEqual([]);
  });
});
