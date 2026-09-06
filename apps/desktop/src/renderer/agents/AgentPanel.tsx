import {
  AGENT_COPY,
  type AgentPanelSnapshot,
  defaultSettings,
  type HudAppearance,
  orderSessions,
  resolveHudTheme,
  validAgentMessage,
} from "@capsule/config";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { RequestState } from "./AgentRequest.tsx";
import {
  AgentConversation,
  type AgentFilter,
  AgentList,
  AgentSetup,
} from "./components.tsx";

export type SendState = "sending" | "accepted" | "error";

function providerFilter(hash: string): AgentFilter {
  const value = hash.replace(/^#/, "");
  return value === "claude" || value === "codex" ? value : "all";
}

export function AgentPanel() {
  const [snapshot, setSnapshot] = useState<AgentPanelSnapshot>({
    sessions: [],
    connections: [],
  });
  const [settings, setSettings] = useState(defaultSettings);
  const [appearance, setAppearance] = useState<HudAppearance>(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark",
  );
  const [filter, setFilter] = useState<AgentFilter>(() =>
    typeof window === "undefined"
      ? "all"
      : providerFilter(window.location.hash),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendStates, setSendStates] = useState<Record<string, SendState>>({});
  const [requestStates, setRequestStates] = useState<
    Record<string, RequestState>
  >({});
  const pendingRequests = useRef(new Set<string>());
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [setup, setSetup] = useState<{ claude: string; codex: string } | null>(
    null,
  );
  const [setupFailed, setSetupFailed] = useState(false);
  const [selectionFailed, setSelectionFailed] = useState(false);
  const pending = useRef(new Set<string>());
  const focusTarget = useRef<HTMLButtonElement>(null);
  const selected = snapshot.sessions.find(
    (session) => session.id === selectedId,
  );
  const theme = resolveHudTheme(settings.hudTheme, appearance);
  const requestKey = selected?.request
    ? `${selected.id}:${selected.request.id}`
    : "";

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setAppearance(query.matches ? "light" : "dark");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const bridge = window.capsule;
    if (!bridge) {
      setLoadState("error");
      return;
    }
    let active = true;
    let received = false;
    const unsubscribe = bridge.onAgents((next) => {
      if (!active) return;
      received = true;
      setSnapshot(next);
      setLoadState("ready");
    });
    void bridge
      .getAgents()
      .then((next) => {
        if (active && !received) {
          setSnapshot(next);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active && !received) setLoadState("error");
      });
    void bridge
      .getSettings()
      .then((next) => {
        if (active) setSettings(next);
      })
      .catch(() => {});
    const unsubscribeSettings = bridge.onSnapshots((_usage, next) =>
      setSettings(next),
    );
    const unsubscribeNavigate = bridge.onNavigate((hash) => {
      setFilter(providerFilter(hash));
      setSelectedId(null);
      focusTarget.current?.focus();
    });
    void bridge
      .getAgentSetup()
      .then((next) => {
        if (active) setSetup(next);
      })
      .catch(() => {
        if (active) setSetupFailed(true);
      });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) bridge.closeAgents();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      active = false;
      unsubscribe();
      unsubscribeSettings();
      unsubscribeNavigate();
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    let active = true;
    focusTarget.current?.focus();
    setSelectionFailed(false);
    void window.capsule?.selectAgent(selectedId).catch(() => {
      if (active) setSelectionFailed(true);
    });
    return () => {
      active = false;
    };
  }, [selectedId]);

  async function send() {
    if (
      selected?.connection !== "connected" ||
      selected.request ||
      pending.current.has(selected.id)
    )
      return;
    const id = selected.id;
    const text = drafts[id] ?? "";
    if (!validAgentMessage(text) || !window.capsule) return;
    pending.current.add(id);
    setSendStates((current) => ({ ...current, [id]: "sending" }));
    try {
      await window.capsule.sendAgentMessage(id, text);
      setSendStates((current) => ({ ...current, [id]: "accepted" }));
      setDrafts((current) =>
        current[id] === text ? { ...current, [id]: "" } : current,
      );
    } catch {
      setSendStates((current) => ({ ...current, [id]: "error" }));
    } finally {
      pending.current.delete(id);
    }
  }

  async function respond(approve: boolean) {
    if (
      selected?.connection !== "connected" ||
      !selected.request ||
      !window.capsule ||
      pendingRequests.current.has(requestKey)
    )
      return;
    if (approve && !selected.request.canApprove) return;
    pendingRequests.current.add(requestKey);
    setRequestStates((current) => ({ ...current, [requestKey]: "pending" }));
    try {
      await window.capsule.respondAgentRequest(
        selected.id,
        selected.request.id,
        approve,
      );
      setRequestStates((current) => ({ ...current, [requestKey]: "accepted" }));
    } catch {
      setRequestStates((current) => ({ ...current, [requestKey]: "error" }));
      pendingRequests.current.delete(requestKey);
    }
  }

  const style = {
    "--panel-surface": theme.surface,
    "--panel-edge": theme.surfaceEdge,
    "--panel-text": theme.text,
    "--panel-muted": theme.textMuted,
    "--panel-track": theme.barTrack,
  } as CSSProperties;

  return (
    <main className="agent-panel" style={style} data-theme={theme.appearance}>
      <header className="panel-header">
        <div className="panel-heading">
          {selectedId && (
            <button
              ref={focusTarget}
              type="button"
              className="icon-button"
              aria-label={AGENT_COPY.back}
              onClick={() => setSelectedId(null)}
            >
              ‹
            </button>
          )}
          <h1>{selected ? selected.name : AGENT_COPY.title}</h1>
        </div>
        <button
          ref={selectedId ? undefined : focusTarget}
          type="button"
          className="icon-button"
          aria-label={AGENT_COPY.close}
          onClick={() => window.capsule?.closeAgents()}
        >
          ×
        </button>
      </header>
      {selected ? (
        <AgentConversation
          key={selected.id}
          session={selected}
          selectionFailed={selectionFailed}
          draft={drafts[selected.id] ?? ""}
          sendState={sendStates[selected.id]}
          requestState={requestStates[requestKey]}
          onRespond={(approve) => void respond(approve)}
          onDraft={(draft) =>
            setDrafts((current) => ({ ...current, [selected.id]: draft }))
          }
          onSend={() => void send()}
          theme={theme}
        />
      ) : selectedId ? (
        <div className="empty-state" role="status">
          <p>{AGENT_COPY.sessionGone}</p>
        </div>
      ) : (
        <>
          <AgentList
            sessions={orderSessions(snapshot.sessions)}
            filter={filter}
            onFilter={setFilter}
            onSelect={setSelectedId}
            theme={theme}
            loadingMessage={
              loadState === "loading"
                ? AGENT_COPY.loading
                : loadState === "error"
                  ? AGENT_COPY.loadFailed
                  : undefined
            }
          />
          <AgentSetup
            connections={snapshot.connections}
            setup={setup}
            failed={setupFailed}
          />
        </>
      )}
    </main>
  );
}
