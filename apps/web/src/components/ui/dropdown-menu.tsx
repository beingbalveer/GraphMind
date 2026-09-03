"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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

interface DropdownMenuProps {
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
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number }>({
    top: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const top = rect.bottom + 4;
      if (align === "right") {
        setCoords({
          top,
          right: Math.max(8, window.innerWidth - rect.right),
        });
      } else {
        setCoords({
          top,
          left: Math.max(8, rect.left),
        });
      }
    }
  }, [align]);

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      updatePosition();
      setIsOpen((prev) => !prev);
    },
    [updatePosition]
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    const handleScrollOrResize = () => {
      close();
    };

    document.addEventListener("pointerdown", handleClickOutside, { capture: true });
    document.addEventListener("mousedown", handleClickOutside, { capture: true });
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside, { capture: true });
      document.removeEventListener("mousedown", handleClickOutside, { capture: true });
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, close]);

  const menuContent = isOpen && mounted ? (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        ...(coords.right !== undefined ? { right: `${coords.right}px` } : {}),
        ...(coords.left !== undefined ? { left: `${coords.left}px` } : {}),
      }}
      className="z-[9999]"
      onClick={(e) => e.stopPropagation()}
    >
      <MenuCard className={cn("min-w-[150px] animate-in fade-in-0 zoom-in-95 duration-100", className)}>
        {items.map((item, index) => (
          <MenuItem
            key={index}
            disabled={item.disabled}
            variant={item.variant}
            icon={item.icon}
            onClick={(e) => {
              e.stopPropagation();
              close();
              item.onClick(e);
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </MenuCard>
    </div>
  ) : null;

  return (
    <div className="relative inline-flex items-center" ref={triggerRef}>
      <div onClick={toggle} className="cursor-pointer flex items-center justify-center">
        {trigger}
      </div>
      {mounted && menuContent ? createPortal(menuContent, document.body) : null}
    </div>
  );
}

