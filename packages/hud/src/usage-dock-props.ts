import type {
  ActivityByProvider,
  ActivityNotice,
  Corner,
  DockStyle,
  HardwareNotch,
  HudMetrics,
  HudTheme,
  ProviderId,
  TokenUsageByProvider,
  UsageDisplay,
  UsageSnapshot,
} from "@capsule/config";
import type { MouseEvent } from "react";
import type { CardGrowth, HitRegions } from "./HudFrame.tsx";

export interface UsageDockProps {
  snapshots: UsageSnapshot[];
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  notch?: boolean;
  metrics?: HudMetrics;
  theme?: HudTheme;
  dockStyle?: DockStyle;
  now?: Date;
  /** Where the rail sits inside its frame; the main process owns this. */
  railBias?: number | null;
  /** Set when the dock has curled into a screen corner as an arc. */
  corner?: Corner | null;
  /** Rest as a latch in the screen edge until the pointer comes for it. */
  autoHide?: boolean;
  /**
   * Held out, so it stays unrolled after the pointer leaves. A gesture rather
   * than a setting: clicking the rail toggles it, and so can a menu.
   */
  keepOpen?: boolean;
  onKeepOpenChange?: (keepOpen: boolean) => void;
  /** Live agent sessions, by provider, for the rings and the card. */
  activity?: ActivityByProvider;
  notices?: ActivityNotice[];
  notificationPopups?: boolean;
  onReadNotices?: (ids: string[]) => void;
  onDismissNotice?: (id: string) => void;
  /** The display's own notch, when the top edge is drawn as it. */
  hardwareNotch?: HardwareNotch | null;
  /**
   * The host's own verdict on whether the cursor is over the dock. A
   * click-through window raises no pointerout, so DOM events alone would leave
   * a card open for good once the cursor left.
   */
  pointerInside?: boolean | null;
  /**
   * Bumped when the user asks "where is it?" from a menu. A hidden dock is a
   * few pixels of tab that can vanish into a dark wallpaper, so this unrolls
   * it and holds it out long enough to be spotted.
   */
  revealNonce?: number;
  forceOpenProviderId?: ProviderId | null;
  onOpenChange?: (open: boolean, providerId: ProviderId | null) => void;
  /** Fires when the user asks for a provider to be read again. */
  onRefresh?: (providerId: ProviderId) => void;
  onAgents?: (providerId: ProviderId) => void;
  onContextMenu?: (event: MouseEvent) => void;
  /** Fires while the pointer is held down, so the host can pin mouse capture. */
  onPressedChange?: (pressed: boolean) => void;
  onMoveStart?: (screenX: number, screenY: number) => void;
  onMoveEnd?: () => void;
  /** Reports the areas that should swallow the mouse, local to the dock. */
  onHitRegions?: (regions: HitRegions) => void;
  /** Tokens each provider's agents have got through, from their local logs. */
  tokens?: TokenUsageByProvider;
  /** Whether rings, bars and percentages count what is used or what is left. */
  usageDisplay?: UsageDisplay;
  /** Grace after the pointer leaves before an auto-hiding dock folds away. */
  hideDelayMs?: number;
}
