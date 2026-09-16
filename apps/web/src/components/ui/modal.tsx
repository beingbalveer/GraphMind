"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { IconButton } from "./icon-button";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "5xl" | "full";
  className?: string;
  closeOnClickOutside?: boolean;
  ariaLabel?: string;
  role?: "dialog" | "alertdialog";
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full: "max-w-[95vw] h-[90vh]",
};

export function Modal({
  isOpen,
  onClose,
  children,
  size = "lg",
  className,
  closeOnClickOutside = true,
  ariaLabel = "Dialog",
  role = "dialog",
}: ModalProps) {
  const previouslyFocusedElement = React.useRef<HTMLElement | null>(null);
  const popupRef = React.useRef<HTMLDivElement | null>(null);
  const hasSharedHeader = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === ModalHeader
  );

  React.useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [isOpen]);

  return (
    <DialogPrimitive.Root
      open={isOpen}
      disablePointerDismissal={!closeOnClickOutside}
      onOpenChange={(open, details) => {
        if (!open && !(details.reason === "escape-key" && !closeOnClickOutside)) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 isolate z-50 bg-overlay backdrop-blur-xs duration-100" />
        <DialogPrimitive.Popup
          ref={popupRef}
          aria-label={hasSharedHeader ? undefined : ariaLabel}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-modal motion-reduce:transition-none",
            sizeClasses[size],
            className
          )}
          initialFocus={() => popupRef.current?.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), select:not([disabled])") ?? false}
          finalFocus={() => previouslyFocusedElement.current}
          role={role}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface ModalHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function ModalHeader({
  title,
  description,
  icon,
  onClose,
  className,
  children,
}: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-13 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground shadow-xs">
            {icon}
          </div>
        )}
        <div className="min-w-0">
        <DialogPrimitive.Title className="truncate text-sm font-semibold leading-tight text-foreground">
            {title}
          </DialogPrimitive.Title>
          {description && (
          <DialogPrimitive.Description className="truncate text-xs text-foreground-muted">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {children}
        {onClose && (
          <IconButton label="Close dialog" onClick={onClose} variant="ghost">
            <X className="size-4" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-5", className)}>{children}</div>;
}

export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-border bg-background-secondary px-5 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}
