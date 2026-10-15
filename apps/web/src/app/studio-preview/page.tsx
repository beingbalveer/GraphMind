"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  LearningStudioShell,
} from "@/components/studio/LearningStudioShell";
import {
  StudioHeader,
  StudioNavTab,
} from "@/components/studio/StudioHeader";
import {
  StudioCourseRail,
} from "@/components/studio/StudioCourseRail";
import {
  StudioTutorRail,
} from "@/components/studio/StudioTutorRail";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Gated / Internal Studio Preview Route
 * Used to verify LearningStudioShell layout, rails, responsive drawers, and semantic tokens.
 */
export default function StudioPreviewPage() {
  const [activeNav, setActiveNav] = useState<StudioNavTab>("home");
  const [inCourse, setInCourse] = useState(true);
  const [isLeftRailOpen, setIsLeftRailOpen] = useState(true);
  const [isRightRailOpen, setIsRightRailOpen] = useState(true);
  const [isRightExpanded, setIsRightExpanded] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activeTopic, setActiveTopic] = useState("FastAPI Asynchronous Architecture");

  const mockTopics = [
    { id: "1", title: "Python Async & Await Fundamentals", done: true, minutes: 25 },
    { id: "2", title: "FastAPI Asynchronous Architecture", done: false, minutes: 40 },
    { id: "3", title: "Pydantic v2 Schema Modeling", done: false, minutes: 30 },
    { id: "4", title: "SQLAlchemy 2.0 Async Session Engine", done: false, minutes: 45 },
    { id: "5", title: "PostgreSQL pgvector Embedding Search", done: false, minutes: 60 },
  ];

  const handleToggleDark = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  };

  return (
    <LearningStudioShell
      header={
        <StudioHeader
          activeNav={activeNav}
          onNavigate={setActiveNav}
          courseTitle={inCourse ? "Backend Engineering with Python" : undefined}
          isLeftRailOpen={isLeftRailOpen}
          onToggleLeftRail={() => setIsLeftRailOpen((v) => !v)}
          isRightRailOpen={isRightRailOpen}
          onToggleRightRail={() => setIsRightRailOpen((v) => !v)}
          showRails={inCourse}
          rightRailTitle="Tutor Companion"
          isDark={isDark}
          onToggleDark={handleToggleDark}
        />
      }
      showRails={inCourse}
      isLeftRailOpen={isLeftRailOpen}
      onToggleLeftRail={() => setIsLeftRailOpen((v) => !v)}
      isRightRailOpen={isRightRailOpen}
      onToggleRightRail={() => setIsRightRailOpen((v) => !v)}
      isRightRailExpanded={isRightExpanded}
      courseRail={
        <StudioCourseRail
          courseTitle="Backend Engineering with Python"
          progressPercent={20}
          onClose={() => setIsLeftRailOpen(false)}
          onNewChat={() => alert("New course conversation triggered")}
          outlineContent={
            <div className="space-y-1">
              {mockTopics.map((topic, i) => (
                <button
                  key={topic.id}
                  onClick={() => setActiveTopic(topic.title)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                    activeTopic === topic.title
                      ? "bg-surface-hover text-foreground font-medium"
                      : "text-foreground-muted hover:bg-surface-hover/60 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {topic.done ? (
                      <CheckCircle2 className="size-3.5 text-success shrink-0" />
                    ) : (
                      <Circle className="size-3.5 text-foreground-subtle shrink-0" />
                    )}
                    <span className="truncate">{`${i + 1}. ${topic.title}`}</span>
                  </div>
                  <span className="text-2xs text-foreground-subtle shrink-0">{topic.minutes}m</span>
                </button>
              ))}
            </div>
          }
          chatsContent={
            <div className="p-3 text-xs text-foreground-muted">
              Course conversations will appear here when connected to the backend.
            </div>
          }
        />
      }
      tutorRail={
        <StudioTutorRail
          topicTitle={activeTopic}
          isExpanded={isRightExpanded}
          onToggleExpand={() => setIsRightExpanded((v) => !v)}
          onClose={() => setIsRightRailOpen(false)}
          tutorContent={
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-surface-hover/60 rounded-xl border border-border-subtle">
                <div className="flex items-center gap-1.5 text-primary font-medium mb-1">
                  <Sparkles className="size-3.5" />
                  <span>AI Tutor Active</span>
                </div>
                <p className="text-foreground-muted leading-relaxed">
                  Ready to explain async request routing, event loops, or dependency injection in FastAPI.
                </p>
              </div>
            </div>
          }
          resourcesContent={
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg border border-border-subtle bg-surface">
                <div className="font-medium text-foreground">FastAPI Official Documentation</div>
                <div className="text-2xs text-foreground-muted truncate">https://fastapi.tiangolo.com/async/</div>
              </div>
            </div>
          }
        />
      }
    >
      {/* Main Center Stage */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full">
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline">Lesson 2 of 5</Badge>
                <span className="text-xs text-foreground-muted flex items-center gap-1">
                  <Clock className="size-3" /> 40 minutes
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {activeTopic}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInCourse((v) => !v)}
              >
                {inCourse ? "Preview Catalog Mode" : "Preview Course Mode"}
              </Button>
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none text-sm text-foreground-muted space-y-4 leading-relaxed">
            <p>
              FastAPI is built on top of Starlette and Pydantic, designed from the ground up to take full advantage
              of modern Python asynchronous programming (PEP 492). By writing asynchronous path operation functions
              using <code className="bg-surface-hover px-1.5 py-0.5 rounded text-foreground">async def</code>, your application can handle I/O-bound tasks concurrently without blocking the main event loop.
            </p>

            <div className="p-4 rounded-xl border border-border bg-surface">
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <FileText className="size-4 text-primary" /> Key Learning Objectives
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Understand the difference between async def and standard def in FastAPI endpoints</li>
                <li>Leverage FastAPI Dependency Injection with async context managers</li>
                <li>Integrate non-blocking SQLAlchemy 2.0 AsyncSessions without connection starvation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </LearningStudioShell>
  );
}
