import React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@/lib/utils";

export interface ActionButtonProps extends ButtonPrimitive.Props {
  className?: string;
  children?: React.ReactNode;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton({ className, children, ...props }, ref) {
    return (
      <ButtonPrimitive
        ref={ref}
        {...props}
        className={cn(
          "inline-flex items-center justify-center box-border h-8 w-auto min-w-16 px-2.5 py-0 gap-1 rounded-lg border-0 bg-[#1a1a19] text-white text-sm font-semibold leading-[18px] whitespace-nowrap cursor-pointer select-none transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#2a2a29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
          className
        )}
      >
        {children}
      </ButtonPrimitive>
    );
  }
);

ActionButton.displayName = "ActionButton";
