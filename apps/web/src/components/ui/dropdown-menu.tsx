"use client";

import React, { useRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

import { MenuCard, MenuItem } from "./menu";
export { MenuCard, MenuItem, MenuHeader } from "./menu";

export interface DropdownMenuItemProps {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItemProps[];
  align?: "left" | "right";
  className?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

export function DropdownMenu({
  trigger,
  items,
  align = "right",
  className,
  onOpenChange,
}: DropdownMenuProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <DropdownMenuPrimitive.Root onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger asChild>
        {trigger}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={contentRef}
          align={align === "right" ? "end" : "start"}
          sideOffset={4}
          className="z-dropdown outline-none"
          {...({
            onOpenAutoFocus: (event: Event) => {
              event.preventDefault();
              contentRef.current
                ?.querySelector<HTMLButtonElement>('button:not([disabled])')
                ?.focus();
            },
          } as React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>)}
        >
          <MenuCard className={cn("min-w-48", className)}>
            {items.map((item) => (
              <DropdownMenuPrimitive.Item key={item.label} disabled={item.disabled} asChild>
                <MenuItem
                  disabled={item.disabled}
                  variant={item.variant}
                  icon={item.icon}
                  onClick={item.onClick}
                >
                  {item.label}
                </MenuItem>
              </DropdownMenuPrimitive.Item>
            ))}
          </MenuCard>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
