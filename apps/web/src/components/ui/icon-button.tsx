"use client";

import * as React from "react";
import { Button, type ButtonProps } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "aria-label"> {
  label: string;
  tooltip?: React.ReactNode;
  children: React.ReactElement;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tooltip, variant = "ghost", children, onBlur, onFocus, ...props }, ref) => {
    const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);

    const control = (
      <Button
        ref={ref}
        type="button"
        size="iconSm"
        shape="round"
        variant={variant}
        aria-label={label}
        onBlur={(event) => {
          onBlur?.(event);
          setIsTooltipOpen(false);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          setIsTooltipOpen(true);
        }}
        {...props}
      >
        {children}
      </Button>
    );

    if (!tooltip) return control;

    return (
      <TooltipProvider>
        <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
          <TooltipTrigger asChild>{control}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);
IconButton.displayName = "IconButton";
