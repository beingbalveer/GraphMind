"use client";

import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "w-full rounded-xl border text-xs transition-all placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-border bg-surface text-foreground focus:bg-surface focus:border-primary focus:ring-primary/20 shadow-2xs",
        ghost:
          "border-transparent bg-transparent text-foreground focus:bg-surface-hover focus:border-border focus:ring-primary/10",
      },
      inputSize: {
        sm: "h-7.5 px-2.5 text-xs rounded-lg",
        default: "h-8.5 px-3 text-xs rounded-xl",
        lg: "h-10 px-3.5 text-sm rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      inputSize,
      startIcon,
      endIcon,
      disabled,
      type = "text",
      ...props
    },
    ref
  ) => {
    return (
      <div className="relative flex items-center w-full">
        {startIcon && (
          <div className="absolute left-2.5 flex items-center pointer-events-none text-zinc-400">
            {startIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={cn(
            inputVariants({ variant, inputSize }),
            startIcon && "pl-9",
            endIcon && "pr-9",
            className
          )}
          {...props}
        />
        {endIcon && (
          <div className="absolute right-2 flex items-center text-zinc-400">
            {endIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { inputVariants };
