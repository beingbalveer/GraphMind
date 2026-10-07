"use client";

import { Maximize2, Minus, Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, type DropdownMenuItemProps } from "@/components/ui/dropdown-menu";

export function CanvasControls({ onFit, onZoomIn, onZoomOut, items }: {
  onFit: () => void; onZoomIn: () => void; onZoomOut: () => void; items: DropdownMenuItemProps[];
}) {
  return <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-2xs">
    <Button variant="ghost" size="iconSm" aria-label="Zoom out" onClick={onZoomOut}><Minus /></Button>
    <Button variant="ghost" size="iconSm" aria-label="Zoom in" onClick={onZoomIn}><Plus /></Button>
    <Button variant="ghost" size="iconSm" aria-label="Fit canvas" onClick={onFit}><Maximize2 /></Button>
    <DropdownMenu trigger={<Button variant="ghost" size="iconSm" aria-label="Canvas options"><MoreHorizontal /></Button>} items={items} />
  </div>;
}
