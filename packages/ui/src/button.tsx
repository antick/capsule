import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn.ts";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent-line focus-visible:ring-offset-2 focus-visible:ring-offset-shell-panel active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        /** The one thing the panel wants you to press. */
        default:
          "bg-shell-accent text-shell-on-accent shadow-sm hover:brightness-110",
        /** Everything else: reads as a control, not as a call to action. */
        outline:
          "border border-shell-line-strong bg-shell-panel text-shell-text shadow-sm hover:bg-shell-hover",
        subtle: "bg-shell-raised text-shell-text hover:bg-shell-hover",
        ghost: "text-shell-muted hover:bg-shell-raised hover:text-shell-text",
        danger: "bg-shell-danger text-white shadow-sm hover:brightness-110",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-8 px-3 text-[13px]",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
