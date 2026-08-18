import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none shadow-xs",
  {
    variants: {
      variant: {
        default: "bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 shadow-sm",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300",
        outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
        ghost: "hover:bg-slate-100 hover:text-slate-900 text-slate-600 shadow-none",
        destructive: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
        dangerGhost: "text-rose-600 hover:bg-rose-50 hover:text-rose-700 shadow-none",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded-md px-2.5 text-[11px]",
        lg: "h-9 rounded-xl px-4 text-sm",
        icon: "h-8 w-8 p-0",
        iconSm: "h-7 w-7 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
