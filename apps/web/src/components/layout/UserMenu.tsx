"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

interface UserMenuProps {
  collapsed?: boolean;
  placement?: "top" | "bottom";
  className?: string;
  onOpenSettings?: () => void;
}

export function UserMenu({ collapsed = false, placement = "bottom", className, onOpenSettings }: UserMenuProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (placement === "top") {
      if (collapsed) {
        setCoords({
          top: Math.max(8, rect.bottom - 110),
          left: rect.right + 8,
        });
      } else {
        setCoords({
          top: Math.max(8, rect.top - 8),
          left: rect.left,
        });
      }
    } else {
      setCoords({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - 224),
      });
    }
  }, [placement, collapsed]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!user) {
    return (
      <Link
        href="/login"
        className={`${className ?? "w-full"} h-9 flex items-center gap-2 rounded-lg text-sm font-normal text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer group`}
        title="Sign In"
      >
        <div className="size-8 rounded-lg flex items-center justify-center shrink-0">
          <UserIcon className="w-4 h-4" />
        </div>
        <div className={`flex-1 min-w-0 pr-2 transition-opacity duration-150 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <span className="truncate block">Sign In</span>
        </div>
      </Link>
    );
  }

  return (
    <div className={`relative shrink-0 ${className ?? "w-full"}`} ref={triggerRef}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-full justify-start items-center gap-2 rounded-lg text-sm font-normal text-foreground hover:bg-surface-hover transition-colors cursor-pointer group shadow-none px-0"
        title={user.fullName || user.email}
        aria-label="User profile menu"
      >
        <div className="size-8 rounded-lg flex items-center justify-center shrink-0">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.fullName || user.email}
              className="w-6 h-6 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <div className="w-6 h-6 flex items-center justify-center text-foreground">
              <UserIcon className="size-3.5" />
            </div>
          )}
        </div>
        <div className={`flex-1 min-w-0 text-left pr-2 transition-opacity duration-150 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <span className="truncate block text-foreground font-normal">
            {user.fullName || user.email}
          </span>
        </div>
      </Button>

      {isOpen && mounted && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          className={`z-50 w-60 rounded-xl border border-border bg-surface py-2 shadow-none animate-in fade-in zoom-in-95 ${
            placement === "top" && !collapsed ? "-translate-y-full" : ""
          }`}
        >
          <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3">
            <UserIcon className="size-4 shrink-0 text-foreground-muted" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.fullName || "User"}
              </p>
              <p className="truncate text-xs text-foreground-muted">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setIsOpen(false);
              onOpenSettings?.();
            }}
            className="h-10 w-full justify-start items-center gap-2 px-4 text-sm font-normal text-foreground hover:bg-surface-hover transition cursor-pointer shadow-none"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              setIsOpen(false);
              await logout();
            }}
            className="h-10 w-full justify-start items-center gap-2 px-4 text-sm font-normal text-destructive hover:bg-destructive-bg hover:text-destructive transition cursor-pointer shadow-none"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>,
        document.body
      )}
    </div>
  );
}
