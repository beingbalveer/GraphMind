"use client";

import { useState } from "react";
import { Calculator, CheckCircle2, ChevronDown, ChevronUp, GitBranch, Globe, Loader2, PlusCircle, Search, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InlineFeedback } from "@/components/ui/feedback";
import { ToolCallItem } from "@/hooks/useChatStream";

interface AgentToolCallsBannerProps { toolCalls?: ToolCallItem[]; onRetry?: () => void; }

function getToolIcon(name: string) {
  switch (name) {
    case "search_graph": return <Search className="size-3.5" />;
    case "traverse_lineage": return <GitBranch className="size-3.5" />;
    case "create_subnode": return <PlusCircle className="size-3.5" />;
    case "fetch_url": return <Globe className="size-3.5" />;
    case "calculator": return <Calculator className="size-3.5" />;
    default: return <Terminal className="size-3.5" />;
  }
}

function formatToolTitle(name: string): string {
  switch (name) {
    case "search_graph": return "Search workspace graph";
    case "traverse_lineage": return "Traverse conversation lineage";
    case "create_subnode": return "Create knowledge sub-node";
    case "fetch_url": return "Fetch web documentation";
    case "calculator": return "Evaluate expression";
    default: return name;
  }
}

export function AgentToolCallsBanner({ toolCalls, onRetry }: AgentToolCallsBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!toolCalls?.length) return null;

  const runningTool = toolCalls.find((toolCall) => toolCall.status === "running");
  const hasError = toolCalls.some((toolCall) => toolCall.status === "error" || toolCall.isError);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="mb-3 overflow-hidden rounded-xl border border-border-subtle bg-background-secondary text-xs shadow-2xs">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto w-full justify-between rounded-none px-3 py-2 text-left">
            <span className="flex min-w-0 items-center gap-2">
              {runningTool ? <Loader2 className="size-3.5 shrink-0 animate-spin text-info" /> : <CheckCircle2 className="size-3.5 shrink-0 text-success" />}
              <span className="truncate font-medium text-foreground">{runningTool ? `Activity: ${formatToolTitle(runningTool.name)}` : `Activity: ${toolCalls.length} agent action${toolCalls.length === 1 ? "" : "s"}`}</span>
            </span>
            <span className="flex items-center gap-1 text-foreground-muted"><span>{isExpanded ? "Hide" : "Details"}</span>{isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border-subtle p-3">
          <div className="space-y-2">
            {hasError && <InlineFeedback tone="destructive" title="An agent action failed" action={onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>Retry response</Button> : undefined}>Review the failed action below{onRetry ? " or retry the response." : "."}</InlineFeedback>}
            {toolCalls.map((toolCall, index) => {
              const isError = toolCall.status === "error" || toolCall.isError;
              const status = toolCall.status === "running" ? "running" : isError ? "failed" : "completed";
              const variant = toolCall.status === "running" ? "warning" : isError ? "destructive" : "success";
              return <div key={toolCall.id || index} className="space-y-1.5 rounded-lg border border-border-subtle bg-surface p-2">
                <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2 text-foreground-muted">{getToolIcon(toolCall.name)}<span className="truncate font-mono text-2xs font-semibold text-foreground">{formatToolTitle(toolCall.name)}</span></div><Badge variant={variant}>{status}</Badge></div>
                {toolCall.arguments && Object.keys(toolCall.arguments).length > 0 && <pre className="overflow-x-auto rounded-lg bg-muted px-2 py-1 text-2xs text-foreground-muted">{JSON.stringify(toolCall.arguments)}</pre>}
                {toolCall.result && <pre className="max-h-24 overflow-auto rounded-lg bg-background-secondary px-2 py-1 text-2xs text-foreground-muted whitespace-pre-wrap">{toolCall.result}</pre>}
              </div>;
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
