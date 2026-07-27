import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg+div]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        error: "bg-[oklch(0.965_0.025_27)] text-[oklch(0.4_0.18_27)]",
        success: "bg-[oklch(0.955_0.035_145)] text-[oklch(0.34_0.105_145)]",
        warning: "bg-[oklch(0.95_0.055_78)] text-[oklch(0.34_0.08_78)]",
        info: "bg-[oklch(0.96_0.025_250)] text-[oklch(0.38_0.10_250)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("mb-1 font-semibold leading-none", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("leading-5", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
