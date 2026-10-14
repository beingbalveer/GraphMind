import { BookOpen, Check, GraduationCap, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NavigationItem } from "@/components/ui/navigation-item";
import { allLessons, type Roadmap } from "./catalog";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2"><div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="size-4" /></div><div><div className="text-sm font-semibold">GraphMind</div>{!compact && <div className="text-xs text-foreground-muted">Learning studio</div>}</div></div>;
}
export function Appearance({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return <Button variant="ghost" className="w-full justify-start gap-2" onClick={toggle}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}{dark ? "Light appearance" : "Dark appearance"}</Button>;
}
export function RoadmapOutline({ roadmap, topicId, completedIds, open, onOpenChange, onTopic, onRoadmap }: {
  roadmap: Roadmap; topicId: string; completedIds: string[]; open: boolean;
  onOpenChange: (open: boolean) => void; onTopic: (id: string) => void; onRoadmap: () => void;
}) {
  return <div className="mt-3 border-t border-border-subtle pt-2"><Collapsible open={open} onOpenChange={onOpenChange}><div className="flex items-center justify-between px-2"><CollapsibleTrigger className="min-w-0 flex-1 py-2 text-left text-xs font-medium text-foreground-muted" aria-label={`${open ? "Collapse" : "Expand"} course outline`}>Course outline</CollapsibleTrigger><Button size="iconSm" variant="ghost" aria-label="Open roadmap overview" onClick={onRoadmap}><BookOpen className="size-3.5" /></Button></div><CollapsibleContent><div className="space-y-0.5 pb-2">{allLessons(roadmap).map((lesson, index) => {
    const done = completedIds.includes(lesson.id);
    return <NavigationItem key={lesson.id} title={lesson.title} active={topicId === lesson.id} icon={done ? <Check className="size-3.5 text-success" /> : <span className="size-1.5 rounded-full border border-border-strong" />} onClick={() => onTopic(lesson.id)}><span className="mr-1 text-2xs text-foreground-subtle">{index + 1}.</span>{lesson.title}</NavigationItem>;
  })}</div></CollapsibleContent></Collapsible></div>;
}
