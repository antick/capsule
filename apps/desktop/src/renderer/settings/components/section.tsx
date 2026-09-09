import { cn } from "@capsule/ui";
import type { ReactElement, ReactNode } from "react";

/** The one heading each page opens with, above its cards. */
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}): ReactElement {
  return (
    <header className="drag-region px-1 pb-1">
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em]">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-shell-muted">
          {description}
        </p>
      ) : null}
    </header>
  );
}

/**
 * A card of related settings. Everything on a page is one of these, so the
 * page reads as a short stack rather than a wall of controls.
 */
export function Section({
  title,
  hint,
  aside,
  padded = true,
  children,
}: {
  title?: string;
  hint?: string;
  aside?: ReactNode;
  /**
   * Off when the card's contents own their edges — a preview that bleeds to
   * the card's corners looks wrong with a second frame drawn inside it.
   */
  padded?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="rounded-2xl bg-shell-panel ring-1 ring-shell-line shadow-[var(--shell-shadow-card)]">
      {title ? (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-snug">{title}</h2>
            {hint ? (
              <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-shell-muted">
                {hint}
              </p>
            ) : null}
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </header>
      ) : null}
      <div className={cn(padded && "px-5 pb-5", !title && padded && "pt-5")}>
        {children}
      </div>
    </section>
  );
}

/** One setting: what it is on the left, the control that changes it on the right. */
export function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-shell-line py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{label}</div>
        {hint ? (
          <div className="mt-0.5 max-w-md text-[12px] leading-relaxed text-shell-muted">
            {hint}
          </div>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/**
 * A choice drawn as a card: a picture of the option above its name. Shared by
 * the theme, style and placement pickers so a selected option looks the same
 * wherever it is offered.
 */
export function OptionCard({
  selected,
  label,
  hint,
  onClick,
  layout = "stacked",
  children,
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
  /** `stacked` puts the picture above the words; `inline` puts it beside them. */
  layout?: "stacked" | "inline";
  children?: ReactNode;
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "group rounded-xl border p-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent-line",
        layout === "inline" && "flex items-center gap-3",
        selected
          ? "border-shell-accent bg-shell-accent-soft shadow-[0_0_0_1px_var(--shell-accent)]"
          : "border-shell-line bg-shell-raised hover:border-shell-line-strong hover:bg-shell-hover",
      )}
    >
      {children}
      <span
        className={cn("min-w-0", layout === "stacked" && "mt-2 block px-0.5")}
      >
        <span className="block text-[13px] font-medium">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[11.5px] leading-snug text-shell-muted">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}
