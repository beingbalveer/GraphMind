"use client";

import React from "react";

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
      className={`flex flex-col sm:flex-row sm:items-${
        align === "top" ? "start" : "center"
      } justify-between gap-3 py-3.5 border-b border-border-subtle last:border-0 ${
        disabled ? "opacity-60" : ""
      } ${className}`}
    >
      <div className="space-y-0.5 max-w-sm sm:pr-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-foreground leading-tight block">
            {label}
          </label>
          {badge && (
            <span className="text-2xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-foreground-muted leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center justify-start sm:justify-end min-w-[180px]">
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
    <div className={`space-y-2.5 ${className}`}>
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
      <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-2xs divide-y divide-border-subtle">
        {children}
      </div>
    </div>
  );
}
