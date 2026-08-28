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
        d="M12 3.2 13.7 9h5.6l-4.5 3.3 1.7 5.8L12 14.9 7.5 18.1 9.2 12.3 4.7 9h5.6L12 3.2Z"
      />
    </svg>
  );
}

function ChatgptIcon({ color, size }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M12.4 3.1c1.2-.7 2.8-.3 3.6.9l.2.4c.9-.3 1.9 0 2.5.8 1 .9 1 2.5.2 3.6l-.3.4.8 1.4c.8 1.3.4 3-.9 3.8l-.4.2c.3.9 0 1.9-.8 2.5-.9 1-2.5 1-3.6.2l-.4-.3-1.4.8c-1.3.8-3 .4-3.8-.9l-.2-.4c-.9.3-1.9 0-2.5-.8-1-.9-1-2.5-.2-3.6l.3-.4-.8-1.4c-.8-1.3-.4-3 .9-3.8l.4-.2c-.3-.9 0-1.9.8-2.5.9-1 2.5-1 3.6-.2l.4.3 1.4-.8Zm-.4 5.4c-1.9 1.1-2.6 3.6-1.5 5.5 1.1 1.9 3.6 2.6 5.5 1.5 1.9-1.1 2.6-3.6 1.5-5.5-1.1-1.9-3.6-2.6-5.5-1.5Z"
      />
    </svg>
  );
}

function SparkIcon({ color, size }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M12 3.5 13.2 9.2 19 8.4 14.8 12 19 15.6l-5.8-.8L12 20.5 10.8 14.8 5 15.6 9.2 12 5 8.4l5.8.8L12 3.5Z"
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
  if (id === "chatgpt") {
    return <ChatgptIcon color={color} size={size} />;
  }
  if (id === "spark") {
    return <SparkIcon color={color} size={size} />;
  }
  return <ClaudeIcon color={color} size={size} />;
}
