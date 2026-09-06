import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, unlink } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { homedir } from "node:os";
import { basename, dirname, join, parse, resolve } from "node:path";
import {
  AGENTS,
  type AgentMessage,
  CLAUDE_CHANNEL,
  type ConnectedAgent,
  validAgentMessage,
} from "@capsule/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/** Reject redirected or shared paths before opening a local message endpoint. */
async function privateDirectory(directory: string): Promise<void> {
  const parents: string[] = [];
  for (let path = directory; path !== parse(path).root; path = dirname(path)) {
    parents.unshift(path);
  }
  for (const path of parents) {
    await mkdir(path, { mode: CLAUDE_CHANNEL.directoryMode }).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("Channel directory must not contain symbolic links");
    }
    if (
      (stat.uid !== 0 && stat.uid !== process.getuid?.()) ||
      ((stat.mode & 0o022) !== 0 && (stat.mode & 0o1000) === 0)
    ) {
      throw new Error("Channel directory must have safe parent directories");
    }
  }
  const stat = await lstat(directory);
  if (stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) {
    throw new Error("Channel directory must be private and owned by this user");
  }
}

export interface ClaudeChannelOptions {
  directory?: string;
  parentPid?: number;
  cwd?: string;
  /** In-memory MCP transports allow checks without starting Claude Code. */
  transport?: Transport;
}

export async function startClaudeChannel(
  options: ClaudeChannelOptions = {},
): Promise<{ close(): Promise<void> }> {
  const directory = resolve(
    options.directory ?? join(homedir(), AGENTS.channelDirectory),
  );
  await privateDirectory(directory);
  const socketPath = join(directory, `${process.pid}-${randomUUID()}.sock`);
  if (Buffer.byteLength(socketPath) > CLAUDE_CHANNEL.maxSocketPathBytes) {
    throw new Error("Channel directory path is too long for a Unix socket");
  }
  const agent: ConnectedAgent = {
    id: `claude.${options.parentPid ?? process.ppid}`,
    providerId: "claude",
    name: basename(options.cwd ?? process.cwd()),
    detail: CLAUDE_CHANNEL.detail,
    state: "idle",
    waitingFor: null,
    since: new Date().toISOString(),
    connection: "connected",
    messages: [],
    note: CLAUDE_CHANNEL.note,
  };
  const mcp = new Server(
    { name: AGENTS.channelName, version: AGENTS.channelVersion },
    {
      capabilities: { experimental: { "claude/channel": {} }, tools: {} },
      instructions: CLAUDE_CHANNEL.instructions,
    },
  );
  let stopped = false;
  let registered = false;
  let socketIdentity: { ino: number; dev: number } | undefined;
  let registration: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  const sockets = new Set<Socket>();

  function append(role: AgentMessage["role"], text: string): AgentMessage {
    const message = { id: randomUUID(), role, text };
    agent.messages.push(message);
    while (
      agent.messages.length > AGENTS.maxMessages ||
      Buffer.byteLength(JSON.stringify(agent.messages)) >
        AGENTS.maxFrameBytes / 2
    ) {
      agent.messages.shift();
    }
    return message;
  }

  async function request(line: string): Promise<unknown> {
    let id: unknown = null;
    try {
      const value = JSON.parse(line);
      id = value?.id;
      if (!Number.isSafeInteger(id) || !registered || stopped) {
        throw new Error(
          "Channel request is invalid or the connection is closed",
        );
      }
      if (value.method === "snapshot") return { id, result: agent };
      if (value.method !== "send" || !validAgentMessage(value.params?.text)) {
        throw new Error("Unknown request or invalid message");
      }
      const text = value.params.text;
      await mcp.notification({
        method: CLAUDE_CHANNEL.notification,
        params: { content: text, meta: { session_id: agent.id } },
      });
      return { id, result: append("user", text) };
    } catch (error) {
      return {
        id: Number.isSafeInteger(id) ? id : null,
        error: {
          message:
            error instanceof Error ? error.message : "Channel request failed",
        },
      };
    }
  }

  const listener = createServer((socket) => {
    if (!registered || stopped || sockets.size >= AGENTS.maxSessions) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.setTimeout(AGENTS.requestTimeoutMs, () => socket.destroy());
    socket.on("error", () => socket.destroy());
    socket.on("close", () => sockets.delete(socket));
    let buffer = Buffer.alloc(0);
    socket.on("data", async (chunk: Buffer) => {
      socket.pause();
      try {
        if (buffer.length + chunk.length > AGENTS.maxFrameBytes) {
          socket.destroy();
          return;
        }
        buffer = Buffer.concat([buffer, chunk]);
        let newline = buffer.indexOf(10);
        while (newline >= 0 && !socket.destroyed) {
          const line = buffer.subarray(0, newline).toString("utf8");
          buffer = buffer.subarray(newline + 1);
          const response = `${JSON.stringify(await request(line))}\n`;
          if (Buffer.byteLength(response) > AGENTS.maxFrameBytes) {
            socket.destroy();
            return;
          }
          await new Promise<void>((resolveWrite, rejectWrite) => {
            socket.write(response, (error) =>
              error ? rejectWrite(error) : resolveWrite(),
            );
          });
          newline = buffer.indexOf(10);
        }
        socket.resume();
      } catch {
        socket.destroy();
      }
    });
  });

  async function removeSocket(): Promise<void> {
    const stat = await lstat(socketPath).catch(() => null);
    if (
      stat?.isSocket() &&
      stat.ino === socketIdentity?.ino &&
      stat.dev === socketIdentity?.dev
    ) {
      await unlink(socketPath).catch(() => undefined);
    }
  }

  function close(): Promise<void> {
    if (closing) return closing;
    stopped = true;
    registered = false;
    closing = (async () => {
      process.off("SIGTERM", onSignal);
      process.off("SIGINT", onSignal);
      if (!options.transport) {
        process.stdin.off("end", onSignal);
        process.stdin.off("close", onSignal);
        process.stdout.off("error", onSignal);
      }
      await registration?.catch(() => undefined);
      for (const socket of sockets) socket.destroy();
      if (listener.listening) {
        await new Promise<void>((done) => listener.close(() => done()));
      }
      await removeSocket();
      await mcp.close();
    })();
    return closing;
  }
  const onSignal = () => {
    void close();
  };
  listener.on("error", () => {
    void close();
  });
  mcp.onclose = () => {
    void close();
  };
  mcp.onerror = () => {
    void close();
  };
  mcp.oninitialized = () => {
    if (registration) return;
    registration = (async () => {
      if (stopped) return;
      await new Promise<void>((ready, reject) => {
        listener.once("error", reject);
        listener.listen(socketPath, () => {
          listener.off("error", reject);
          ready();
        });
      });
      socketIdentity = await lstat(socketPath);
      await chmod(socketPath, CLAUDE_CHANNEL.socketMode);
      registered = !stopped;
    })();
    void registration.catch((error) => {
      console.error("Capsule channel could not open:", error.message);
      void close();
    });
  };
  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: CLAUDE_CHANNEL.replyTool,
        description: CLAUDE_CHANNEL.replyDescription,
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              minLength: 1,
              maxLength: AGENTS.maxMessageLength,
            },
          },
          required: ["text"],
          additionalProperties: false,
        },
      },
    ],
  }));
  mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
    const text = request.params.arguments?.text;
    if (
      stopped ||
      request.params.name !== CLAUDE_CHANNEL.replyTool ||
      !validAgentMessage(text)
    ) {
      throw new Error("Unknown tool or invalid reply");
    }
    append("assistant", text);
    return { content: [{ type: "text", text: CLAUDE_CHANNEL.replyAccepted }] };
  });
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
  if (!options.transport) {
    process.stdin.on("end", onSignal);
    process.stdin.on("close", onSignal);
    process.stdout.on("error", onSignal);
  }
  try {
    await mcp.connect(
      options.transport ??
        new StdioServerTransport(process.stdin, process.stdout, {
          maxBufferSize: AGENTS.maxFrameBytes,
        }),
    );
  } catch (error) {
    await close();
    throw error;
  }
  return { close };
}
