import React from "react";
import { cn } from "@/lib/utils";

export type MenuCardProps = React.HTMLAttributes<HTMLDivElement>;

export function MenuCard({ className, children, ...props }: MenuCardProps) {
  return (
    <div
      className={cn(
        "rounded-[20px] bg-white border border-zinc-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-1.5 text-zinc-950 flex flex-col space-y-0.5",
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

export function MenuItem({
  icon,
  active,
  trailing,
  variant = "default",
  className,
  children,
  ...props
}: MenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center justify-between rounded-xl px-3 py-2 text-[13px] font-normal outline-none transition-colors group text-left",
        variant === "destructive"
          ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100"
          : active
          ? "bg-indigo-50/70 text-indigo-600 font-medium"
          : "text-zinc-800 hover:bg-zinc-100/90 hover:text-zinc-950 active:bg-zinc-200/70",
        props.disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="h-4 w-4 flex items-center justify-center shrink-0 text-zinc-700 group-hover:text-zinc-950">
            {icon}
          </span>
        )}
        <span className="truncate">{children}</span>
      </div>
      {trailing && <div className="shrink-0 ml-2 flex items-center">{trailing}</div>}
    </button>
  );
}

export type MenuHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function MenuHeader({ className, children, ...props }: MenuHeaderProps) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider select-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
