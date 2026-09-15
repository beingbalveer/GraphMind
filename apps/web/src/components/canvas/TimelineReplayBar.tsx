"use client";

import React, { useMemo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  X,
  History,
  Calendar,
  Sparkles,
  GitBranch,
} from "lucide-react";
import { TimelineEvent, WorkspaceTimelineResponse } from "@graphmind/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TimelineReplayBarProps {
  timeline: WorkspaceTimelineResponse | null;
  currentEventIndex: number;
  onSelectEventIndex: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  onClose: () => void;
  visibleNodeCount: number;
  totalNodeCount: number;
  masteredConceptCount: number;
  totalConceptCount: number;
}

export function TimelineReplayBar({
  timeline,
  currentEventIndex,
  onSelectEventIndex,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange,
  onClose,
  visibleNodeCount,
  totalNodeCount,
  masteredConceptCount,
  totalConceptCount,
}: TimelineReplayBarProps) {
  const events = useMemo(() => timeline?.events || [], [timeline]);
  const totalEvents = events.length;
  const currentEvent: TimelineEvent | undefined = events[currentEventIndex];

  // Milestones with their event indexes
  const milestoneIndexes = useMemo(() => {
    const indexes: number[] = [];
    events.forEach((e, idx) => {
      if (e.isMilestone) indexes.push(idx);
    });
    return indexes;
  }, [events]);

  const handlePrevMilestone = () => {
    const prev = [...milestoneIndexes].reverse().find((idx) => idx < currentEventIndex);
    if (prev !== undefined) {
      onSelectEventIndex(prev);
    } else {
      onSelectEventIndex(0);
    }
  };

  const handleNextMilestone = () => {
    const next = milestoneIndexes.find((idx) => idx > currentEventIndex);
    if (next !== undefined) {
      onSelectEventIndex(next);
    } else if (totalEvents > 0) {
      onSelectEventIndex(totalEvents - 1);
    }
  };

  const formattedDate = useMemo(() => {
    if (!currentEvent) return "Workspace Start";
    try {
      const d = new Date(currentEvent.timestamp);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return currentEvent.timestamp;
    }
  }, [currentEvent]);

  if (totalEvents === 0) {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-surface/95 backdrop-blur-md border border-border rounded-2xl px-5 py-3 shadow-modal select-none flex items-center space-x-3 text-xs text-foreground-muted animate-in fade-in slide-in-from-bottom-3 duration-200">
        <History className="w-4 h-4 text-foreground" />
        <span>No historical events recorded for this workspace yet.</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
          title="Close replay bar"
          aria-label="Close replay bar"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-2xl bg-surface/95 backdrop-blur-md border border-border rounded-2xl p-3 sm:p-4 shadow-modal select-none animate-in fade-in slide-in-from-bottom-3 duration-200 space-y-3">
      {/* Top Header: Current Event info & Live Stats */}
      <div className="flex items-center justify-between text-xs gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-surface-hover text-foreground border border-border shrink-0">
            {currentEvent?.eventType === "branch_created" ? (
              <GitBranch className="w-3.5 h-3.5" />
            ) : currentEvent?.eventType === "concept_mastered" ? (
              <Sparkles className="w-3.5 h-3.5" />
            ) : (
              <History className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">
              {currentEvent?.title || "Replaying Evolution"}
            </p>
            <div className="flex items-center space-x-2 text-2xs text-foreground-muted">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-foreground-subtle" />
                <span>{formattedDate}</span>
              </span>
              <span>•</span>
              <span>
                Event {currentEventIndex + 1} of {totalEvents}
              </span>
            </div>
          </div>
        </div>

        {/* Live Graph Evolution Metrics */}
        <div className="flex items-center space-x-2 shrink-0">
          <Badge variant="secondary" className="font-mono text-2xs">
            <span>Nodes: {visibleNodeCount}/{totalNodeCount}</span>
          </Badge>

          <Badge variant="success" className="font-mono text-2xs hidden sm:inline-flex">
            <span>Mastered: {masteredConceptCount}/{totalConceptCount}</span>
          </Badge>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
            title="Exit Timeline Replay"
            aria-label="Exit Timeline Replay"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Scrubber Slider Track */}
      <div className="relative pt-1 pb-1">
        <input
          type="range"
          min={0}
          max={totalEvents - 1}
          value={currentEventIndex}
          onChange={(e) => onSelectEventIndex(parseInt(e.target.value, 10))}
          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
        />

        {/* Milestone Indicator Dots along track */}
        <div className="absolute top-2.5 left-0 right-0 pointer-events-none px-1">
          {milestoneIndexes.map((mIdx) => {
            const leftPct = totalEvents > 1 ? (mIdx / (totalEvents - 1)) * 100 : 0;
            const isPassed = mIdx <= currentEventIndex;
            return (
              <div
                key={mIdx}
                style={{ left: `${leftPct}%` }}
                className={`absolute -top-1 w-2 h-2 -translate-x-1/2 rounded-full border transition-colors ${
                  isPassed
                    ? "bg-primary border-surface shadow-2xs"
                    : "bg-muted-foreground/40 border-border"
                }`}
                title={events[mIdx]?.title}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Controls: Playback, Speed, Milestone Jump */}
      <div className="flex items-center justify-between pt-0.5 text-xs">
        {/* Left: Play/Pause & Milestone navigation */}
        <div className="flex items-center space-x-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onSelectEventIndex(0)}
            className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
            title="Jump to Start"
            aria-label="Jump to Start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handlePrevMilestone}
            className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
            title="Previous Milestone"
            aria-label="Previous Milestone"
          >
            <SkipBack className="w-4 h-4" />
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={onTogglePlay}
            className="h-8 px-3 text-xs font-medium gap-1.5 shadow-xs"
            title={isPlaying ? "Pause" : "Play Replay"}
            aria-label={isPlaying ? "Pause" : "Play Replay"}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span className="text-2xs">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="text-2xs">Play</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleNextMilestone}
            className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
            title="Next Milestone"
            aria-label="Next Milestone"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Right: Speed controls */}
        <div className="flex items-center space-x-1 bg-muted p-1 rounded-xl">
          {[1, 2, 5].map((spd) => (
            <Button
              key={spd}
              variant={playbackSpeed === spd ? "outline" : "ghost"}
              size="sm"
              onClick={() => onSpeedChange(spd)}
              className={`h-6 px-2 text-2xs font-semibold shadow-none ${
                playbackSpeed === spd
                  ? "bg-surface text-foreground"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {spd}x
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
