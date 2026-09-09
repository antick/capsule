import { describe, expect, it } from "vitest";
import {
  downloadFraction,
  isUnsupportedUpdateError,
  updateErrorMessage,
} from "./update-support.ts";

describe("isUnsupportedUpdateError", () => {
  it("recognises a build macOS will not swap", () => {
    expect(
      isUnsupportedUpdateError(
        "Could not get code signature for running application",
      ),
    ).toBe(true);
  });

  it("recognises a development run with no feed", () => {
    expect(
      isUnsupportedUpdateError(
        "ENOENT: no such file or directory, open 'dev-app-update.yml'",
      ),
    ).toBe(true);
  });

  it("leaves ordinary network failures alone", () => {
    expect(isUnsupportedUpdateError("net::ERR_INTERNET_DISCONNECTED")).toBe(
      false,
    );
    expect(isUnsupportedUpdateError("HttpError: 404 Not Found")).toBe(false);
  });
});

describe("updateErrorMessage", () => {
  it("takes the first line of an Error", () => {
    expect(
      updateErrorMessage(new Error("Boom\n    at somewhere (file.js:1:1)")),
    ).toBe("Boom");
  });

  it("accepts a bare string", () => {
    expect(updateErrorMessage("Offline")).toBe("Offline");
  });

  it("reads a message off a plain object", () => {
    expect(updateErrorMessage({ message: "No release found" })).toBe(
      "No release found",
    );
  });

  it("always says something", () => {
    expect(updateErrorMessage(null)).toBe("Update check failed.");
    expect(updateErrorMessage(new Error("   "))).toBe("Update check failed.");
  });

  it("truncates a very long line", () => {
    const message = updateErrorMessage(new Error("x".repeat(900)));
    expect(message.length).toBeLessThanOrEqual(301);
    expect(message.endsWith("…")).toBe(true);
  });
});

describe("downloadFraction", () => {
  it("converts a percentage", () => {
    expect(downloadFraction(42.5)).toBeCloseTo(0.425);
  });

  it("clamps to the range a bar can draw", () => {
    expect(downloadFraction(-10)).toBe(0);
    expect(downloadFraction(140)).toBe(1);
  });

  it("treats anything unusable as no progress", () => {
    expect(downloadFraction(undefined)).toBe(0);
    expect(downloadFraction(Number.NaN)).toBe(0);
  });
});
