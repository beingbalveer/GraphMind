import * as React from "react";
import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";

export interface NavigationItemProps extends ButtonProps {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  active?: boolean;
  collapsed?: boolean;
}

/** Shared 36px navigation row for workspace and conversation sidebars. */
export const NavigationItem = React.forwardRef<HTMLButtonElement, NavigationItemProps>(
  ({ icon, trailing, active = false, collapsed = false, className, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="lg"
      aria-current={active ? "page" : undefined}
      {...props}
      className={cn(
        "h-9 w-full min-w-0 justify-start gap-2.5 rounded-navigation px-2.5 text-left text-sm font-normal text-foreground",
        active && "bg-surface-hover font-medium",
        collapsed && "justify-center px-0",
        className
      )}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center text-foreground [&>svg]:size-5 [&>svg]:stroke-[1.75]"
        >
          {icon}
        </span>
      )}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{children}</span>}
      {!collapsed && trailing && <span className="shrink-0 text-xs text-foreground-muted">{trailing}</span>}
    </Button>
  )
);
NavigationItem.displayName = "NavigationItem";
