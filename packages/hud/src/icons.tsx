import type { ProviderId } from "@capsule/config";
import type { ReactElement } from "react";

interface IconProps {
  color: string;
  size: number;
}

function ClaudeIcon({ color, size }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M12 3 13.5 10.2 20.7 11.7 13.5 13.2 12 20.4 10.5 13.2 3.3 11.7 10.5 10.2 12 3Z"
      />
    </svg>
  );
}

function CodexIcon({ color, size }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M8.2 5.2 4.8 12l3.4 6.8h2.4L7.2 12 10.6 5.2H8.2Zm7.6 0h2.4L21.2 12l-3.4 6.8h-2.4L16.8 12 12.8 5.2h3Zm-3.1 2.6L10.4 18h2.2l2.3-10.2h-2.2Z"
      />
    </svg>
  );
}

function GrokIcon({ color, size }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M4.2 4.2 10.8 12 4.2 19.8h3.4L12 14.4l4.4 5.4h3.4L13.2 12l6.6-7.8h-3.4L12 9.6 7.6 4.2H4.2Z"
      />
    </svg>
  );
}

export function ProviderIcon({
  id,
  color,
  size,
}: {
  id: ProviderId;
  color: string;
  size: number;
}): ReactElement {
  if (id === "codex") {
    return <CodexIcon color={color} size={size} />;
  }
  if (id === "grok") {
    return <GrokIcon color={color} size={size} />;
  }
  return <ClaudeIcon color={color} size={size} />;
}
