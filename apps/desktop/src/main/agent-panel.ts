import { join } from "node:path";
import {
  AGENT_COPY,
  AGENT_IPC,
  AGENTS,
  IPC,
  type ProviderId,
  type Rect,
} from "@capsule/config";
import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  type WebContents,
} from "electron";
import { type AgentConnections, executable } from "./agent-connections.ts";
import { agentPanelBounds } from "./agent-panel-placement.ts";
import { hideFromMacDock } from "./macos-dock.ts";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

function shellQuote(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

export class AgentPanel {
  window: BrowserWindow | null = null;
  private anchor: Rect | null = null;
  constructor(
    private connections: AgentConnections,
    private overlay: () => BrowserWindow | null,
  ) {}

  register(): void {
    const requirePanel = (sender: WebContents) => {
      if (sender !== this.window?.webContents)
        throw new Error("Agent commands must come from the agent panel");
    };
    ipcMain.handle(
      AGENT_IPC.open,
      (event, provider: unknown, anchor: unknown) => {
        if (
          event.sender !== this.overlay()?.webContents &&
          event.sender !== this.window?.webContents
        )
          throw new Error("Unknown panel source");
        if (
          provider !== null &&
          provider !== "claude" &&
          provider !== "codex" &&
          provider !== "grok"
        )
          throw new Error("Unknown provider");
        const origin = this.overlay()?.getBounds();
        const rect = this.validAnchor(anchor);
        this.open(
          provider,
          rect && origin
            ? { ...rect, x: rect.x + origin.x, y: rect.y + origin.y }
            : undefined,
        );
      },
    );
    ipcMain.on(AGENT_IPC.close, (event) => {
      if (event.sender === this.window?.webContents) this.window.hide();
    });
    ipcMain.handle(AGENT_IPC.get, (event) => {
      requirePanel(event.sender);
      return this.connections.get();
    });
    ipcMain.handle(AGENT_IPC.select, (event, id: unknown) => {
      requirePanel(event.sender);
      if (
        id !== null &&
        (typeof id !== "string" || id.length > AGENTS.maxMessageLength)
      )
        throw new Error("Invalid session");
      return this.connections.select(id);
    });
    ipcMain.handle(AGENT_IPC.send, (event, id: unknown, text: unknown) => {
      requirePanel(event.sender);
      return this.connections.send(id, text);
    });
    ipcMain.handle(
      AGENT_IPC.respond,
      (event, id: unknown, request: unknown, approve: unknown) => {
        requirePanel(event.sender);
        return this.connections.respond(id, request, approve);
      },
    );
    ipcMain.handle(AGENT_IPC.setup, async (event) => {
      requirePanel(event.sender);
      const node = await executable("node").catch(() => "node");
      const channelEntry = app.isPackaged
        ? join(
            process.resourcesPath,
            "app.asar.unpacked",
            "out/main/channel-entry.js",
          )
        : join(__dirname, "channel-entry.js");
      const config = JSON.stringify({
        mcpServers: {
          capsule: {
            command: node,
            args: [channelEntry],
          },
        },
      });
      return {
        claude: `claude --mcp-config ${shellQuote(config)} --dangerously-load-development-channels server:capsule`,
        codex: AGENT_COPY.codexSetupText,
      };
    });
  }

  open(provider: ProviderId | null = null, anchor?: Rect): void {
    this.anchor = anchor ??
      this.overlay()?.getBounds() ?? {
        ...screen.getCursorScreenPoint(),
        width: 1,
        height: 1,
      };
    const display = screen.getDisplayMatching(this.anchor);
    const bounds = agentPanelBounds(this.anchor, display.workArea);
    if (this.window && !this.window.isDestroyed()) {
      this.window.setBounds(bounds);
      this.window.webContents.send(IPC.navigate, provider ?? "");
      this.show();
      return;
    }
    const win = new BrowserWindow({
      ...bounds,
      title: AGENT_COPY.title,
      show: false,
      frame: false,
      transparent: true,
      hasShadow: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      type: "panel",
      focusable: true,
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window = win;
    win.setAlwaysOnTop(true, "floating");
    win.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: false,
      skipTransformProcessType: true,
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event) => event.preventDefault());
    win.on("closed", () => {
      if (this.window === win) this.window = null;
    });
    win.once("ready-to-show", () => this.show());
    win.on("hide", () => void this.connections.select(null));
    const url = rendererDevUrl("agents");
    const loading = url
      ? win.loadURL(`${url}#${provider ?? ""}`)
      : win.loadFile(rendererHtml("agents"), { hash: provider ?? "" });
    void loading.catch((error: unknown) => {
      console.error("Agent panel failed to load", error);
      win.destroy();
    });
  }

  reposition(): void {
    if (!this.window || this.window.isDestroyed() || !this.anchor) return;
    this.window.setBounds(
      agentPanelBounds(
        this.anchor,
        screen.getDisplayMatching(this.anchor).workArea,
      ),
    );
  }

  private show(): void {
    if (!this.window || this.window.isDestroyed()) return;
    app.focus({ steal: true });
    this.window.show();
    this.window.focus();
    hideFromMacDock();
  }

  private validAnchor(value: unknown): Rect | null {
    if (!value || typeof value !== "object") return null;
    const rect = value as Rect;
    return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
      rect.width > 0 &&
      rect.height > 0
      ? rect
      : null;
  }
}
