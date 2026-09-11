"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "ghost";
  invalid?: boolean;
  errorMessage?: string;
  maxRowsClassName?: string;
}

const textareaClasses =
  "min-h-20 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground shadow-2xs transition-all placeholder:text-foreground-muted/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30 disabled:cursor-not-allowed disabled:opacity-50";

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      variant = "default",
      disabled,
      invalid,
      errorMessage,
      maxRowsClassName,
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
        <textarea
          ref={ref}
          disabled={disabled}
          aria-invalid={invalid ? true : ariaInvalid}
          aria-describedby={descriptionIds}
          className={cn(
            textareaClasses,
            variant === "ghost" &&
              "border-0 border-transparent bg-transparent shadow-none rounded-none focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:outline-none focus:outline-none focus:ring-0",
            invalid && "border-destructive focus-visible:border-destructive",
            maxRowsClassName,
            className
          )}
          {...props}
        />
        {errorMessage && (
          <p id={errorId} role="alert" className="text-destructive text-xs">
            {errorMessage}
          </p>
        )}
      </>
    );
  }
);

Textarea.displayName = "Textarea";
