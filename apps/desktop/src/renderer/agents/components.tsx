import {
  AGENT_COPY,
  AGENTS,
  type AgentPanelSnapshot,
  type ConnectedAgent,
  type HudTheme,
  PROVIDER_LABELS,
  sessionStateColor,
  validAgentMessage,
} from "@capsule/config";
import { formatAgo } from "@capsule/dates";
import { useEffect, useRef } from "react";
import type { SendState } from "./AgentPanel.tsx";
import { AgentRequest, type RequestState } from "./AgentRequest.tsx";

export type AgentFilter = "all" | "claude" | "codex";

function SessionStatus({
  session,
  theme,
}: {
  session: ConnectedAgent;
  theme: HudTheme;
}) {
  return (
    <span
      className="session-state"
      style={{ color: sessionStateColor(session.state, theme) }}
    >
      <span className="status-dot" aria-hidden="true" />
      {AGENT_COPY[session.state]}
    </span>
  );
}

export function AgentList({
  sessions,
  filter,
  onFilter,
  onSelect,
  theme,
  loadingMessage,
}: {
  sessions: ConnectedAgent[];
  filter: AgentFilter;
  onFilter: (filter: AgentFilter) => void;
  onSelect: (id: string) => void;
  theme: HudTheme;
  loadingMessage?: string;
}) {
  const visible = sessions.filter(
    (session) => filter === "all" || session.providerId === filter,
  );
  return (
    <>
      <nav className="provider-filters" aria-label={AGENT_COPY.filterLabel}>
        {(["all", "claude", "codex"] as const).map((provider) => (
          <button
            key={provider}
            type="button"
            aria-pressed={filter === provider}
            onClick={() => onFilter(provider)}
          >
            {provider === "all" ? AGENT_COPY.all : PROVIDER_LABELS[provider]}
          </button>
        ))}
      </nav>
      <div className="session-list">
        {loadingMessage ? (
          <div className="empty-state" role="status">
            <p>{loadingMessage}</p>
          </div>
        ) : visible.length ? (
          <ul>
            {visible.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className="session-row"
                  onClick={() => onSelect(session.id)}
                >
                  <span className="session-topline">
                    <strong>{session.name}</strong>
                    <span className="row-chevron" aria-hidden="true">
                      ›
                    </span>
                  </span>
                  <span className="session-detail">
                    {session.waitingFor || session.detail}
                  </span>
                  <span className="session-bottomline">
                    <SessionStatus session={session} theme={theme} />
                    <span>
                      {PROVIDER_LABELS[session.providerId]} ·{" "}
                      {session.connection === "connected"
                        ? AGENT_COPY.connected
                        : AGENT_COPY.viewOnly}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <p>{AGENT_COPY.empty}</p>
            <span>{AGENT_COPY.emptyHint}</span>
          </div>
        )}
      </div>
    </>
  );
}

export function AgentConversation({
  session,
  selectionFailed = false,
  draft,
  sendState,
  requestState,
  onRespond,
  onDraft,
  onSend,
  theme,
}: {
  session: ConnectedAgent;
  selectionFailed?: boolean;
  draft: string;
  sendState?: SendState;
  requestState?: RequestState;
  onRespond: (approve: boolean) => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  theme: HudTheme;
}) {
  const transcript = useRef<HTMLDivElement>(null);
  const lastMessage = session.messages.at(-1)?.id;
  useEffect(() => {
    if (lastMessage && transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [lastMessage]);
  const connected = session.connection === "connected";
  const sending = sendState === "sending";
  const blocked = !connected || Boolean(session.request);
  const sendCopy =
    sendState === "error"
      ? AGENT_COPY.uncertain
      : sendState === "accepted"
        ? AGENT_COPY.accepted
        : sending
          ? AGENT_COPY.sending
          : "";
  return (
    <section className="conversation" aria-label={AGENT_COPY.conversation}>
      <div className="conversation-meta">
        <div className="session-bottomline">
          <SessionStatus session={session} theme={theme} />
          <span>{formatAgo(new Date(session.since))}</span>
        </div>
        <p className="session-detail">{session.waitingFor || session.detail}</p>
        <p className="connection-note">
          <strong>
            {connected ? AGENT_COPY.connected : AGENT_COPY.viewOnly}
          </strong>{" "}
          · {session.note || AGENT_COPY.observedNote}
        </p>
      </div>
      {selectionFailed && (
        <p className="conversation-error" role="alert">
          {AGENT_COPY.loadFailed}
        </p>
      )}
      <div
        ref={transcript}
        className="transcript"
        role="log"
        aria-label={AGENT_COPY.conversation}
        aria-live="polite"
      >
        {session.messages.length ? (
          session.messages.map((message) => (
            <div className="message" data-role={message.role} key={message.id}>
              <span className="message-author">
                {message.role === "user"
                  ? AGENT_COPY.you
                  : PROVIDER_LABELS[session.providerId]}
              </span>
              <p>{message.text}</p>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <span>{AGENT_COPY.noMessages}</span>
          </div>
        )}
      </div>
      {session.request && (
        <AgentRequest
          key={session.request.id}
          state={requestState}
          onRespond={onRespond}
          connected={connected}
          request={session.request}
        />
      )}
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <textarea
          aria-label={AGENT_COPY.placeholder}
          placeholder={
            connected ? AGENT_COPY.placeholder : AGENT_COPY.observedNote
          }
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          maxLength={AGENTS.maxMessageLength}
          disabled={!connected}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              event.metaKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (!sending && !blocked && validAgentMessage(draft)) onSend();
            }
          }}
        />
        <div className="composer-footer">
          <span>
            {session.request
              ? AGENT_COPY.requestBlocksSend
              : AGENT_COPY.shortcut}
          </span>
          <button
            type="submit"
            className="send-button"
            disabled={blocked || sending || !validAgentMessage(draft)}
          >
            {sending ? AGENT_COPY.sending : AGENT_COPY.send}
          </button>
        </div>
        {sendCopy && (
          <p
            className="send-feedback"
            data-error={sendState === "error"}
            role="status"
          >
            {sendCopy}
          </p>
        )}
      </form>
    </section>
  );
}

export function AgentSetup({
  connections,
  setup,
  failed,
}: {
  connections: AgentPanelSnapshot["connections"];
  setup: { claude: string; codex: string } | null;
  failed: boolean;
}) {
  return (
    <details className="connection-setup">
      <summary>{AGENT_COPY.setup}</summary>
      <div className="setup-content">
        <p>{AGENT_COPY.setupHint}</p>
        {(["claude", "codex"] as const).map((provider) => {
          const connection = connections.find(
            (entry) => entry.provider === provider,
          );
          return (
            <section key={provider}>
              <h2>
                {PROVIDER_LABELS[provider]}{" "}
                {connection?.connected && <span>· {AGENT_COPY.connected}</span>}
              </h2>
              <p>
                {connection?.detail ||
                  (provider === "claude"
                    ? AGENT_COPY.claudeUnavailable
                    : AGENT_COPY.codexUnavailable)}
              </p>
              <p>
                {provider === "claude"
                  ? AGENT_COPY.claudeSetup
                  : AGENT_COPY.codexSetup}
              </p>
              {setup ? (
                <textarea
                  readOnly
                  aria-label={PROVIDER_LABELS[provider]}
                  value={setup[provider]}
                />
              ) : (
                <p role="status">
                  {failed ? AGENT_COPY.setupFailed : AGENT_COPY.setupLoading}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </details>
  );
}
