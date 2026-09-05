import { execFile } from "node:child_process";
import { promises as fs, watch } from "node:fs";
import { homedir } from "node:os";
import { promisify } from "node:util";
import type { ActivityHost } from "@capsule/activity";
import { app } from "electron";

const execFileAsync = promisify(execFile);

/** Splits sqlite3's columns: the ASCII unit separator, which no title holds. */
export const COLUMN_SEPARATOR = String.fromCharCode(31);

/**
 * `ps -o lstart=` prints "Sat Sep  5 23:05:22 2026" in local time, with the
 * day space-padded. Collapsed, that is a form the Date parser accepts.
 */
export function parsePsStart(text: string): Date | null {
  const collapsed = text.trim().split(/\s+/).join(" ");
  if (collapsed.length === 0) {
    return null;
  }
  const parsed = new Date(collapsed);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** Splits the sqlite3 CLI's output into rows and columns. */
export function parseSqliteRows(stdout: string): string[][] {
  return stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split(COLUMN_SEPARATOR));
}

/**
 * The agent monitors' view of this Mac. Nothing native: the process table is
 * asked through `ps`, Codex's stores through the `sqlite3` that ships with
 * macOS, the same way the Dock is asked through `defaults`.
 */
export function createActivityHost(): ActivityHost {
  return {
    now: () => new Date(),
    homeDir: () => {
      try {
        return app.getPath("home");
      } catch {
        return homedir();
      }
    },
    listDir: async (dir) => {
      try {
        return await fs.readdir(dir);
      } catch {
        return [];
      }
    },
    readFile: async (path) => {
      try {
        return await fs.readFile(path, "utf8");
      } catch {
        return null;
      }
    },
    modifiedAt: async (path) => {
      try {
        return (await fs.stat(path)).mtime;
      } catch {
        return null;
      }
    },
    isProcessAlive: async (pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        // EPERM means it exists but belongs to someone else.
        return (error as NodeJS.ErrnoException).code === "EPERM";
      }
    },
    processStartedAt: async (pid) => {
      try {
        const { stdout } = await execFileAsync("ps", [
          "-o",
          "lstart=",
          "-p",
          String(pid),
        ]);
        return parsePsStart(stdout);
      } catch {
        return null;
      }
    },
    query: async (path, sql) => {
      try {
        const { stdout } = await execFileAsync("sqlite3", [
          "-readonly",
          "-separator",
          COLUMN_SEPARATOR,
          path,
          sql,
        ]);
        return parseSqliteRows(stdout);
      } catch {
        return [];
      }
    },
    interval: (ms, tick) => {
      const id = setInterval(tick, ms);
      return () => clearInterval(id);
    },
    watchDir: (dir, onChange) => {
      try {
        const watcher = watch(dir, () => onChange());
        watcher.on("error", () => undefined);
        return () => watcher.close();
      } catch {
        // No directory yet; the poll still covers it.
        return () => undefined;
      }
    },
  };
}
