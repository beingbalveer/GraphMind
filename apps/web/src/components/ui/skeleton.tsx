import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
}

function Skeleton({ className, label, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("bg-muted animate-pulse motion-reduce:animate-none", className)}
      role="status"
      {...props}
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

export { Skeleton };
