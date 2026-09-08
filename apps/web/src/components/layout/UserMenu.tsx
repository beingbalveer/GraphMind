"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function UserMenu() {
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
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition"
      >
        <UserIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sign In</span>
      </Link>
    );
  }

  const initial = (user.fullName?.[0] || user.email[0] || "U").toUpperCase();

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-hover transition cursor-pointer"
        title={user.fullName || user.email}
        aria-label="User profile menu"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.fullName || user.email}
            className="w-7 h-7 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-2xs">
            {initial}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-surface rounded-2xl shadow-lg border border-border py-1.5 z-50 animate-in fade-in zoom-in-95">
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
