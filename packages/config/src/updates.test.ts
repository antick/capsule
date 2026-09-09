import { describe, expect, it } from "vitest";
import {
  canCheckForUpdates,
  formatBytes,
  formatProgress,
  initialUpdateState,
  plainReleaseNotes,
  RELEASES_URL,
  releaseUrlFor,
  UPDATE_COPY,
  UPDATE_PHASES,
  updateDetail,
  updateTitle,
  updateTone,
} from "./updates.ts";

describe("releaseUrlFor", () => {
  it("tags a bare version", () => {
    expect(releaseUrlFor("0.1.0")).toBe(`${RELEASES_URL}/tag/v0.1.0`);
  });

  it("does not double the v", () => {
    expect(releaseUrlFor("v0.1.0")).toBe(`${RELEASES_URL}/tag/v0.1.0`);
  });

  it("falls back to the list when no version is known", () => {
    expect(releaseUrlFor(null)).toBe(RELEASES_URL);
  });
});

describe("initialUpdateState", () => {
  it("starts idle when the build can install", () => {
    expect(initialUpdateState("0.1.0", true).phase).toBe("idle");
  });

  it("says so when the build cannot install", () => {
    const state = initialUpdateState("0.1.0", false);
    expect(state.phase).toBe("unsupported");
    expect(state.canInstall).toBe(false);
  });
});

describe("canCheckForUpdates", () => {
  it("refuses while work is already in flight", () => {
    const base = initialUpdateState("0.1.0", true);
    expect(canCheckForUpdates({ ...base, phase: "checking" })).toBe(false);
    expect(canCheckForUpdates({ ...base, phase: "downloading" })).toBe(false);
  });

  it("allows a re-check after any settled phase", () => {
    const base = initialUpdateState("0.1.0", true);
    for (const phase of ["idle", "current", "available", "ready", "error"]) {
      expect(canCheckForUpdates({ ...base, phase: phase as never })).toBe(true);
    }
  });
});

describe("update wording", () => {
  it("has a tone and a title for every phase", () => {
    for (const phase of UPDATE_PHASES) {
      const state = { ...initialUpdateState("0.1.0", true), phase };
      expect(updateTone(phase)).toBeTruthy();
      expect(updateTitle(state)).toBeTruthy();
    }
  });

  it("names the version an available update would bring", () => {
    const state = {
      ...initialUpdateState("0.1.0", true),
      phase: "available" as const,
      availableVersion: "0.2.0",
    };
    expect(updateDetail(state)).toContain("0.2.0");
  });

  it("shows the failure itself rather than a generic line", () => {
    const state = {
      ...initialUpdateState("0.1.0", true),
      phase: "error" as const,
      error: "net::ERR_INTERNET_DISCONNECTED",
    };
    expect(updateDetail(state)).toBe("net::ERR_INTERNET_DISCONNECTED");
  });
});

describe("formatBytes", () => {
  it("keeps small sizes whole", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("gives megabytes one decimal until they are large", () => {
    expect(formatBytes(1024 * 1024 * 12.34)).toBe("12.3 MB");
    expect(formatBytes(1024 * 1024 * 128)).toBe("128 MB");
  });

  it("refuses to render nonsense", () => {
    expect(formatBytes(Number.NaN)).toBe("0 MB");
    expect(formatBytes(-5)).toBe("0 MB");
  });
});

describe("formatProgress", () => {
  it("reads as one line of two sizes", () => {
    expect(
      formatProgress({
        fraction: 0.5,
        transferredBytes: 1024 * 1024 * 10,
        totalBytes: 1024 * 1024 * 20,
        bytesPerSecond: 0,
      }),
    ).toBe(`10 MB${UPDATE_COPY.ofSize}20 MB`);
  });
});

describe("plainReleaseNotes", () => {
  it("drops markup and keeps the words", () => {
    expect(plainReleaseNotes("<p>Fixed the <b>dock</b></p>")).toBe(
      "Fixed the dock",
    );
  });

  it("turns list items into bullets", () => {
    expect(plainReleaseNotes("<ul><li>One</li><li>Two</li></ul>")).toBe(
      "• One\n• Two",
    );
  });

  it("joins the notes of several skipped releases", () => {
    expect(
      plainReleaseNotes([
        { version: "0.2.0", note: "Second" },
        { version: "0.1.1", note: "First" },
      ]),
    ).toBe("Second\n\nFirst");
  });

  it("unescapes entities so text does not read as source", () => {
    expect(plainReleaseNotes("Rings &amp; bars &lt;3")).toBe("Rings & bars <3");
  });

  it("returns nothing for empty or absent notes", () => {
    expect(plainReleaseNotes(null)).toBeNull();
    expect(plainReleaseNotes("   ")).toBeNull();
    expect(plainReleaseNotes("<p></p>")).toBeNull();
  });

  it("caps a very long body", () => {
    const notes = plainReleaseNotes("x".repeat(5000));
    expect(notes).not.toBeNull();
    expect((notes as string).length).toBeLessThanOrEqual(1201);
    expect(notes?.endsWith("…")).toBe(true);
  });
});
