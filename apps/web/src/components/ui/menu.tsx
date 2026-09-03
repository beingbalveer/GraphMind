import React from "react";
import { cn } from "@/lib/utils";

export type MenuCardProps = React.HTMLAttributes<HTMLDivElement>;

export function MenuCard({ className, children, ...props }: MenuCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white border border-zinc-200/60 shadow-[0_6px_30px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)] p-1.5 text-zinc-950 flex flex-col space-y-0.5",
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
        "relative flex w-full cursor-pointer select-none items-center justify-between rounded-xl px-3.5 py-2 text-[13.5px] font-normal outline-none transition-colors group text-left",
        variant === "destructive"
          ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100"
          : active
          ? "bg-zinc-100 text-zinc-950 font-medium"
          : "text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200/70",
        props.disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (
          <span className="h-[18px] w-[18px] flex items-center justify-center shrink-0 text-zinc-800 group-hover:text-zinc-950 [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:stroke-[1.75]">
            {icon}
          </span>
        )}
        <span className="truncate">{children}</span>
      </div>
      {trailing && <div className="shrink-0 ml-3 flex items-center">{trailing}</div>}
    </button>
  );
}

export type MenuHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function MenuHeader({ className, children, ...props }: MenuHeaderProps) {
  return (
    <div
      className={cn(
        "px-4 pt-2 pb-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider select-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
