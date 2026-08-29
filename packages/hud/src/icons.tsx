import type { ProviderId } from "@capsule/config";
import type { ReactElement } from "react";

interface IconProps {
  color: string;
  size: number;
}

const CLAUDE_RAYS = 12;
const CLAUDE_INNER = 1.1;
const CLAUDE_OUTER = 10.4;
/** Half-width of a spoke where it leaves the core, in viewBox units. */
const CLAUDE_ROOT_HALF = 1.05;
/** Half-width at the tip; small but non-zero so the point stays crisp. */
const CLAUDE_TIP_HALF = 0.62;
/** Short spokes alternate with long ones, as in the Anthropic mark. */
const CLAUDE_SHORT_RATIO = 0.86;

function claudeSpoke(index: number): string {
  const angle = (index * 2 * Math.PI) / CLAUDE_RAYS - Math.PI / 2;
  const outer = CLAUDE_OUTER * (index % 2 === 0 ? 1 : CLAUDE_SHORT_RATIO);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Unit vector perpendicular to the spoke, used to give it width.
  const px = -sin;
  const py = cos;
  const point = (radius: number, half: number, sign: number) =>
    `${(12 + cos * radius + px * half * sign).toFixed(3)} ${(
      12 + sin * radius + py * half * sign
    ).toFixed(3)}`;
  return [
    `M ${point(CLAUDE_INNER, CLAUDE_ROOT_HALF, 1)}`,
    `L ${point(outer, CLAUDE_TIP_HALF, 1)}`,
    `L ${point(outer, CLAUDE_TIP_HALF, -1)}`,
    `L ${point(CLAUDE_INNER, CLAUDE_ROOT_HALF, -1)}`,
    "Z",
  ].join(" ");
}

/** Anthropic's sunburst: tapered spokes radiating from a dense core. */
function ClaudeIcon({ color, size }: IconProps): ReactElement {
  const spokes = Array.from({ length: CLAUDE_RAYS }, (_, index) =>
    claudeSpoke(index),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g fill={color}>
        {spokes.map((d) => (
          <path key={d} d={d} />
        ))}
        <circle cx={12} cy={12} r={1.85} />
      </g>
    </svg>
  );
}

const OPENAI_MARK =
  "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.494zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z";

function CodexIcon({ color, size }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill={color} d={OPENAI_MARK} />
    </svg>
  );
}

const GROK_STROKES = [
  "M12 0.6 V23.4",
  "M3.6 0.6 V7",
  "M20.4 0.6 V7",
  "M3.6 0.6 L12 6.3",
  "M20.4 0.6 L12 6.3",
  "M0.6 7 H23.4",
  "M0.6 7 V16",
  "M23.4 7 V16",
  "M0.6 16 H3.6",
  "M20.4 16 H23.4",
  "M12 7.2 L3.6 16",
  "M12 7.2 L20.4 16",
  "M3.6 16 V23.4",
  "M20.4 16 V23.4",
  "M3.6 23.4 L12 17.7",
  "M20.4 23.4 L12 17.7",
];

/** xAI's angular Grok emblem, mirrored about its horizontal axis. */
function GrokIcon({ color, size }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      >
        {GROK_STROKES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
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
