/**
 * Everything the monitors need from the machine, so they can be run against a
 * fake in tests and against the real file system in Electron's main process.
 */
export interface ActivityHost {
  now: () => Date;
  homeDir: () => string;
  /** Entry names in a directory, or nothing if it is not there. */
  listDir: (dir: string) => Promise<string[]>;
  readFile: (path: string) => Promise<string | null>;
  /** When a file was last written, or null if it is not there. */
  modifiedAt: (path: string) => Promise<Date | null>;
  /** Whether a process with this pid exists, whoever owns it. */
  isProcessAlive: (pid: number) => Promise<boolean>;
  /** When that process started, or null if the system will not say. */
  processStartedAt: (pid: number) => Promise<Date | null>;
  /** Rows from a read-only SQL query, or nothing if the store cannot be read. */
  query: (sqlitePath: string, sql: string) => Promise<string[][]>;
  interval: (ms: number, tick: () => void) => () => void;
  /** Fires when anything in a directory changes; optional, the poll still runs. */
  watchDir?: (dir: string, onChange: () => void) => () => void;
}
