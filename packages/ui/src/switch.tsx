import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border border-shell-line-strong bg-shell-raised p-px transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent-line focus-visible:ring-offset-2 focus-visible:ring-offset-shell-panel disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-shell-accent data-[state=checked]:bg-shell-accent",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-200 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}
