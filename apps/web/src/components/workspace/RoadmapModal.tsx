"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  Sparkles,
  Loader2,
  Check,
  GraduationCap,
  BookOpen,
  Briefcase,
  Layers,
  Hammer,
  Target,
  ArrowRight,
} from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateRoadmap } from "@/lib/roadmapApi";
import { buildWorkspaceUrl } from "@/lib/urls";

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (workspaceId: string) => void;
}

interface LevelOption {
  id: "beginner" | "intermediate" | "advanced";
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface FocusOption {
  id: "concepts" | "projects" | "interview";
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const LEVEL_OPTIONS: LevelOption[] = [
  {
    id: "beginner",
    label: "Beginner",
    description: "Bedrock syntax, foundational concepts & mental models",
    icon: GraduationCap,
  },
  {
    id: "intermediate",
    label: "Intermediate",
    description: "Practical idioms, architecture & real-world patterns",
    icon: BookOpen,
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Deep internals, performance tuning & systems design",
    icon: Briefcase,
  },
];

const FOCUS_OPTIONS: FocusOption[] = [
  {
    id: "concepts",
    label: "Core Concepts",
    description: "Theoretical depth, specifications & principle mastery",
    icon: Layers,
  },
  {
    id: "projects",
    label: "With Projects",
    description: "Hands-on apps, implementation patterns & production code",
    icon: Hammer,
  },
  {
    id: "interview",
    label: "Interview Prep",
    description: "High-frequency problem patterns, tradeoffs & Q&A",
    icon: Target,
  },
];

const SUGGESTED_GOALS = [
  { label: "Rust Systems Programming", tag: "Systems" },
  { label: "AI Agents & Tool Calling", tag: "AI & ML" },
  { label: "System Design for FAANG", tag: "Architecture" },
  { label: "FastAPI & Async Concurrency", tag: "Backend" },
  { label: "Next.js 15 & React Server Components", tag: "Frontend" },
  { label: "Distributed Consensus & Raft", tag: "Distributed" },
];

export function RoadmapModal({ isOpen, onClose, onSuccess }: RoadmapModalProps) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [focus, setFocus] = useState<"concepts" | "projects" | "interview">("concepts");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateRoadmap({
        goal: trimmedGoal,
        level,
        focus,
      });

      onClose();
      if (onSuccess) {
        onSuccess(response.workspaceId);
      } else {
        router.push(buildWorkspaceUrl(response.workspaceId));
      }
    } catch (err: any) {
      console.error("Roadmap generation failed:", err);
      setError(err?.detail || err?.message || "Failed to generate roadmap. Please try again.");
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isGenerating ? () => {} : onClose}
      size="2xl"
      className="border-border shadow-modal"
    >
      <ModalHeader
        title="Generate Learning Roadmap"
        description="Synthesize an interactive, prerequisite-ordered knowledge graph for any subject"
        icon={<Compass className="w-4 h-4 text-foreground" />}
        onClose={isGenerating ? undefined : onClose}
      />

      <form onSubmit={handleGenerate} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-6 p-6">
          {/* 1. Goal Input Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground tracking-tight">
                What do you want to master?
              </label>
              <span className="text-2xs text-foreground-muted">
                Skill, career path, or subject
              </span>
            </div>

            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Rust Systems Programming, Distributed Systems, ML Engineering..."
              startIcon={<Sparkles className="w-4 h-4 text-foreground-muted" />}
              disabled={isGenerating}
              inputSize="default"
              autoFocus
            />

            {/* Quick Suggestion Pills */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-foreground-muted mr-1 font-medium">
                Try:
              </span>
              {SUGGESTED_GOALS.map((suggested) => (
                <button
                  key={suggested.label}
                  type="button"
                  onClick={() => setGoal(suggested.label)}
                  disabled={isGenerating}
                  className="text-2xs px-2.5 py-1 rounded-lg bg-surface border border-border-subtle hover:border-foreground/30 hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-all cursor-pointer inline-flex items-center gap-1.5 select-none"
                >
                  <span>{suggested.label}</span>
                  <span className="text-2xs opacity-60 font-mono">
                    {suggested.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Learner Level Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground tracking-tight">
                Learner Expertise Level
              </label>
              <span className="text-2xs text-foreground-muted">
                Calibrates depth & prerequisites
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {LEVEL_OPTIONS.map((opt) => {
                const isSelected = level === opt.id;
                const Icon = opt.icon;
                return (
                  <div
                    key={opt.id}
                    onClick={() => !isGenerating && setLevel(opt.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 select-none relative ${
                      isSelected
                        ? "bg-surface border-foreground/40 shadow-xs ring-1 ring-foreground/20"
                        : "bg-surface/50 border-border-subtle hover:border-border hover:bg-surface-hover"
                    }`}
                  >
                    <div
                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "bg-muted text-foreground-muted border border-border-subtle"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1 pr-3">
                      <span className="text-xs font-semibold text-foreground tracking-tight block">
                        {opt.label}
                      </span>
                      <p className="text-2xs text-foreground-muted leading-relaxed mt-0.5">
                        {opt.description}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 absolute top-3 right-3 shadow-2xs">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Curriculum Focus Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground tracking-tight">
                Curriculum Focus
              </label>
              <span className="text-2xs text-foreground-muted">
                Adjusts module emphasis & exercises
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {FOCUS_OPTIONS.map((opt) => {
                const isSelected = focus === opt.id;
                const Icon = opt.icon;
                return (
                  <div
                    key={opt.id}
                    onClick={() => !isGenerating && setFocus(opt.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 select-none relative ${
                      isSelected
                        ? "bg-surface border-foreground/40 shadow-xs ring-1 ring-foreground/20"
                        : "bg-surface/50 border-border-subtle hover:border-border hover:bg-surface-hover"
                    }`}
                  >
                    <div
                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "bg-muted text-foreground-muted border border-border-subtle"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1 pr-3">
                      <span className="text-xs font-semibold text-foreground tracking-tight block">
                        {opt.label}
                      </span>
                      <p className="text-2xs text-foreground-muted leading-relaxed mt-0.5">
                        {opt.description}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 absolute top-3 right-3 shadow-2xs">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Generation In-Progress Status Card */}
          {isGenerating && (
            <div className="p-4 rounded-xl border border-border bg-background-secondary flex items-center gap-3.5 animate-in fade-in-50 duration-200">
              <div className="size-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 shadow-xs">
                <Loader2 className="w-4 h-4 text-foreground animate-spin" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Synthesizing roadmap graph...</span>
                  <span className="text-2xs font-normal text-foreground-muted">
                    (~2-4s)
                  </span>
                </div>
                <div className="text-2xs text-foreground-muted truncate mt-0.5">
                  Ordering prerequisites, key concepts, and connecting interactive canvas nodes
                </div>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-destructive shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="justify-between">
          <div className="text-2xs text-foreground-muted hidden sm:block">
            Creates a dedicated workspace with full branching capabilities
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isGenerating || !goal.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  <span>Generate Roadmap</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-70" />
                </>
              )}
            </Button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
