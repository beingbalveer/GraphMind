"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
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
}

export function SegmentedTabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: SegmentedTabsProps<T>) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={(next) => onChange(next as T)}>
      <TabsPrimitive.List className={cn("inline-flex rounded-xl border border-border bg-muted p-1", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <TabsPrimitive.Trigger
            key={item.id}
            value={item.id}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium text-foreground-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 hover:text-foreground motion-reduce:transition-none data-[state=active]:bg-surface data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-xs",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{item.label}</span>
            {item.badge && <Badge variant="secondary">{item.badge}</Badge>}
          </TabsPrimitive.Trigger>
        );
      })}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
