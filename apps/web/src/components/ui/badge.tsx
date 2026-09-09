import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold transition-colors focus:outline-none select-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: "border-border-subtle bg-muted text-foreground-muted",
        outline: "border-border text-foreground bg-surface",
        success: "border-success bg-success-bg text-success",
        destructive: "border-destructive bg-destructive-bg text-destructive",
        warning: "border-warning bg-warning-bg text-warning",
        info: "border-info bg-info-bg text-info",
        mono: "border-border bg-muted text-foreground-muted font-mono",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
