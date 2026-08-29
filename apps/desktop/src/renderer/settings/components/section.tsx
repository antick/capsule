import type { ReactElement, ReactNode } from "react";

export function Section({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="rounded-2xl border border-shell-line bg-shell-panel p-5">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-shell-muted">
            {title}
          </h2>
          {hint ? (
            <p className="mt-1 max-w-md text-xs leading-snug text-shell-muted/80">
              {hint}
            </p>
          ) : null}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

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
    <div className="flex items-center justify-between gap-6 border-t border-shell-line/60 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-xs leading-snug text-shell-muted">
            {hint}
          </div>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
