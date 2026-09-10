import type React from "react";
import { cn } from "@/lib/utils";
import { Surface } from "./surface";

export interface InlineFeedbackProps {
  tone: "info" | "success" | "warning" | "destructive";
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const feedbackToneClasses = {
  info: "border-info bg-info-bg",
  success: "border-success bg-success-bg",
  warning: "border-warning bg-warning-bg",
  destructive: "border-destructive bg-destructive-bg",
};

export function InlineFeedback({ tone, title, children, action, className }: InlineFeedbackProps) {
  return (
    <Surface
      role={tone === "warning" || tone === "destructive" ? "alert" : "status"}
      variant="base"
      radius="widget"
      className={cn("flex items-start gap-3 p-3 text-sm", feedbackToneClasses[tone], className)}
    >
      <div className="min-w-0 flex-1">
        {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
        <div className={cn("text-sm text-foreground-muted", title && "mt-0.5")}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </Surface>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Surface variant="base" radius="card" className={cn("flex flex-col items-center p-6 text-center", className)}>
      {icon ? <div className="mb-3 text-foreground-muted">{icon}</div> : null}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-foreground-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Surface>
  );
}
