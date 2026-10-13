"use client";

import React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

import { MenuCard, MenuItem } from "./menu";
export { MenuCard, MenuItem, MenuHeader } from "./menu";

export interface DropdownMenuItemProps {
  key?: React.Key;
  label: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItemProps[];
  align?: "left" | "right" | "center";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  header?: React.ReactNode;
  open?: boolean;
  className?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

export function DropdownMenu({
  trigger,
  items,
  align = "right",
  side = "bottom",
  sideOffset = 4,
  header,
  open,
  className,
  onOpenChange,
}: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align === "right" ? "end" : align === "left" ? "start" : "center"}
          side={side}
          sideOffset={sideOffset}
          className="z-dropdown outline-none"
        >
          <MenuCard className={cn("min-w-48", className)}>
            {header}
            {items.map((item, index) => (
              <DropdownMenuPrimitive.Item
                key={item.key ?? (typeof item.label === "string" ? `${item.label}-${index}` : index)}
                disabled={item.disabled}
                asChild
              >
                <MenuItem
                  disabled={item.disabled}
                  variant={item.variant}
                  icon={item.icon}
                  active={item.active}
                  className={item.className}
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
