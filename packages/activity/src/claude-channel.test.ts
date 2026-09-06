import { once } from "node:events";
import {
  chmod,
  lstat,
  mkdtemp,
  readdir,
  realpath,
  rm,
  symlink,
} from "node:fs/promises";
import { createConnection } from "node:net";
import { join } from "node:path";
import { AGENTS, CLAUDE_CHANNEL } from "@capsule/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startClaudeChannel } from "./claude-channel.ts";

const cleanup: (() => Promise<unknown>)[] = [];

afterEach(async () => {
  for (const close of cleanup.reverse()) await close();
  cleanup.length = 0;
});

async function directory() {
  const path = await mkdtemp(join(await realpath("/tmp"), "capsule-channel-"));
  cleanup.push(() => rm(path, { recursive: true, force: true }));
  return path;
}

async function channel(parentPid = 1234) {
  const path = await directory();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = await startClaudeChannel({
    directory: path,
    parentPid,
    cwd: "/projects/example",
    transport: serverTransport,
  });
  cleanup.push(() => server.close());
  expect(await readdir(path)).toEqual([]);
  const client = new Client({ name: "capsule-test", version: "1" });
  const notifications = vi.fn();
  client.fallbackNotificationHandler = notifications;
  await client.connect(clientTransport);
  cleanup.push(() => client.close());
  await vi.waitFor(async () => expect(await readdir(path)).toHaveLength(1));
  const socketPath = join(path, (await readdir(path))[0] ?? "missing");
  await vi.waitFor(async () =>
    expect((await lstat(socketPath)).mode & 0o777).toBe(
      CLAUDE_CHANNEL.socketMode,
    ),
  );
  return { client, path, socketPath, server, notifications };
}

async function rpc(path: string, method: string, params?: unknown) {
  const socket = createConnection(path);
  await once(socket, "connect");
  const data = new Promise<string>((resolveData, reject) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("error", reject);
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (buffer.includes("\n")) resolveData(buffer);
    });
    socket.on("close", () => reject(new Error("Disconnected")));
  });
  socket.write(`${JSON.stringify({ id: 1, method, params })}\n`);
  try {
    return JSON.parse(await data);
  } finally {
    socket.destroy();
  }
}

describe("Claude channel", () => {
  it("registers only after MCP initialization and routes independent two-way conversations", async () => {
    const first = await channel();
    const second = await channel(5678);
    expect((await lstat(first.path)).mode & 0o777).toBe(
      CLAUDE_CHANNEL.directoryMode,
    );
    expect(first.client.getServerCapabilities()).toEqual({
      experimental: { "claude/channel": {} },
      tools: {},
    });
    expect(
      (await first.client.listTools()).tools.map((tool) => tool.name),
    ).toEqual(["reply"]);
    const result = await rpc(first.socketPath, "send", { text: "Hello 🌿" });
    expect(result.result).toMatchObject({ role: "user", text: "Hello 🌿" });
    expect(first.notifications).toHaveBeenCalledWith(
      expect.objectContaining({
        method: CLAUDE_CHANNEL.notification,
        params: { content: "Hello 🌿", meta: { session_id: "claude.1234" } },
      }),
    );
    expect(second.notifications).not.toHaveBeenCalled();
    await first.client.callTool({
      name: "reply",
      arguments: { text: "Hi from Claude" },
    });
    const snapshot = (await rpc(first.socketPath, "snapshot")).result;
    expect(snapshot).toMatchObject({
      id: "claude.1234",
      name: "example",
      connection: "connected",
    });
    expect(snapshot.messages).toMatchObject([
      { role: "user", text: "Hello 🌿" },
      { role: "assistant", text: "Hi from Claude" },
    ]);
    expect((await rpc(second.socketPath, "snapshot")).result.messages).toEqual(
      [],
    );
    await first.client.close();
    await first.server.close();
    expect(await readdir(first.path)).toEqual([]);
    expect((await rpc(second.socketPath, "snapshot")).result.id).toBe(
      "claude.5678",
    );
  });

  it("rejects invalid inputs and oversized frames while bounding the conversation", async () => {
    const { socketPath, client, notifications } = await channel();
    for (const text of [
      " ",
      null,
      1,
      "x".repeat(AGENTS.maxMessageLength + 1),
    ]) {
      expect(await rpc(socketPath, "send", { text })).toHaveProperty(
        "error.message",
      );
    }
    expect(await rpc(socketPath, "unknown")).toHaveProperty("error.message");
    expect(notifications).not.toHaveBeenCalled();
    await expect(
      client.callTool({ name: "reply", arguments: { text: " " } }),
    ).rejects.toThrow();
    const socket = createConnection(socketPath);
    await once(socket, "connect");
    const closed = new Promise<void>((resolveClosed) =>
      socket.on("close", () => resolveClosed()),
    );
    socket.on("error", () => undefined);
    socket.write(Buffer.alloc(AGENTS.maxFrameBytes + 1, 120));
    await closed;
    for (let index = 0; index <= AGENTS.maxMessages; index++) {
      await client.callTool({
        name: "reply",
        arguments: { text: String(index) },
      });
    }
    const snapshot = (await rpc(socketPath, "snapshot")).result;
    expect(snapshot.messages).toHaveLength(AGENTS.maxMessages);
    expect(snapshot.messages[0].text).toBe("1");
    // Escaped control characters exercise the byte ceiling, not only character count.
    for (let index = 0; index < AGENTS.maxMessages; index++) {
      await client.callTool({
        name: "reply",
        arguments: { text: `x${"\u0001".repeat(AGENTS.maxMessageLength - 1)}` },
      });
    }
    expect(
      Buffer.byteLength(
        JSON.stringify((await rpc(socketPath, "snapshot")).result),
      ),
    ).toBeLessThan(AGENTS.maxFrameBytes);
  });

  it("rejects shared or redirected channel directories", async () => {
    const path = await directory();
    await chmod(path, 0o755);
    await expect(startClaudeChannel({ directory: path })).rejects.toThrow(
      "private",
    );
    await chmod(path, CLAUDE_CHANNEL.directoryMode);
    const link = join(path, "redirect");
    await symlink(path, link);
    await expect(startClaudeChannel({ directory: link })).rejects.toThrow(
      "symbolic links",
    );
  });

  it("runs the real stdio transport and removes its socket when Claude closes stdin", async () => {
    const path = await directory();
    const moduleUrl = new URL("./claude-channel.ts", import.meta.url).href;
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        `import {startClaudeChannel} from ${JSON.stringify(moduleUrl)}; await startClaudeChannel({directory:${JSON.stringify(path)},parentPid:7890});`,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    cleanup.push(async () => {
      child.kill();
    });
    let output = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "capsule-test", version: "1" },
        },
      })}\n`,
    );
    await vi.waitFor(() =>
      expect(output, stderr).toContain('"claude/channel"'),
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );
    await vi.waitFor(async () => expect(await readdir(path)).toHaveLength(1));
    const socketPath = join(path, (await readdir(path))[0] ?? "missing");
    await vi.waitFor(async () =>
      expect((await rpc(socketPath, "snapshot")).result?.id).toBe(
        "claude.7890",
      ),
    );
    const sent = await rpc(socketPath, "send", { text: "stdio check" });
    expect(sent.result.text).toBe("stdio check");
    await vi.waitFor(() =>
      expect(output).toContain(CLAUDE_CHANNEL.notification),
    );
    const exited = once(child, "exit");
    child.stdin.end();
    expect((await exited)[0], stderr).toBe(0);
    expect(await readdir(path)).toEqual([]);
  });
});

import { spawn } from "node:child_process";
