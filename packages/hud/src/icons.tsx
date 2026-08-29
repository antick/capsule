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

const GROK_MARK =
  "M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815";

/** xAI's Grok mark: a slashed blade cut by a rising stroke. */
function GrokIcon({ color, size }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill={color} fillRule="evenodd" d={GROK_MARK} />
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
