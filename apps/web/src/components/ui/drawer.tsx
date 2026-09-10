"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IconButton } from "./icon-button";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  hasBackdrop?: boolean;
  widthClassName?: string;
  className?: string;
}

export function Drawer({
  isOpen,
  onClose,
  children,
  title,
  description,
  icon,
  headerActions,
  hasBackdrop = true,
  widthClassName = "w-full sm:w-[480px] md:w-[540px] lg:w-[580px]",
  className,
}: DrawerProps) {
  const openerRef = React.useRef<HTMLElement | null>(null);
  const hasTitle = Boolean(title);
  const ariaLabel = typeof title === "string" ? title : "Panel";

  return (
    <DialogPrimitive.Root
      modal={hasBackdrop}
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {hasBackdrop && <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay motion-reduce:transition-none" />}
        <DialogPrimitive.Content
          aria-label={ariaLabel}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-surface text-foreground shadow-modal transition-transform duration-200 ease-out motion-reduce:transition-none",
            widthClassName,
            className
          )}
          onPointerDownOutside={(event) => {
            if (!hasBackdrop) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (!hasBackdrop) event.preventDefault();
          }}
          onOpenAutoFocus={() => {
            // Capture before Radix moves focus; this API has no Dialog.Trigger.
            openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const activeElement = document.activeElement;
            const content = event.target as HTMLElement;
            const shouldRestore = hasBackdrop || activeElement === document.body || content.contains(activeElement);
            if (shouldRestore && openerRef.current?.isConnected) openerRef.current.focus();
            openerRef.current = null;
          }}
        >
          {(hasTitle || Boolean(headerActions) || Boolean(onClose)) && (
            <div className="flex h-13 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
              <div className="flex min-w-0 items-center gap-2.5 pr-2">
                {icon && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground shadow-xs">
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  {hasTitle && (
                    <DialogPrimitive.Title className="block truncate text-xs font-semibold tracking-tight text-foreground">
                      {title}
                    </DialogPrimitive.Title>
                  )}
                  {description && (
                    <DialogPrimitive.Description className="block truncate font-mono text-2xs text-foreground-muted">
                      {description}
                    </DialogPrimitive.Description>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {headerActions}
                <IconButton label="Close drawer" onClick={onClose} variant="ghost">
                  <X className="size-4" />
                </IconButton>
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
