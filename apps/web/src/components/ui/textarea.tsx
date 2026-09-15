import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "ghost";
  invalid?: boolean;
  errorMessage?: string;
  maxRowsClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = "default", invalid, errorMessage, maxRowsClassName, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const generatedErrorId = React.useId();
    const errorId = errorMessage ? generatedErrorId : undefined;
    return <><textarea ref={ref} data-slot="textarea" aria-invalid={invalid ? true : ariaInvalid} aria-describedby={[describedBy, errorId].filter(Boolean).join(" ") || undefined} className={cn("border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex min-h-20 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50", variant === "ghost" && "border-0 bg-transparent shadow-none focus-visible:ring-0", invalid && "border-destructive focus-visible:border-destructive", maxRowsClassName, className)} {...props} />{errorMessage && <p id={errorId} role="alert" className="text-destructive text-xs">{errorMessage}</p>}</>;
  },
);

Textarea.displayName = "Textarea";
