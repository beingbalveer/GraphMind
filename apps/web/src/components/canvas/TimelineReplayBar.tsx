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
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-zinc-200/80 rounded-2xl px-5 py-3 shadow-lg select-none flex items-center space-x-3 text-xs text-zinc-600 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <History className="w-4 h-4 text-purple-600" />
        <span>No historical events recorded for this workspace yet.</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-zinc-950 rounded-lg hover:bg-zinc-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-2xl bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-2xl p-3 sm:p-4 shadow-xl select-none animate-in fade-in slide-in-from-bottom-3 duration-200 space-y-3">
      {/* Top Header: Current Event info & Live Stats */}
      <div className="flex items-center justify-between text-xs gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
            {currentEvent?.eventType === "branch_created" ? (
              <GitBranch className="w-3.5 h-3.5" />
            ) : currentEvent?.eventType === "concept_mastered" ? (
              <Sparkles className="w-3.5 h-3.5" />
            ) : (
              <History className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900 truncate">
              {currentEvent?.title || "Replaying Evolution"}
            </p>
            <div className="flex items-center space-x-2 text-[10.5px] text-zinc-500">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-zinc-400" />
                <span>{formattedDate}</span>
              </span>
              <span>•</span>
              <span>
                Event {currentEventIndex + 1} of {totalEvents}
              </span>
            </div>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-mono text-[10.5px]">
            <span>Nodes:</span>
            <span className="font-bold text-zinc-950">
              {visibleNodeCount}/{totalNodeCount}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-mono text-[10.5px]">
            <span>Mastered:</span>
            <span className="font-bold">
              {masteredConceptCount}/{totalConceptCount}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Exit Timeline Replay"
          >
            <X className="w-4 h-4" />
          </button>
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
          className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-purple-600 focus:outline-none"
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
                    ? "bg-purple-600 border-white shadow-2xs"
                    : "bg-zinc-300 border-zinc-100"
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
          <button
            type="button"
            onClick={() => onSelectEventIndex(0)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Jump to Start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handlePrevMilestone}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Previous Milestone"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all shadow-xs cursor-pointer"
            title={isPlaying ? "Pause" : "Play Replay"}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-white" />
                <span className="text-[11px]">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span className="text-[11px]">Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleNextMilestone}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Next Milestone"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Speed controls */}
        <div className="flex items-center space-x-1 bg-zinc-100/90 p-1 rounded-xl">
          {[1, 2, 5].map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => onSpeedChange(spd)}
              className={`px-2 py-0.5 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer ${
                playbackSpeed === spd
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
