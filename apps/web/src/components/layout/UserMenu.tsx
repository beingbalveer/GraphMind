"use client";

import React from "react";
import Link from "next/link";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

interface UserMenuProps {
  collapsed?: boolean;
  placement?: "top" | "bottom";
  className?: string;
  onOpenSettings?: () => void;
}

export function UserMenu({ collapsed = false, placement = "bottom", className, onOpenSettings }: UserMenuProps) {
  const { user, logout } = useAuth();

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
    <div className={`relative shrink-0 ${className ?? "w-full"}`}>
      <DropdownMenu
        side={placement === "top" ? (collapsed ? "right" : "top") : "bottom"}
        align={placement === "top" && !collapsed ? "left" : "right"}
        sideOffset={8}
        className="w-64"
        header={
          <div className="flex items-center gap-2.5 border-b border-border-subtle px-3 py-2">
            <UserIcon className="size-4 shrink-0 text-foreground-muted" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{user.fullName || "User"}</p>
              <p className="truncate text-xs text-foreground-muted">{user.email}</p>
            </div>
          </div>
        }
        items={[
          {
            label: "Settings",
            icon: <Settings className="size-4" />,
            onClick: () => onOpenSettings?.(),
          },
          {
            label: "Sign Out",
            icon: <LogOut className="size-4" />,
            onClick: () => { void logout(); },
          },
        ]}
        trigger={
          <Button
            variant="ghost"
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
              <span className="truncate block text-foreground font-medium">
                {user.fullName || user.email}
              </span>
            </div>
          </Button>
        }
      />
    </div>
  );
}
