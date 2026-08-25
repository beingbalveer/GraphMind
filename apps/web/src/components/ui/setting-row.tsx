"use client";

import React from "react";

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  align?: "center" | "top";
  className?: string;
}

export function SettingRow({
  label,
  description,
  children,
  align = "center",
  className = "",
}: SettingRowProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-${
        align === "top" ? "start" : "center"
      } justify-between gap-3 py-3 border-b border-zinc-100 last:border-0 ${className}`}
    >
      <div className="space-y-0.5 max-w-sm sm:pr-4">
        <label className="text-xs font-semibold text-zinc-900 leading-tight block">
          {label}
        </label>
        {description && (
          <p className="text-[11.5px] text-zinc-500 leading-relaxed">
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
    <div className={`space-y-3 ${className}`}>
      <div>
        <h3 className="text-xs font-semibold text-zinc-900 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-[11.5px] text-zinc-500 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="rounded-xl border border-zinc-200/70 bg-white p-3.5 shadow-2xs divide-y divide-zinc-100">
        {children}
      </div>
    </div>
  );
}
