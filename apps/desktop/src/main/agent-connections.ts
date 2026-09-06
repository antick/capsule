import { spawn } from "node:child_process";
import { access, constants, lstat, readdir } from "node:fs/promises";
import { connect } from "node:net";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";
import { CodexConnection, JsonRpc, record } from "@capsule/activity";
import {
  type ActivityByProvider,
  AGENT_COPY,
  AGENTS,
  type AgentPanelSnapshot,
  type ConnectedAgent,
  type ProviderId,
  validAgentMessage,
} from "@capsule/config";

export async function executable(name: string): Promise<string> {
  const directories = [
    ...AGENTS.executableDirectories.map((directory) =>
      isAbsolute(directory) ? directory : join(homedir(), directory),
    ),
    ...(process.env.PATH ?? "").split(delimiter),
  ];
  for (const directory of directories) {
    if (!directory) continue;
    const path = join(directory, name);
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      /* Try the next installed location. */
    }
  }
  throw new Error(`${name} is not installed`);
}

async function privateSocket(path: string): Promise<void> {
  const stat = await lstat(path);
  if (
    !stat.isSocket() ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & AGENTS.privateSocketMask) !== 0
  )
    throw new Error("Socket must be private to this user");
}

function channelSession(value: unknown): ConnectedAgent {
  const session = record(value);
  if (
    typeof session.id !== "string" ||
    !/^claude\.\d+$/.test(session.id) ||
    session.providerId !== "claude" ||
    typeof session.name !== "string" ||
    typeof session.detail !== "string" ||
    typeof session.note !== "string" ||
    typeof session.since !== "string" ||
    !Number.isFinite(Date.parse(session.since)) ||
    !["busy", "waiting", "idle"].includes(String(session.state)) ||
    !Array.isArray(session.messages)
  )
    throw new Error("Invalid Claude connection");
  return {
    id: session.id,
    providerId: "claude",
    name: session.name,
    detail: session.detail,
    since: session.since,
    state: session.state as ConnectedAgent["state"],
    waitingFor:
      typeof session.waitingFor === "string" ? session.waitingFor : null,
    connection: "connected",
    note: session.note,
    messages: session.messages.slice(-AGENTS.maxMessages).flatMap((value) => {
      const message = record(value);
      return typeof message.id === "string" &&
        typeof message.text === "string" &&
        ["user", "assistant"].includes(String(message.role))
        ? [
            {
              id: message.id,
              text: message.text.slice(0, AGENTS.maxMessageLength),
              role: message.role as "user" | "assistant",
            },
          ]
        : [];
    }),
  };
}

export class AgentConnections {
  private codex: CodexConnection | null = null;
  private channels = new Map<string, JsonRpc>();
  private targets = new Map<string, JsonRpc>();
  private selected: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private scanning: Promise<void> | null = null;
  private sending = new Set<string>();
  private stopped = false;
  private snapshot: AgentPanelSnapshot = { sessions: [], connections: [] };

  constructor(
    private observed: () => ActivityByProvider,
    private enabled: () => readonly ProviderId[],
    private publish: (snapshot: AgentPanelSnapshot) => void,
  ) {}

  start(): void {
    if (!AGENTS.enabled) return;
    this.stopped = false;
    this.timer = setInterval(() => void this.refresh(), AGENTS.pollMs);
    void this.refresh();
  }

  get(): AgentPanelSnapshot {
    return this.snapshot;
  }

  async select(id: string | null): Promise<void> {
    this.selected = id;
    await this.refresh();
  }

  refresh(): Promise<void> {
    if (!AGENTS.enabled || this.stopped) return Promise.resolve();
    if (this.scanning) return this.scanning;
    this.scanning = this.scan().finally(() => {
      this.scanning = null;
    });
    return this.scanning;
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.codex?.rpc.close();
    for (const rpc of this.channels.values()) rpc.close();
    this.channels.clear();
  }

  async send(id: unknown, text: unknown): Promise<void> {
    if (!AGENTS.enabled) throw new Error(AGENT_COPY.disabled);
    if (typeof id !== "string" || !validAgentMessage(text))
      throw new Error("Enter a message within the allowed length");
    if (this.sending.has(id))
      throw new Error("A message is already being sent");
    const session = this.snapshot.sessions.find((s) => s.id === id);
    if (
      session?.connection !== "connected" ||
      !this.enabled().includes(session.providerId)
    )
      throw new Error("This session is view only");
    this.sending.add(id);
    try {
      if (session.providerId === "codex") {
        if (!this.codex?.rpc.connected)
          throw new Error("Codex is disconnected");
        await this.codex.send(id, text);
      } else {
        const rpc = this.targets.get(id);
        if (!rpc?.connected) throw new Error("Claude is disconnected");
        await rpc.request("send", { text });
      }
    } finally {
      this.sending.delete(id);
      void this.refresh();
    }
  }

  async respond(
    id: unknown,
    requestId: unknown,
    approve: unknown,
  ): Promise<void> {
    if (!AGENTS.enabled) throw new Error(AGENT_COPY.disabled);
    if (
      typeof id !== "string" ||
      typeof requestId !== "string" ||
      typeof approve !== "boolean" ||
      !this.enabled().includes("codex")
    )
      throw new Error("Invalid approval response");
    if (!this.codex?.rpc.connected) throw new Error("Codex is disconnected");
    this.codex.respond(id, requestId, approve);
    await this.refresh();
  }

  private async connectCodex(): Promise<CodexConnection> {
    if (this.codex?.rpc.connected) return this.codex;
    const socket =
      process.env.CAPSULE_CODEX_SOCKET ??
      join(
        process.env.CODEX_HOME ?? join(homedir(), AGENTS.codexHome),
        AGENTS.codexSocket,
      );
    await privateSocket(socket);
    const child = spawn(
      await executable("codex"),
      ["app-server", "proxy", "--sock", socket],
      { stdio: ["pipe", "pipe", "ignore"] },
    );
    let connection: CodexConnection;
    const rpc = new JsonRpc(
      child.stdout,
      child.stdin,
      () => child.kill(),
      (message) => {
        connection.event(message);
        void this.refresh();
      },
    );
    child.on("error", () => rpc.close());
    child.on("exit", () => rpc.close());
    connection = new CodexConnection(rpc);
    this.codex = connection;
    try {
      await connection.initialize();
      return connection;
    } catch (error) {
      rpc.close();
      throw error;
    }
  }

  private async readChannels(): Promise<ConnectedAgent[]> {
    const directory = join(homedir(), AGENTS.channelDirectory);
    let names: string[] = [];
    try {
      const stat = await lstat(directory);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.uid !== process.getuid?.() ||
        (stat.mode & AGENTS.privateSocketMask) !== 0
      )
        throw new Error("Unsafe channel directory");
      names = (await readdir(directory))
        .filter((name) => name.endsWith(".sock"))
        .slice(0, AGENTS.maxSessions);
    } catch {
      /* A missing channel directory means no connected Claude sessions. */
    }
    const paths = names.map((name) => join(directory, name));
    for (const [path, rpc] of this.channels) {
      if (!paths.includes(path) || !rpc.connected) {
        rpc.close();
        this.channels.delete(path);
      }
    }
    const targets = new Map<string, JsonRpc>();
    const sessions = await Promise.all(
      paths.map(async (path) => {
        let rpc = this.channels.get(path);
        try {
          if (!rpc) {
            await privateSocket(path);
            const socket = connect(path);
            rpc = new JsonRpc(socket, socket, () => socket.destroy());
            this.channels.set(path, rpc);
          }
          const session = channelSession(await rpc.request("snapshot"));
          targets.set(session.id, rpc);
          return session;
        } catch {
          rpc?.close();
          this.channels.delete(path);
          return null;
        }
      }),
    );
    this.targets = targets;
    return sessions.filter(
      (session): session is ConnectedAgent => session !== null,
    );
  }

  private async scan(): Promise<void> {
    const sessions = new Map<string, ConnectedAgent>();
    const enabled = this.enabled();
    for (const observed of Object.values(this.observed()).flat()) {
      if (observed && enabled.includes(observed.providerId))
        sessions.set(observed.id, {
          ...observed,
          connection: "view-only",
          messages: [],
          note: AGENT_COPY.observedNote,
        });
    }
    let codexConnected = false;
    let codexDetail: string = AGENT_COPY.codexUnavailable;
    if (enabled.includes("codex")) {
      try {
        const connection = await this.connectCodex();
        const connected = await connection.sessions(this.selected);
        if (!connection.rpc.connected) throw new Error("Codex disconnected");
        codexConnected = true;
        codexDetail = `${connected.length} connected sessions`;
        for (const session of connected) sessions.set(session.id, session);
      } catch (error) {
        this.codex?.rpc.close();
        codexDetail = `${AGENT_COPY.codexUnavailable} ${error instanceof Error ? error.message : ""}`;
      }
    } else {
      this.codex?.rpc.close();
    }
    const claude = enabled.includes("claude") ? await this.readChannels() : [];
    for (const session of claude) {
      const observed = sessions.get(session.id);
      sessions.set(
        session.id,
        observed
          ? {
              ...session,
              name: observed.name,
              detail: observed.detail,
              state: observed.state,
              waitingFor: observed.waitingFor,
              since: observed.since,
            }
          : session,
      );
    }
    if (this.stopped) {
      this.stop();
      return;
    }
    this.snapshot = {
      sessions: [...sessions.values()],
      connections: [
        {
          provider: "claude",
          connected: claude.length > 0,
          detail: claude.length
            ? `${claude.length} connected sessions`
            : AGENT_COPY.claudeUnavailable,
        },
        { provider: "codex", connected: codexConnected, detail: codexDetail },
      ],
    };
    this.publish(this.snapshot);
  }
}
