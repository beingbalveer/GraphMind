import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer shadow-xs",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-xs",
        secondary: "bg-muted text-foreground hover:bg-surface-hover active:bg-muted/80",
        outline: "border border-border bg-surface text-foreground hover:bg-surface-hover hover:border-border-subtle",
        ghost: "hover:bg-surface-hover hover:text-foreground text-foreground-muted shadow-none",
        destructive: "bg-destructive text-white hover:bg-destructive/90 shadow-xs",
        dangerGhost: "text-destructive hover:bg-destructive-bg hover:text-destructive shadow-none",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded-md px-2.5 text-xs",
        lg: "h-9 rounded-xl px-4 text-sm",
        icon: "size-8 p-0",
        iconSm: "size-7 p-0",
      },
      shape: {
        rectangle: "rounded-lg",
        pill: "rounded-full",
        round: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "rectangle",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, loading = false, loadingLabel, disabled, children, ...props }, ref) => {
    return (
      <button
        {...props}
        aria-busy={loading || undefined}
        aria-label={loading ? loadingLabel : props["aria-label"]}
        className={cn(buttonVariants({ variant, size, shape, className }))}
        disabled={loading || disabled}
        ref={ref}
      >
        {loading && <Loader2 aria-hidden="true" className="size-3 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
