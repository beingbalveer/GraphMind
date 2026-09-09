"use client";

import React from "react";
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
  return (
    <DropdownMenuPrimitive.Root onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger asChild>
        {trigger}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align === "right" ? "end" : "start"}
          sideOffset={4}
          className="z-dropdown outline-none"
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
