"use client";

import React, { useState, useRef, useEffect } from "react";
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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
    if (collapsed) {
      return (
        <Link
          href="/login"
          className="size-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition cursor-pointer"
          title="Sign In"
        >
          <UserIcon className="w-4 h-4" />
        </Link>
      );
    }
    return (
      <Link
        href="/login"
        className="h-8.5 w-full flex items-center gap-2.5 px-2.5 rounded-lg text-sm font-normal text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
      >
        <UserIcon className="w-4 h-4 shrink-0" />
        <span className="truncate">Sign In</span>
      </Link>
    );
  }

  const initial = (user.fullName?.[0] || user.email[0] || "U").toUpperCase();

  const popoverPosition =
    placement === "top"
      ? collapsed
        ? "absolute left-full bottom-0 ml-2 w-56"
        : "absolute bottom-full left-0 mb-2 w-56"
      : "absolute right-0 mt-2 w-56";

  return (
    <div className={`relative shrink-0 ${collapsed ? "flex justify-center" : "w-full"}`} ref={menuRef}>
      {collapsed ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="size-8 rounded-lg flex items-center justify-center hover:bg-surface-hover transition cursor-pointer"
          title={user.fullName || user.email}
          aria-label="User profile menu"
        >
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
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8.5 w-full flex items-center gap-2.5 px-2.5 rounded-lg text-sm font-normal text-foreground hover:bg-surface-hover transition-colors cursor-pointer group"
          title={user.fullName || user.email}
          aria-label="User profile menu"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.fullName || user.email}
              className="w-5.5 h-5.5 rounded-full object-cover ring-1 ring-border shrink-0"
            />
          ) : (
            <div className="w-5.5 h-5.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xs font-semibold shrink-0 shadow-2xs">
              {initial}
            </div>
          )}
          <span className="flex-1 text-left truncate text-foreground font-normal">
            {user.fullName || user.email}
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className={`${popoverPosition} bg-surface rounded-2xl shadow-lg border border-border py-1.5 z-50 animate-in fade-in zoom-in-95`}
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
        </div>
      )}
    </div>
  );
}
