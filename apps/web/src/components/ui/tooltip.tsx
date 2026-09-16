"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = ({ delayDuration: _delayDuration, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider> & { delayDuration?: number }) => <TooltipPrimitive.Provider {...props} />;
const Tooltip = TooltipPrimitive.Root;
function TooltipTrigger({ asChild, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger> & { asChild?: boolean }) {
  return asChild
    ? <TooltipPrimitive.Trigger {...props} render={children as React.ReactElement} />
    : <TooltipPrimitive.Trigger {...props}>{children}</TooltipPrimitive.Trigger>;
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Popup> & { sideOffset?: number }
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner sideOffset={sideOffset}>
      <TooltipPrimitive.Popup ref={ref} className={cn("z-dropdown rounded-lg bg-foreground px-2 py-1 text-xs text-background shadow-md transition-opacity data-open:opacity-100 motion-reduce:transition-none", className)} {...props} role="tooltip" />
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
