import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ChevronRight, Clock3, Search } from "lucide-react";
import {
  allAvailableRoadmaps,
  allLessons,
  getRoadmap,
  type Roadmap,
} from "./state";
import type { State } from "./state";

const card = "rounded-2xl border border-border-subtle bg-surface p-5";
export function CatalogView({
  state,
  onFilter,
  onOpen,
}: {
  state: State;
  onFilter: (
    field: "catalogQuery" | "catalogCategory" | "catalogLevel",
    value: string,
  ) => void;
  onOpen: (id: string) => void;
}) {
  const items = allAvailableRoadmaps().filter((item) => {
    const query = state.catalogQuery.toLocaleLowerCase().trim();
    const textMatch =
      !query ||
      `${item.title} ${item.summary} ${item.tags.join(" ")}`
        .toLocaleLowerCase()
        .includes(query);
    return (
      textMatch &&
      (state.catalogCategory === "All topics" ||
        item.category === state.catalogCategory) &&
      (state.catalogLevel === "All levels" || item.level === state.catalogLevel)
    );
  });
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <div className="max-w-2xl">
        <Badge variant="secondary">PUBLIC SAMPLE LIBRARY</Badge>
        <h1 className="mt-4 text-xl font-semibold">Browse roadmaps</h1>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">
          Self-guided sample curricula with clear outcomes, short lessons, and
          practice prompts. These examples are seeded previews, not a
          comprehensive catalog.
        </p>
      </div>
      <div className="mt-7 grid gap-3 md:grid-cols-[minmax(220px,1fr)_190px_170px]">
        <Input
          startIcon={<Search className="size-4" />}
          aria-label="Search roadmaps"
          placeholder="Search skills or topics"
          value={state.catalogQuery}
          onChange={(e) => onFilter("catalogQuery", e.target.value)}
        />
        <Select
          value={state.catalogCategory}
          onValueChange={(v) =>
            onFilter("catalogCategory", String(v ?? "All topics"))
          }
        >
          <SelectTrigger aria-label="Filter by topic">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              "All topics",
              ...new Set(allAvailableRoadmaps().map((item) => item.category)),
            ].map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={state.catalogLevel}
          onValueChange={(v) =>
            onFilter("catalogLevel", String(v ?? "All levels"))
          }
        >
          <SelectTrigger aria-label="Filter by level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["All levels", "Beginner", "Intermediate"].map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-6 flex items-center justify-between text-xs text-foreground-muted">
        <span>
          {items.length} sample {items.length === 1 ? "roadmap" : "roadmaps"}
        </span>
        {(state.catalogQuery ||
          state.catalogCategory !== "All topics" ||
          state.catalogLevel !== "All levels") && (
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => {
              onFilter("catalogQuery", "");
              onFilter("catalogCategory", "All topics");
              onFilter("catalogLevel", "All levels");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {items.length ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className={`${card} flex min-h-64 flex-col`}>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{item.category}</Badge>
                <span className="text-xs text-foreground-muted">
                  {item.level}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-foreground-muted">
                {item.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border-subtle pt-4 text-xs text-foreground-muted">
                <span>{allLessons(item).length} lessons</span>
                <span>{item.duration}</span>
              </div>
              <Button
                className="mt-4 w-full justify-between"
                variant="outline"
                onClick={() => onOpen(item.id)}
              >
                View roadmap <ChevronRight className="size-4" />
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className={`${card} mt-3 text-center`}>
          <h2 className="text-base font-medium">No matching roadmaps</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Try another phrase or clear the filters.
          </p>
        </div>
      )}
    </div>
  );
}

export function RoadmapOverview({
  roadmapId,
  enrollment,
  onLesson,
}: {
  roadmapId: string;
  enrollment?: State["enrollments"][number];
  onLesson: (id: string) => void;
}) {
  const roadmap = getRoadmap(roadmapId)!;
  const lessons = allLessons(roadmap);
  const done = enrollment?.completedTopicIds ?? [];
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{roadmap.category}</Badge>
        <Badge variant="outline">{roadmap.level}</Badge>
        <Badge variant="outline">Sample curriculum</Badge>
      </div>
      <h1 className="mt-4 text-xl font-semibold">
        {enrollment?.title ?? roadmap.title}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground-muted">
        {roadmap.summary}
      </p>
      {enrollment?.generation && (
        <div className="mt-4 grid gap-3 rounded-xl border border-border-subtle bg-background-secondary p-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-foreground-muted">Your outcome</div>
            <p className="mt-1 text-sm">{enrollment.generation.outcome}</p>
          </div>
          <div>
            <div className="text-xs text-foreground-muted">Your pace</div>
            <p className="mt-1 text-sm">
              {enrollment.generation.hoursPerWeek} hours/week ·{" "}
              {enrollment.generation.duration} weeks
            </p>
          </div>
          <div>
            <div className="text-xs text-foreground-muted">Background</div>
            <p className="mt-1 text-sm">
              {enrollment.generation.background || "Not provided"}
            </p>
          </div>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-foreground-muted">
        <span className="flex items-center gap-1">
          <Clock3 className="size-3.5" />
          {roadmap.duration}
        </span>
        <span>{lessons.length} lessons</span>
        {enrollment && (
          <span>
            {done.length}/{lessons.length} complete
          </span>
        )}
      </div>
      <p className="mt-5 text-sm text-foreground-muted">Choose a topic from the roadmap to start learning. Your roadmap and progress stay available as you move between lessons and conversations.</p>
      <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section>
          <h2 className="text-base font-semibold">Roadmap</h2>
          <div className="mt-4 space-y-5">
            {roadmap.phases.map((phase) => (
              <div key={phase.title}>
                <h3 className="mb-2 text-sm font-medium">{phase.title}</h3>
                <div className="space-y-2">
                  {phase.lessons.map((item, i) => (
                    <Button
                      key={item.id}
                      variant="ghost"
                      onClick={() => onLesson(item.id)}
                      className="h-auto w-full justify-start gap-3 rounded-xl border border-border-subtle bg-surface p-4 text-left"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary text-xs">
                        {done.includes(item.id) ? (
                          <Check className="size-4 text-success" />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block whitespace-normal text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs text-foreground-muted">
                          {item.duration} min · {item.objective}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0" />
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="space-y-5">
          <section className={card}>
            <h2 className="text-sm font-semibold">You will practice</h2>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-foreground-muted">
              {roadmap.outcomes.map((x) => (
                <li key={x}>• {x}</li>
              ))}
            </ul>
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold">Before you begin</h2>
            {roadmap.prerequisites.map((x) => (
              <p
                key={x}
                className="mt-2 text-sm leading-5 text-foreground-muted"
              >
                {x}
              </p>
            ))}
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold">References</h2>
            {lessons.slice(0, 2).map((l) => (
              <a
                key={l.id}
                href={l.source.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block text-xs underline underline-offset-4"
              >
                {l.source.title} · official external documentation
              </a>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
