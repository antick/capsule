import type { Readable, Writable } from "node:stream";
import { AGENT_COPY, AGENTS } from "@capsule/config";

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Bounded newline JSON transport for the local Codex proxy and channel sockets. */
export class JsonRpc {
  private nextId = 0;
  private buffer = "";
  private ended = false;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(
    input: Readable,
    private output: Writable,
    private dispose: () => void,
    private event: (message: Record<string, unknown>) => void = () => {},
    private timeoutMs: number = AGENTS.requestTimeoutMs,
  ) {
    input.setEncoding("utf8");
    input.on("data", (chunk: string) => this.receive(chunk));
    input.on("end", () => this.close());
    input.on("error", () => this.close());
    output.on("error", () => this.close());
  }

  get connected(): boolean {
    return !this.ended;
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (this.ended) return Promise.reject(new Error("Connection closed"));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(AGENT_COPY.uncertain));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.write({ jsonrpc: "2.0", id, method, params });
      } catch {
        this.close();
      }
    });
  }

  write(message: unknown): void {
    if (this.ended) throw new Error("Connection closed");
    const frame = JSON.stringify(message);
    if (Buffer.byteLength(frame) > AGENTS.maxFrameBytes)
      throw new Error("Message too large");
    this.output.write(`${frame}\n`);
  }

  close(): void {
    if (this.ended) return;
    this.ended = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(AGENT_COPY.uncertain));
    }
    this.pending.clear();
    this.dispose();
  }

  private receive(chunk: string): void {
    this.buffer += chunk;
    while (this.buffer.includes("\n")) {
      const end = this.buffer.indexOf("\n");
      const frame = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      if (Buffer.byteLength(frame) > AGENTS.maxFrameBytes) {
        this.close();
        return;
      }
      if (!frame.trim()) continue;
      try {
        const message = record(JSON.parse(frame));
        if (typeof message.method === "string") {
          this.event(message);
          continue;
        }
        const pending =
          typeof message.id === "number" ? this.pending.get(message.id) : null;
        if (!pending) continue;
        this.pending.delete(message.id as number);
        clearTimeout(pending.timer);
        if (message.error)
          pending.reject(
            new Error(
              String(record(message.error).message ?? "Request failed"),
            ),
          );
        else if (Object.hasOwn(message, "result"))
          pending.resolve(message.result);
        else pending.reject(new Error("Invalid connection response"));
      } catch {
        this.close();
        return;
      }
    }
    if (Buffer.byteLength(this.buffer) > AGENTS.maxFrameBytes) this.close();
  }
}
