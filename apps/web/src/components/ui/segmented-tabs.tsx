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
      className={`inline-flex p-1 bg-zinc-100/80 rounded-xl border border-zinc-200/60 ${className}`}
    >
      {items.map((item) => {
        const isSelected = value === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex items-center justify-center space-x-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
            } ${
              isSelected
                ? "bg-white text-zinc-950 shadow-xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {Icon && (
              <Icon
                className={`w-3.5 h-3.5 ${
                  isSelected ? "text-zinc-900" : "text-zinc-400"
                }`}
              />
            )}
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={`ml-1 text-[10px] px-1 py-0.2 rounded-md ${
                  isSelected
                    ? "bg-blue-100/80 text-blue-700 font-semibold"
                    : "bg-zinc-200/80 text-zinc-600"
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
