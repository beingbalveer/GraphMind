import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageSquare, User } from "lucide-react";

export interface PromptNodeData {
  label?: string;
  prompt: string;
  createdAt?: string;
}

export const PromptNode = memo(({ data, selected }: NodeProps) => {
  const promptData = data as unknown as PromptNodeData;

  return (
    <div
      className={`w-72 rounded-xl bg-white border transition-all shadow-md overflow-hidden ${
        selected ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-sky-500 !border-2 !border-white"
      />

      <div className="bg-sky-50 border-b border-sky-100 px-3.5 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <User className="w-3.5 h-3.5 text-sky-600" />
          <span className="text-xs font-semibold text-sky-800">
            {promptData.label || "Prompt Node"}
          </span>
        </div>
        <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
      </div>

      <div className="p-3.5 text-xs text-slate-800 font-medium leading-relaxed">
        {promptData.prompt}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-sky-500 !border-2 !border-white"
      />
    </div>
  );
});

PromptNode.displayName = "PromptNode";
