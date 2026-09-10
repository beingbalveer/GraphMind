import * as React from "react";
import { cn } from "@/lib/utils";

export interface WorkspaceShellProps {
  navigation: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
  rail?: React.ReactNode;
  className?: string;
}

export function WorkspaceShell({
  navigation,
  header,
  children,
  rail,
  className,
}: WorkspaceShellProps) {
  return (
    <div
      data-testid="workspace-shell"
      className={cn(
        "h-screen w-screen flex bg-background overflow-hidden select-text",
        className
      )}
    >
      {/* Left Navigation */}
      {navigation}

      {/* Center Column: Header + Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-background">
        {header}
        <div
          data-testid="workspace-main-content"
          className="flex-1 min-h-0 flex relative bg-background overflow-hidden"
        >
          {children}
        </div>
      </div>

      {/* Contextual Rail */}
      {rail}
    </div>
  );
}
