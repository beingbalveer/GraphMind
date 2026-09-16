import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export type MenuCardProps = React.HTMLAttributes<HTMLDivElement>;

export function MenuCard({ className, children, ...props }: MenuCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-2xl border border-border bg-surface p-1.5 text-foreground shadow-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  trailing?: React.ReactNode;
  variant?: "default" | "destructive";
}

export const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  ({ icon, active, trailing, variant = "default", className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        type="button"
        variant={variant === "destructive" ? "destructive" : "ghost"}
        size="default"
        className={cn(
          "group relative flex h-9 w-full cursor-pointer select-none justify-between rounded-lg px-3 py-2 text-left text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          active && "bg-surface-hover font-medium text-foreground",
          className
        )}
        {...props}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="flex size-4 shrink-0 items-center justify-center text-foreground-muted group-hover:text-foreground [&>svg]:size-4">
              {icon}
            </span>
          )}
          <span className="truncate">{children}</span>
        </div>
        {trailing && <div className="ml-3 flex shrink-0 items-center">{trailing}</div>}
      </Button>
    );
  }
);
MenuItem.displayName = "MenuItem";

export type MenuHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function MenuHeader({ className, children, ...props }: MenuHeaderProps) {
  return (
    <div
      className={cn(
        "select-none px-4 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-foreground-muted",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
