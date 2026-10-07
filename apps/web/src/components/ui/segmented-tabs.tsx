"use client";

import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";

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
  variant?: "segmented" | "pills";
  ariaLabel?: string;
}

export function SegmentedTabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
  size = "md",
  variant = "segmented",
  ariaLabel,
}: SegmentedTabsProps<T>) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
      <TabsList
        aria-label={ariaLabel}
        className={cn(
          "max-w-full gap-1 rounded-lg border border-border-subtle bg-muted p-0.5 group-data-[orientation=horizontal]/tabs:h-auto",
          variant === "pills" && "border-0 bg-transparent p-0",
          className
        )}
      >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className={cn(
              "inline-flex shrink-0 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-0 font-medium text-foreground-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring hover:bg-surface-hover hover:text-foreground motion-reduce:transition-none data-active:bg-surface data-active:text-foreground",
              size === "sm" ? "h-6 text-xs" : "h-7 text-sm",
              variant === "pills" && "h-8 text-sm text-foreground-subtle data-active:bg-surface-hover"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{item.label}</span>
            {item.badge && <Badge variant="secondary">{item.badge}</Badge>}
          </TabsTrigger>
        );
      })}
      </TabsList>
    </Tabs>
  );
}
