"use client";

import React from "react";

export interface SegmentedTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface SegmentedTabsProps<T extends string = string> {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export function SegmentedTabs<T extends string = string>({
  items,
  value,
  onChange,
  className = "",
  size = "md",
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={`inline-flex p-1 bg-muted/80 rounded-xl border border-border ${className}`}
    >
      {items.map((item) => {
        const isSelected = value === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all cursor-pointer select-none ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
            } ${
              isSelected
                ? "bg-surface text-foreground shadow-xs font-semibold"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            {Icon && (
              <Icon
                className={`w-3.5 h-3.5 ${
                  isSelected ? "text-foreground" : "text-foreground-muted"
                }`}
              />
            )}
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={`ml-1 text-2xs px-1.5 py-0.5 rounded-md ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-surface text-foreground-muted border border-border"
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
