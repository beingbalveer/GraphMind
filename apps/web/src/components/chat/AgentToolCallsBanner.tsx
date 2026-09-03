"use client";

import React, { useState } from "react";
import {
  Search,
  GitBranch,
  PlusCircle,
  Globe,
  Calculator,
  Terminal,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ToolCallItem } from "@/hooks/useChatStream";

interface AgentToolCallsBannerProps {
  toolCalls?: ToolCallItem[];
}

function getToolIcon(name: string) {
  switch (name) {
    case "search_graph":
      return <Search className="w-3.5 h-3.5 text-blue-600" />;
    case "traverse_lineage":
      return <GitBranch className="w-3.5 h-3.5 text-purple-600" />;
    case "create_subnode":
      return <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />;
    case "fetch_url":
      return <Globe className="w-3.5 h-3.5 text-cyan-600" />;
    case "calculator":
      return <Calculator className="w-3.5 h-3.5 text-amber-600" />;
    default:
      return <Terminal className="w-3.5 h-3.5 text-zinc-600" />;
  }
}

function formatToolTitle(name: string): string {
  switch (name) {
    case "search_graph":
      return "Search Workspace Graph";
    case "traverse_lineage":
      return "Traverse Conversation Lineage";
    case "create_subnode":
      return "Create Knowledge Sub-node";
    case "fetch_url":
      return "Fetch Web Documentation";
    case "calculator":
      return "Evaluate Expression";
    default:
      return name;
  }
}

export function AgentToolCallsBanner({ toolCalls }: AgentToolCallsBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  const hasRunning = toolCalls.some((tc) => tc.status === "running");
  const runningTool = toolCalls.find((tc) => tc.status === "running");

  return (
    <div className="mb-3 rounded-xl border border-zinc-200/90 bg-zinc-50/70 overflow-hidden text-xs shadow-2xs transition-all">
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-100/70 transition-colors cursor-pointer"
      >
        <div className="flex items-center space-x-2 min-w-0">
          {hasRunning ? (
            <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          )}

          <span className="font-medium text-zinc-800 truncate">
            {hasRunning && runningTool
              ? `Agent running: ${formatToolTitle(runningTool.name)}...`
              : `Executed ${toolCalls.length} agent action${toolCalls.length > 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 text-zinc-400 text-[11px]">
          <span>{isExpanded ? "Hide" : "Details"}</span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </button>

      {/* Expanded tool details */}
      {isExpanded && (
        <div className="border-t border-zinc-200/80 px-3 py-2 space-y-2 bg-white/60">
          {toolCalls.map((tc, idx) => {
            const isErr = tc.status === "error" || tc.isError;
            const isRun = tc.status === "running";

            return (
              <div
                key={tc.id || idx}
                className="p-2 rounded-lg bg-zinc-50 border border-zinc-200/60 flex flex-col space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getToolIcon(tc.name)}
                    <span className="font-semibold text-zinc-900 font-mono text-[11.5px]">
                      {tc.name}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      isRun
                        ? "bg-amber-100 text-amber-800"
                        : isErr
                        ? "bg-rose-100 text-rose-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isRun ? "running..." : isErr ? "failed" : "completed"}
                  </span>
                </div>

                {/* Arguments */}
                {tc.arguments && Object.keys(tc.arguments).length > 0 && (
                  <div className="text-[11px] text-zinc-600 font-mono bg-zinc-100/80 px-2 py-1 rounded">
                    {JSON.stringify(tc.arguments)}
                  </div>
                )}

                {/* Result snippet */}
                {tc.result && (
                  <div className="text-[11px] text-zinc-500 font-mono bg-white px-2 py-1 rounded border border-zinc-200/50 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {tc.result}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
