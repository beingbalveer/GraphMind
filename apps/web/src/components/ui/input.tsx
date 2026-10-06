"use client";

import React, { forwardRef } from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "w-full rounded-lg border text-sm transition-all placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-border bg-surface text-foreground focus-visible:bg-surface focus-visible:border-focus-ring",
        ghost:
          "border-transparent bg-transparent text-foreground focus-visible:bg-surface-hover focus-visible:border-border",
      },
      inputSize: {
        sm: "h-7 px-2.5 text-xs rounded-lg",
        default: "h-8 px-2.5 text-sm rounded-lg",
        lg: "h-10 px-3 text-sm rounded-lg",
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
          <InputPrimitive
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
