import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Lightbulb, RotateCcw } from "lucide-react";
import { useState } from "react";
import { getActivity } from "./activity-catalog";

export type ActivityProgress = {
  draft: string;
  selectedAnswer?: string;
  attempts: number;
  submitted: boolean;
  correct?: boolean;
  feedback?: string;
};

const emptyProgress: ActivityProgress = {
  draft: "",
  attempts: 0,
  submitted: false,
};

export function LessonActivity({
  topicId,
  progress,
  enabled,
  onChange,
  onEnablePractice,
}: {
  topicId: string;
  progress?: ActivityProgress;
  enabled: boolean;
  onChange: (progress: ActivityProgress) => void;
  onEnablePractice: () => void;
}) {
  const activity = getActivity(topicId);
  const [hintOpen, setHintOpen] = useState(false);
  const value = progress ?? emptyProgress;
  const canCheck = activity.kind === "choice"
    ? Boolean(value.selectedAnswer)
    : Boolean(value.draft.trim());

  const check = () => {
    if (!canCheck || (value.submitted && value.correct === true)) return;
    const correct = activity.kind === "choice"
      ? value.selectedAnswer === activity.correctChoice
      : activity.kind === "short-answer"
        ? (activity.requiredTerms ?? []).every((term) => value.draft.toLowerCase().includes(term))
        : undefined;
    onChange({
      ...value,
      attempts: value.attempts + 1,
      submitted: true,
      correct,
      feedback: correct === undefined
        ? `Reflection saved. ${activity.explanation}`
        : correct
          ? `That matches this sample check. ${activity.explanation}`
          : activity.kind === "choice"
            ? `That option does not match this example. ${activity.explanation}`
            : `The sample check did not find the stated terms. ${activity.explanation}`,
    });
  };

  const changeChoice = (answer: string) => onChange({ ...value, selectedAnswer: answer, submitted: false, correct: undefined, feedback: undefined });
  const changeDraft = (draft: string) => onChange({ ...value, draft, submitted: false, correct: undefined, feedback: undefined });

  return (
    <section className="mt-8 rounded-2xl border border-border-subtle bg-surface p-5" aria-labelledby="practice-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="practice-heading" className="text-lg font-semibold">Practice this idea</h2>
            {enabled && value.attempts > 0 && <Badge variant="outline">{value.attempts} {value.attempts === 1 ? "attempt" : "attempts"}</Badge>}
          </div>
          <p className="mt-1 text-sm text-foreground-muted">A short check tied to this lesson. Your answer is private to this demo copy.</p>
        </div>
      </div>
      {!enabled ? (
        <div className="mt-4 rounded-xl border border-border-subtle bg-background-secondary p-4">
          <p className="text-sm leading-6 text-foreground-muted">Reading is open to everyone. Enable this private practice area to try the question and keep a draft with your learning copy.</p>
          <Button className="mt-3" variant="outline" onClick={onEnablePractice}>Enable private practice</Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-base leading-7">{activity.prompt}</p>
          {activity.kind === "choice" ? (
            <div role="group" aria-label="Answer choices" className="grid gap-2">
              {activity.choices?.map((choice) => (
                <Button key={choice} type="button" variant={value.selectedAnswer === choice ? "secondary" : "outline"} className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left" aria-pressed={value.selectedAnswer === choice} onClick={() => changeChoice(choice)}>
                  {choice}
                </Button>
              ))}
            </div>
          ) : (
            <>
              {activity.kind === "short-answer" && <p className="rounded-lg bg-background-secondary p-3 text-sm leading-6 text-foreground-muted">Sample check rubric: include these words to pass this fixed example: <span className="font-medium text-foreground">{activity.requiredTerms?.join(", ")}</span>. Other correct wording may not pass.</p>}
              <Textarea aria-label="Your practice answer" value={value.draft} onChange={(event) => changeDraft(event.target.value)} placeholder="Write a brief answer…" className="min-h-24 text-base" />
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={check} disabled={!canCheck || (value.submitted && value.correct === true)}>{value.submitted && value.correct === false ? <RotateCcw className="size-4" /> : <Check className="size-4" />}{value.submitted && value.correct ? "Answer checked" : value.submitted && value.correct === false ? "Check again" : "Check answer"}</Button>
            <Button variant="ghost" size="sm" onClick={() => onChange(emptyProgress)}>Start over</Button>
          </div>
          <div>
            <Button variant="link" className="h-auto p-0 text-sm" aria-expanded={hintOpen} onClick={() => setHintOpen((open) => !open)}><Lightbulb className="mr-2 size-4" />{hintOpen ? "Hide hint" : "Show hint"}</Button>
            {hintOpen && <p className="mt-2 text-sm leading-6 text-foreground-muted">{activity.hint}</p>}
          </div>
          {value.submitted && (
            <div className={`rounded-xl border p-4 ${value.correct ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"}`} role="status" aria-live="polite">
              <p className="font-medium">{value.correct === undefined ? "Reflection saved" : value.correct ? "Sample check passed" : "Try once more"}</p>
              <p className="mt-1 text-sm leading-6">{value.feedback}</p>
              <p className="mt-2 text-xs text-foreground-muted">This check uses a fixed example answer and explanation; it is not an AI assessment.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
