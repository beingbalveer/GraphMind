"use client";

import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

const Collapsible = CollapsiblePrimitive.Root;
function CollapsibleTrigger({ asChild, children, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Trigger> & { asChild?: boolean }) {
  return asChild ? <CollapsiblePrimitive.Trigger {...props} render={children as React.ReactElement} /> : <CollapsiblePrimitive.Trigger {...props}>{children}</CollapsiblePrimitive.Trigger>;
}
const CollapsibleContent = CollapsiblePrimitive.Panel;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
