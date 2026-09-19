"use client";

import {
  BookOpenCheck,
  ChevronDown,
  Factory,
  Lightbulb,
  Network,
  Presentation,
  TestTube2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Surface } from "@/components/ui/surface";

export type LearningActionId =
  | "simple"
  | "example"
  | "quiz"
  | "deep"
  | "real_world"
  | "production"
  | "teach_back";

const LEARNING_ACTION_PROMPTS: Record<LearningActionId, string> = {
  simple:
    "Teach the preceding topic in plain language. Start with the smallest useful mental model, define any necessary term once, and use a short analogy only if it genuinely clarifies the idea. End with one sentence the learner should remember.",
  example:
    "Teach the preceding topic through one worked example. State the problem, show each important reasoning step, explain why that step is needed, and finish by naming the general principle the learner can reuse.",
  quiz:
    "Run an active-recall check on the preceding topic. Ask one question at a time, wait for the learner's answer before giving feedback, and use the answer to decide whether to make the next question easier, harder, or more applied. Do not reveal answers before an attempt.",
  deep:
    "Take a deep dive into the preceding topic. Explain its mechanics, assumptions, trade-offs, edge cases, and how it connects to prerequisite concepts. Prefer causal reasoning over a longer restatement.",
  real_world:
    "Ground the preceding topic in a concrete real-world scenario. Describe the problem, why this concept is the right tool, the choices an engineer makes, and the outcome. Make the example specific rather than generic.",
  production:
    "Explain the preceding topic in production context. Cover the practical architecture, reliability, performance, security, cost, observability, and failure-mode trade-offs that matter when applying it in a real system.",
  teach_back:
    "Invite the learner to explain the preceding topic in their own words, as if teaching a teammate. Ask for a concise explanation and one example. After they respond, identify what is accurate, diagnose gaps with a focused question, and avoid supplying the full answer immediately.",
};

const LEARNING_ACTION_DISPLAY_PROMPTS: Record<LearningActionId, string> = {
  simple: "Explain this topic in simpler language.",
  example: "Show me a worked example for this topic.",
  quiz: "Quiz me on this topic.",
  deep: "Take me on a deep dive into this topic.",
  real_world: "Show me a real-world use of this topic.",
  production: "Show me the production context for this topic.",
  teach_back: "Let me teach this topic back to you.",
};

export function buildLearningActionPrompt(action: LearningActionId): string {
  return LEARNING_ACTION_PROMPTS[action];
}

export function getLearningActionDisplayPrompt(action: LearningActionId): string {
  return LEARNING_ACTION_DISPLAY_PROMPTS[action];
}

interface LearningActionsProps {
  onSelect: (action: LearningActionId) => void;
}

const MORE_ACTIONS: Array<{
  id: Exclude<LearningActionId, "simple" | "example" | "quiz">;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "deep", label: "Deep dive", icon: <Network className="size-3.5" /> },
  { id: "real_world", label: "Real-world context", icon: <Lightbulb className="size-3.5" /> },
  { id: "production", label: "Production context", icon: <Factory className="size-3.5" /> },
  { id: "teach_back", label: "Teach it back", icon: <Presentation className="size-3.5" /> },
];

export function LearningActions({ onSelect }: LearningActionsProps) {
  return (
    <Surface
      variant="muted"
      radius="widget"
      className="mt-3 border border-border-subtle bg-background-secondary p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-foreground-muted shadow-2xs">
            <BookOpenCheck aria-hidden="true" className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Continue learning</p>
            <p className="text-2xs text-foreground-muted">
              Choose an angle; it stays connected to this answer.
            </p>
          </div>
        </div>

        <div aria-label="Learning actions" className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="xs" onClick={() => onSelect("simple")}>
            Explain simply
          </Button>
          <Button variant="outline" size="xs" onClick={() => onSelect("example")}>
            Show a worked example
          </Button>
          <Button variant="outline" size="xs" onClick={() => onSelect("quiz")}>
            <TestTube2 aria-hidden="true" className="size-3" />
            Quiz me
          </Button>
          <DropdownMenu
            align="right"
            trigger={
              <Button variant="ghost" size="xs" aria-label="More learning options">
                More
                <ChevronDown aria-hidden="true" className="size-3" />
              </Button>
            }
            items={MORE_ACTIONS.map((action) => ({
              label: action.label,
              icon: action.icon,
              onClick: () => onSelect(action.id),
            }))}
          />
        </div>
      </div>
    </Surface>
  );
}
