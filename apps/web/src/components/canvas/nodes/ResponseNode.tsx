import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Sparkles, GitBranch, Copy } from "lucide-react";

export interface ResponseNodeData {
  label?: string;
  title?: string;
  content: string;
  model?: string;
  createdAt?: string;
}

export const ResponseNode = memo(({ data, selected }: NodeProps) => {
  const responseData = data as unknown as ResponseNodeData;

  return (
    <div
      className={`w-96 rounded-xl bg-white border transition-all shadow-lg overflow-hidden ${
        selected ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />

      {/* Card Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center text-white">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-emerald-900">
            {responseData.title || "AI Response"}
          </span>
        </div>
        {responseData.model && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono font-medium">
            {responseData.model}
          </span>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
        {responseData.content}
      </div>

      {/* Card Footer Actions */}
      <div className="bg-slate-50 border-t border-slate-100 px-3.5 py-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className="text-slate-400">Select text to branch</span>
        <div className="flex items-center space-x-2">
          <button
            title="Copy content"
            className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            title="Branch from node"
            className="px-2 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors flex items-center space-x-1"
          >
            <GitBranch className="w-3 h-3" />
            <span>Branch</span>
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />
    </div>
  );
});

ResponseNode.displayName = "ResponseNode";
