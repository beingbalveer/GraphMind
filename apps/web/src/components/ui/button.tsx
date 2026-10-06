import React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button box-border inline-flex shrink-0 items-center justify-center rounded-lg text-sm font-medium leading-5 whitespace-nowrap select-none transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "border-0 bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-hover",
        secondary:
          "border-0 bg-secondary text-secondary-foreground hover:bg-surface-hover",
        ghost:
          "border-0 bg-transparent text-foreground hover:bg-surface-hover",
        destructive:
          "border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:text-destructive-foreground dark:hover:bg-destructive/30",
        link: "border-0 bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto min-w-0",
      },
      size: {
        default: "h-8 min-w-16 gap-1.5 px-2.5 text-sm",
        xs: "h-6 gap-1 px-2 text-2xs rounded-md [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2 text-xs rounded-md [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 gap-1.5 px-3 text-sm",
        icon: "size-8 min-w-0 p-0",
        "icon-xs": "size-6 min-w-0 p-0 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 min-w-0 p-0",
        iconSm: "size-7 min-w-0 p-0",
        "icon-lg": "size-9 min-w-0 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  loadingLabel,
  disabled,
  children,
  "aria-busy": ariaBusy,
  "aria-label": ariaLabel,
  ...props
}: ButtonProps, ref) {
  return (
    <ButtonPrimitive
      {...props}
      ref={ref}
      aria-busy={loading ? true : ariaBusy}
      aria-label={loading ? loadingLabel ?? ariaLabel : ariaLabel}
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      disabled={loading || disabled}
    >
      {loading && <Loader2 aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />}
      {children}
    </ButtonPrimitive>
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
