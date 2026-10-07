"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClarificationQuestion } from "@/lib/roadmapTypes";
export function ClarificationForm({
  question,
  onAnswer,
}: {
  question: ClarificationQuestion;
  onAnswer: (questionId: string, answer: string) => Promise<unknown>;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(value: string) {
    if (busy || !value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAnswer(question.id, value.trim());
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save your answer",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(answer);
      }}
    >
      <p className="text-sm font-medium">{question.text}</p>
      <div className="flex flex-wrap gap-2">
        {question.suggestions.map((value) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void submit(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      <Input
        aria-label="Your answer"
        placeholder="Or write your answer"
        maxLength={4000}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={busy}
      />
      <Button type="submit" size="sm" disabled={busy || !answer.trim()}>
        Continue
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
