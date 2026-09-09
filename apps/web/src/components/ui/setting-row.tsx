"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Surface } from "./surface";

interface SettingRowProps {
  label: string;
  description?: string;
  badge?: string;
  children: React.ReactNode;
  align?: "center" | "top";
  disabled?: boolean;
  className?: string;
}

export function SettingRow({
  label,
  description,
  badge,
  children,
  align = "center",
  disabled = false,
  className = "",
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 border-b border-border-subtle py-3.5 last:border-0 sm:flex-row",
        align === "top" ? "sm:items-start" : "sm:items-center",
        disabled && "opacity-60",
        className
      )}
    >
      <div className="space-y-0.5 max-w-sm sm:pr-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-foreground leading-tight block">
            {label}
          </label>
          {badge && (
            <Badge variant="warning">{badge}</Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-foreground-muted leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-start sm:justify-end">
        {children}
      </div>
    </div>
  );
}

interface SettingSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingSection({
  title,
  description,
  children,
  className = "",
}: SettingSectionProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <div>
        <h3 className="text-xs font-semibold text-foreground tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Surface variant="base" radius="widget" className="divide-y divide-border-subtle p-4">
        {children}
      </Surface>
    </div>
  );
}
