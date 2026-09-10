"use client";

import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";
import { GitBranch } from "lucide-react";

export interface CustomEdgeData {
  isActive?: boolean;
  isStreaming?: boolean;
  highlightedContext?: string | null;
  [key: string]: unknown;
}

export function CustomBranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = (data || {}) as CustomEdgeData;
  const { isActive = false, isStreaming = false, highlightedContext = null } = edgeData;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const strokeColor = isActive
    ? "var(--border-strong, currentColor)"
    : "var(--border, currentColor)";
  const strokeWidth = isActive ? 2 : 1.5;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isStreaming ? "6, 6" : undefined,
          animation: isStreaming ? "dash 1s linear infinite" : undefined,
          transition: "stroke 0.2s ease, stroke-width 0.2s ease",
        }}
      />

      {/* Excerpt Midpoint Label Badge */}
      {highlightedContext && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface/95 border border-border shadow-2xs text-2xs text-foreground font-medium max-w-[130px] truncate select-none hover:border-border-subtle transition-colors"
            title={`Branched from excerpt: "${highlightedContext}"`}
          >
            <GitBranch className="w-2.5 h-2.5 text-foreground-muted shrink-0" />
            <span className="italic truncate">&ldquo;{highlightedContext}&rdquo;</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
