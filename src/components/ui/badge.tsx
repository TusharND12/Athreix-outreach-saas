import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] leading-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-background text-foreground",
        success: "bg-[oklch(0.94_0.035_145)] text-[oklch(0.35_0.11_145)]",
        warning: "bg-[oklch(0.94_0.05_78)] text-[oklch(0.35_0.09_78)]",
        destructive: "bg-[oklch(0.95_0.025_27)] text-[oklch(0.45_0.19_27)]",
        info: "bg-[oklch(0.95_0.025_250)] text-[oklch(0.42_0.12_250)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
