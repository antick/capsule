import {
  APP_NAME,
  COPY,
  UPDATE_COPY,
  type UpdateState,
  updateShortLabel,
  updateTone,
} from "@capsule/config";
import { cn, StatusPill } from "@capsule/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  type LucideIcon,
  Palette,
  Plug,
  Settings2,
} from "lucide-react";
import type { ReactElement } from "react";
import { AppMark } from "./app-mark.tsx";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: readonly NavItem[] = [
  { to: "/", label: COPY.appearance, icon: Palette },
  { to: "/providers", label: COPY.providers, icon: Plug },
  { to: "/updates", label: UPDATE_COPY.updates, icon: ArrowDownToLine },
  { to: "/general", label: COPY.general, icon: Settings2 },
];

/**
 * The window's left column. Left unpainted so the macOS sidebar material shows
 * through it, and drag-enabled so the whole thing doubles as the title bar the
 * frameless window does not have.
 */
export function Sidebar({
  path,
  update,
}: {
  path: string;
  update: UpdateState | null;
}): ReactElement {
  return (
    <aside className="drag-region flex w-[228px] shrink-0 flex-col border-r border-shell-line pb-3">
      <div className="flex items-center gap-2.5 px-4 pt-[52px] pb-5">
        <AppMark />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-tight">
            {APP_NAME}
          </div>
          <div className="text-[11.5px] leading-tight text-shell-muted">
            {update ? `Version ${update.currentVersion}` : COPY.settings}
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
        {NAV.map((item) => (
          <NavLink key={item.to} item={item} active={path === item.to} />
        ))}
      </nav>

      {update ? (
        <UpdateFooter update={update} active={path === "/updates"} />
      ) : null}
    </aside>
  );
}

function NavLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}): ReactElement {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[13.5px] transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent-line",
        active
          ? "bg-shell-panel font-medium text-shell-text shadow-[var(--shell-shadow-card)]"
          : "text-shell-muted hover:bg-shell-hover hover:text-shell-text",
      )}
    >
      <Icon
        size={16}
        strokeWidth={1.9}
        className={active ? "text-shell-accent" : "text-shell-faint"}
      />
      {item.label}
    </Link>
  );
}

/**
 * The update's standing, parked where a status line belongs. It is a link
 * rather than a label: seeing "Update available" and having nowhere to press
 * is the whole reason people go hunting through settings.
 */
function UpdateFooter({
  update,
  active,
}: {
  update: UpdateState;
  active: boolean;
}): ReactElement {
  return (
    <Link
      to="/updates"
      className={cn(
        "mx-2.5 mt-3 flex items-center justify-between gap-2 rounded-[10px] border border-shell-line px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent-line",
        active ? "bg-shell-panel" : "hover:bg-shell-hover",
      )}
    >
      <span className="truncate text-[11.5px] text-shell-muted">
        {UPDATE_COPY.updates}
      </span>
      <StatusPill
        tone={updateTone(update.phase)}
        className="bg-transparent px-0"
      >
        {updateShortLabel(update.phase)}
      </StatusPill>
    </Link>
  );
}
