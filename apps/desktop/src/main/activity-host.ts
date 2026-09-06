import { execFile } from "node:child_process";
import { createReadStream, promises as fs, watch } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import type { LogFile, TokenScanHost } from "@capsule/activity/tokens";
import { ACTIVITY, ACTIVITY_NOTICES } from "@capsule/config";
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
/** Every regular file under `dir`, with the two facts the token cache keys on. */
async function walk(dir: string): Promise<LogFile[]> {
  const out: LogFile[] = [];
  const pending = [dir];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(path);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(path);
          out.push({ path, size: stat.size, modifiedMs: stat.mtimeMs });
        } catch {
          // Gone between listing and stat; nothing to count.
        }
      }
    }
  }
  return out;
}

/** Streams a file line by line, so a gigabyte of transcript never sits in memory. */
function eachLine(
  path: string,
  onLine: (line: string) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    const stream = createReadStream(path, { encoding: "utf8" });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    lines.on("line", onLine);
    lines.on("close", () => resolve(true));
    stream.on("error", () => {
      lines.close();
      resolve(false);
    });
  });
}

export function createActivityHost(): TokenScanHost {
  // Bounded tail cache: unchanged logs cost one stat, not repeated transcript reads.
  const tails = new Map<string, { stamp: string; text: string }>();
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
        if ((await fs.stat(path)).size > ACTIVITY_NOTICES.maxRecordBytes)
          return null;
        return await fs.readFile(path, "utf8");
      } catch {
        return null;
      }
    },
    readTail: async (path, bytes) => {
      if (!path.endsWith(".jsonl")) return null;
      let file: FileHandle | undefined;
      try {
        const canonical = await fs.realpath(path);
        const home = await fs.realpath(app.getPath("home"));
        const roots = [
          ACTIVITY.codexSessionsDirSegments,
          ACTIVITY_NOTICES.claudeProjects,
          ACTIVITY_NOTICES.grokSessions,
        ];
        if (
          !roots.some((segments) =>
            canonical.startsWith(join(home, ...segments) + sep),
          )
        )
          return null;
        const stat = await fs.stat(canonical);
        const stamp = `${stat.ino}:${stat.mtimeMs}:${stat.size}:${bytes}`;
        if (tails.get(path)?.stamp === stamp)
          return tails.get(path)?.text ?? null;
        file = await fs.open(canonical, "r");
        const size = (await file.stat()).size;
        const length = Math.min(size, bytes, ACTIVITY_NOTICES.tailBytes);
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await file.read(buffer, 0, length, size - length);
        const text = buffer.subarray(0, bytesRead).toString("utf8");
        const tail = size > length ? text.slice(text.indexOf("\n") + 1) : text;
        tails.delete(path);
        tails.set(path, { stamp, text: tail });
        while (tails.size > ACTIVITY_NOTICES.maxSessions)
          tails.delete(tails.keys().next().value as string);
        return tail;
      } catch {
        return null;
      } finally {
        await file?.close();
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
    walk,
    eachLine,
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
