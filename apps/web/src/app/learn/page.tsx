"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { StudioCatalogView } from "@/components/studio/StudioCatalogView";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { usePublicCatalog } from "@/hooks/usePublicCatalog";
import { buildPublicRoadmapUrl } from "@/lib/urls";

/**
 * /learn — the anonymous public learning catalog (LSI-029).
 *
 * A guest-readable surface: it renders the published snapshot catalog through
 * `usePublicCatalog`, whose only network dependency is the anonymous
 * `GET /api/v1/public/roadmaps` endpoint. It deliberately fetches no private
 * workspace, curriculum, or progress data, and the header drops the signed-in
 * Studio navigation so no private destination is presented to a guest.
 *
 * Opening a card navigates to the canonical public roadmap URL
 * (`/learn/{slug}`), whose guest course/lesson surfaces arrive in LSI-030.
 */
export default function PublicCatalogPage() {
  const router = useRouter();
  const catalog = usePublicCatalog();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <StudioHeader activeNav="browse" showNav={false} />
      <main className="flex-1 overflow-y-auto">
        <StudioCatalogView
          items={catalog.items}
          total={catalog.total}
          page={catalog.page}
          pageCount={catalog.pageCount}
          query={catalog.query}
          category={catalog.category}
          level={catalog.level}
          categories={catalog.categories}
          isLoading={catalog.isLoading}
          error={catalog.error}
          onQueryChange={catalog.setQuery}
          onCategoryChange={catalog.setCategory}
          onLevelChange={catalog.setLevel}
          onPageChange={catalog.setPage}
          onRetry={catalog.retry}
          onResetFilters={catalog.resetFilters}
          onOpen={(slug) => router.push(buildPublicRoadmapUrl(slug))}
        />
      </main>
    </div>
  );
}
