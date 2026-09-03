"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

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
      className={cn(
        "z-[9999] min-w-[150px] rounded-[20px] bg-white p-1.5 text-zinc-950 shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-zinc-200/80 animate-in fade-in-0 zoom-in-95 duration-100 flex flex-col space-y-0.5",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => (
        <button
          key={index}
          type="button"
          disabled={item.disabled}
          onClick={(e) => {
            e.stopPropagation();
            close();
            item.onClick(e);
          }}
          className={cn(
            "relative flex w-full cursor-pointer select-none items-center rounded-xl px-3 py-2 text-[13px] font-normal outline-none transition-colors",
            item.variant === "destructive"
              ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100"
              : "text-zinc-800 hover:bg-zinc-100/90 hover:text-zinc-950 active:bg-zinc-200/70",
            item.disabled && "pointer-events-none opacity-50"
          )}
        >
          {item.icon && (
            <span className="mr-3 h-4 w-4 flex items-center justify-center shrink-0 text-zinc-700">
              {item.icon}
            </span>
          )}
          <span>{item.label}</span>
        </button>
      ))}
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

