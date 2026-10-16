"use client";

import React, { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { StudioHeader } from "@/components/studio/StudioHeader";
import {
  PublicCourseView,
  type PublicCourseMode,
} from "@/components/studio/PublicCourseView";
import { useAuth } from "@/context/AuthContext";
import { usePublicRoadmap } from "@/hooks/usePublicSnapshot";
import { useSaveRoadmapCopy } from "@/hooks/useSaveRoadmapCopy";
import { firstParam } from "@/lib/routeParams";
import {
  buildLoginUrl,
  buildPublicLessonUrl,
  buildWorkspaceUrl,
} from "@/lib/urls";

/**
 * /learn/{slug} — read-only guest course surface (LSI-030) with the signed-in
 * save flow (LSI-031).
 *
 * Renders one published public snapshot as an ordered List or the reused spatial
 * Canvas. Both modes project the same stable public topic ids; the page reads
 * only the anonymous LSI-027 snapshot endpoint and never touches private
 * workspace, curriculum, or canvas-layout data. A guest's only private
 * affordance, saving the roadmap, routes to sign-in; a signed-in learner instead
 * saves an independent private copy and opens it in their own workspace.
 */
export default function PublicCoursePage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ slug: string }>();
  const slug = firstParam(params?.slug);
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<PublicCourseMode>("list");
  const { data, isLoading, notFound, error, retry } = usePublicRoadmap(slug);
  const save = useSaveRoadmapCopy();

  const handleSave = () => {
    if (!data) return;
    void save.save({
      templateId: data.id,
      snapshotVersion: data.snapshotVersion,
      title: data.title,
    });
  };

  const handleOpenCopy = () => {
    if (save.enrollment) {
      router.push(buildWorkspaceUrl(save.enrollment.workspaceId));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <StudioHeader activeNav="browse" showNav={false} />
      <main className="flex-1 overflow-y-auto">
        <PublicCourseView
          roadmap={data}
          isLoading={isLoading}
          notFound={notFound}
          error={error}
          onRetry={retry}
          mode={mode}
          onModeChange={setMode}
          onOpenTopic={(topicSlug) =>
            router.push(buildPublicLessonUrl(slug, topicSlug))
          }
          onRequireSignIn={() => router.push(buildLoginUrl(pathname))}
          isAuthenticated={isAuthenticated}
          saveStatus={save.status}
          saveError={save.error}
          savedCreated={save.created}
          onSave={handleSave}
          onRetrySave={() => void save.retry()}
          onOpenSavedCopy={handleOpenCopy}
        />
      </main>
    </div>
  );
}
