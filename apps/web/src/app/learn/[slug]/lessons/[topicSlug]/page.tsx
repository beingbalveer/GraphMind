"use client";

import React, { useMemo } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { PublicLessonReader } from "@/components/studio/PublicLessonReader";
import { usePublicLesson, usePublicRoadmap } from "@/hooks/usePublicSnapshot";
import { publicTopicSequence } from "@/lib/publicCurriculum";
import { firstParam } from "@/lib/routeParams";
import { buildLoginUrl, buildPublicLessonUrl, buildPublicRoadmapUrl } from "@/lib/urls";

/**
 * /learn/{slug}/lessons/{topicSlug} — read-only guest lesson reader (LSI-030).
 *
 * Fetches the published lesson and its published roadmap (for the phase label
 * and previous/next navigation) exclusively through the anonymous LSI-027
 * endpoints. No private progress, tutoring, or layout call is made; the gated
 * "track progress / ask the tutor" action routes a guest to sign-in.
 */
export default function PublicLessonPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ slug: string; topicSlug: string }>();
  const slug = firstParam(params?.slug);
  const topicSlug = firstParam(params?.topicSlug);

  const lessonState = usePublicLesson(slug, topicSlug);
  const roadmapState = usePublicRoadmap(slug);

  const sequence = useMemo(
    () => (roadmapState.data ? publicTopicSequence(roadmapState.data) : []),
    [roadmapState.data],
  );
  const requestedRef = lessonState.data?.topicSlug ?? topicSlug;
  const currentIndex = sequence.findIndex(
    (entry) =>
      entry.topic.slug === requestedRef || entry.topic.id === requestedRef,
  );
  const current = currentIndex >= 0 ? sequence[currentIndex] : null;
  const prev =
    currentIndex > 0 ? sequence[currentIndex - 1].topic : null;
  const next =
    currentIndex >= 0 && currentIndex < sequence.length - 1
      ? sequence[currentIndex + 1].topic
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <StudioHeader activeNav="browse" showNav={false} />
      <main className="flex-1 overflow-y-auto">
        <PublicLessonReader
          lesson={lessonState.data}
          isLoading={lessonState.isLoading}
          notFound={lessonState.notFound}
          error={lessonState.error}
          onRetry={lessonState.retry}
          roadmapTitle={roadmapState.data?.title ?? null}
          phaseTitle={current?.phaseTitle ?? null}
          lessonIndex={currentIndex >= 0 ? currentIndex : 0}
          totalLessons={sequence.length || 1}
          onBack={() => router.push(buildPublicRoadmapUrl(slug))}
          onOpenTopic={(nextSlug) =>
            router.push(buildPublicLessonUrl(slug, nextSlug))
          }
          prev={prev ? { slug: prev.slug, title: prev.title } : null}
          next={next ? { slug: next.slug, title: next.title } : null}
          onRequireSignIn={() => router.push(buildLoginUrl(pathname))}
        />
      </main>
    </div>
  );
}
