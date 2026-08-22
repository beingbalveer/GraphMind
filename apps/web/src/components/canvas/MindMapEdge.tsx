"use client";

import React, { memo } from "react";
import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
} from "@xyflow/react";

export interface MindMapEdgeData {
  isActiveLineage?: boolean;
  highlightedContext?: string;
  isStreaming?: boolean;
}

export const MindMapEdge = memo(function MindMapEdge({
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
  const edgeData = (data || {}) as MindMapEdgeData;
  const isActive = edgeData.isActiveLineage;
  const isStreaming = edgeData.isStreaming;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isActive ? "#18181b" : "#d4d4d8",
          strokeWidth: isActive ? 2 : 1.5,
          strokeDasharray: isStreaming ? "5,5" : undefined,
          animation: isStreaming ? "dashdraw 0.6s linear infinite" : undefined,
          transition: "stroke 0.2s, stroke-width 0.2s",
        }}
      />
    </>
  );
});
