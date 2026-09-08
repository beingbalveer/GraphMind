"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface UserMenuProps {
  collapsed?: boolean;
  placement?: "top" | "bottom";
}

export function UserMenu({ collapsed = false, placement = "bottom" }: UserMenuProps) {
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
          top: Math.max(8, rect.top - 120),
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
        className="h-9 w-full flex items-center gap-2 rounded-lg text-sm font-normal text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer group"
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

  const initial = (user.fullName?.[0] || user.email[0] || "U").toUpperCase();

  return (
    <div className="relative shrink-0 w-full" ref={triggerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-full flex items-center gap-2 rounded-lg text-sm font-normal text-foreground hover:bg-surface-hover transition-colors cursor-pointer group"
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
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shadow-2xs">
              {initial}
            </div>
          )}
        </div>
        <div className={`flex-1 min-w-0 text-left pr-2 transition-opacity duration-150 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <span className="truncate block text-foreground font-normal">
            {user.fullName || user.email}
          </span>
        </div>
      </button>

      {isOpen && mounted && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          className="w-56 bg-surface rounded-2xl shadow-lg border border-border py-1.5 z-50 animate-in fade-in zoom-in-95"
        >
          <div className="px-3.5 py-2.5 border-b border-border-subtle">
            <p className="text-xs font-semibold text-foreground truncate">
              {user.fullName || "User"}
            </p>
            <p className="text-2xs text-foreground-muted truncate">{user.email}</p>
            <span className="inline-block mt-1 px-1.5 py-0.5 text-2xs font-medium bg-muted text-foreground-muted rounded-full capitalize">
              {user.provider} account
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              setIsOpen(false);
              await logout();
            }}
            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-destructive hover:bg-destructive-bg transition cursor-pointer font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
