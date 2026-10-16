"use client";

import React, { useMemo, useRef } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { PublicLessonReader } from "@/components/studio/PublicLessonReader";
import { useAuth } from "@/context/AuthContext";
import { usePublicLesson, usePublicRoadmap } from "@/hooks/usePublicSnapshot";
import { storePendingIntent } from "@/lib/authIntent";
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
  const { isAuthenticated } = useAuth();
  const mainRef = useRef<HTMLElement | null>(null);

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

  /**
   * The gated "track progress / ask the tutor" action. Store a sign-in intent
   * carrying the public snapshot/topic identity plus the guest's current reading
   * position (public identities only) so the resume can save the private copy,
   * map the topic, and restore the reading position. A guest routes to sign-in;
   * a learner already signed in stores the intent and the resumer acts on it.
   */
  const handleRequireSignIn = () => {
    const lesson = lessonState.data;
    const roadmap = roadmapState.data;
    if (lesson && roadmap) {
      const el = mainRef.current;
      const maxScroll = el ? el.scrollHeight - el.clientHeight : 0;
      const readingRatio =
        el && maxScroll > 0 ? Math.min(1, Math.max(0, el.scrollTop / maxScroll)) : null;
      storePendingIntent({
        kind: "signin",
        templateId: roadmap.id,
        slug,
        snapshotVersion: roadmap.snapshotVersion,
        topicSlug: lesson.topicSlug,
        topicId: lesson.topicId,
        readingRatio,
      });
    }
    if (!isAuthenticated) {
      router.push(buildLoginUrl(pathname));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <StudioHeader activeNav="browse" showNav={false} />
      <main ref={mainRef} className="flex-1 overflow-y-auto">
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
          onRequireSignIn={handleRequireSignIn}
        />
      </main>
    </div>
  );
}
