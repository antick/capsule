import { AGENT_COPY, type ConnectedAgent } from "@capsule/config";

export type RequestState = "pending" | "accepted" | "error";

export function AgentRequest({
  connected,
  request,
  state,
  onRespond,
}: {
  connected: boolean;
  request: NonNullable<ConnectedAgent["request"]>;
  state?: RequestState;
  onRespond: (approve: boolean) => void;
}) {
  const disabled = !connected || state === "pending" || state === "accepted";
  return (
    <section className="agent-request" aria-label={request.title}>
      <h2>{request.title}</h2>
      <textarea readOnly aria-label={request.title} value={request.detail} />
      <div className="request-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRespond(false)}
        >
          {AGENT_COPY.decline}
        </button>
        {request.canApprove && (
          <button
            type="button"
            disabled={disabled}
            className="approve-button"
            onClick={() => onRespond(true)}
          >
            {AGENT_COPY.approveOnce}
          </button>
        )}
      </div>
      {state && (
        <p role="status">
          {state === "error"
            ? AGENT_COPY.requestFailed
            : state === "accepted"
              ? AGENT_COPY.responseAccepted
              : AGENT_COPY.responding}
        </p>
      )}
    </section>
  );
}
