"use client";

import React, { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { StudioHeader } from "@/components/studio/StudioHeader";
import {
  PublicCourseView,
  type PublicCourseMode,
} from "@/components/studio/PublicCourseView";
import { usePublicRoadmap } from "@/hooks/usePublicSnapshot";
import { firstParam } from "@/lib/routeParams";
import { buildLoginUrl, buildPublicLessonUrl } from "@/lib/urls";

/**
 * /learn/{slug} — read-only guest course surface (LSI-030).
 *
 * Renders one published public snapshot as an ordered List or the reused spatial
 * Canvas. Both modes project the same stable public topic ids; the page reads
 * only the anonymous LSI-027 snapshot endpoint and never touches private
 * workspace, curriculum, or canvas-layout data. The single private affordance,
 * saving the roadmap, routes a guest to sign-in instead of mutating anything.
 */
export default function PublicCoursePage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ slug: string }>();
  const slug = firstParam(params?.slug);
  const [mode, setMode] = useState<PublicCourseMode>("list");
  const { data, isLoading, notFound, error, retry } = usePublicRoadmap(slug);

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
        />
      </main>
    </div>
  );
}
