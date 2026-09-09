import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const surfaceVariants = cva("border", {
  variants: {
    variant: {
      base: "bg-surface border-border-subtle",
      raised: "bg-surface-raised border-border shadow-sm",
      muted: "bg-background-secondary border-border-subtle",
      interactive: "bg-surface border-border hover:bg-surface-hover focus-within:border-border-strong",
    },
    radius: {
      control: "rounded-lg",
      widget: "rounded-xl",
      card: "rounded-2xl",
    },
  },
  defaultVariants: { variant: "base", radius: "card" },
});

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceVariants> {}

function Surface({ className, variant, radius, ...props }: SurfaceProps) {
  return <div className={cn(surfaceVariants({ variant, radius }), className)} {...props} />;
}

export { Surface, surfaceVariants };
