"use client";

import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "w-full rounded-xl border text-xs transition-all placeholder:text-foreground-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-border bg-surface text-foreground focus-visible:bg-surface focus-visible:border-primary shadow-2xs",
        ghost:
          "border-transparent bg-transparent text-foreground focus-visible:bg-surface-hover focus-visible:border-border",
      },
      inputSize: {
        sm: "h-7 px-2.5 text-xs rounded-lg",
        default: "h-8 px-3 text-xs rounded-xl",
        lg: "h-10 px-3.5 text-sm rounded-xl",
      },
      invalid: {
        true: "border-destructive focus-visible:border-destructive",
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
  invalid?: boolean;
  errorMessage?: string;
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
      invalid,
      errorMessage,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref
  ) => {
    const generatedErrorId = React.useId();
    const errorId = errorMessage ? generatedErrorId : undefined;
    const descriptionIds = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <>
        <div className="relative flex w-full items-center">
          {startIcon && (
            <div className="pointer-events-none absolute left-2.5 flex items-center text-foreground-subtle">
              {startIcon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            disabled={disabled}
            aria-invalid={invalid ? true : ariaInvalid}
            aria-describedby={descriptionIds}
            className={cn(
              inputVariants({ variant, inputSize, invalid }),
              startIcon && "pl-9",
              endIcon && "pr-9",
              className
            )}
            {...props}
          />
          {endIcon && (
            <div className="absolute right-2 flex items-center text-foreground-subtle">
              {endIcon}
            </div>
          )}
        </div>
        {errorMessage && (
          <p id={errorId} role="alert" className="text-destructive text-xs">
            {errorMessage}
          </p>
        )}
      </>
    );
  }
);

Input.displayName = "Input";
export { inputVariants };
