"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createWorkspaceConcept,
  updateWorkspaceConcept,
} from "@/lib/workspaceApi";

export interface QuizOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface QuizItem {
  concept?: string;
  question: string;
  options: QuizOption[];
  explanation?: string;
}

interface SingleQuizCardProps {
  item: QuizItem;
  questionIndex?: number;
  totalQuestions?: number;
  workspaceId?: string;
}

function SingleQuizCard({
  item,
  questionIndex,
  totalQuestions,
  workspaceId,
}: SingleQuizCardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileUpdated, setProfileUpdated] = useState<boolean | null>(null);

  const isAnswered = selectedOptionId !== null;
  const selectedOption = item.options.find((o) => o.id === selectedOptionId);
  const isCorrect = selectedOption?.isCorrect ?? false;

  const handleSelect = async (optionId: string) => {
    if (isAnswered) return;
    setSelectedOptionId(optionId);

    const chosen = item.options.find((o) => o.id === optionId);
    const correct = chosen?.isCorrect ?? false;

    // Trigger Knowledge Profile feedback loop if workspaceId and concept are available
    if (workspaceId && item.concept) {
      try {
        setIsUpdatingProfile(true);
        const conceptRecord = await createWorkspaceConcept(workspaceId, {
          name: item.concept.trim(),
          masteryLevel: "explored",
        });

        if (conceptRecord?.id) {
          await updateWorkspaceConcept(workspaceId, conceptRecord.id, {
            quizResult: correct,
          });
          setProfileUpdated(true);

          // Dispatch event so active mastery panels refresh reactively
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("concept-mastery-updated", {
                detail: {
                  concept: item.concept,
                  isCorrect: correct,
                  workspaceId,
                },
              })
            );
          }
        }
      } catch (err) {
        console.warn("Error updating knowledge profile from quiz:", err);
      } finally {
        setIsUpdatingProfile(false);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 my-4 shadow-2xs select-none transition-all">
      {/* Quiz Card Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2 min-w-0">
          <Badge variant="secondary" className="gap-1.5 py-0.5">
            <Sparkles className="w-3 h-3 text-foreground" />
            <span>Interactive Quiz</span>
          </Badge>
          {item.concept && (
            <Badge variant="outline" className="text-2xs font-medium text-foreground-muted truncate max-w-[200px]">
              {item.concept}
            </Badge>
          )}
        </div>

        {totalQuestions && totalQuestions > 1 && questionIndex !== undefined && (
          <span className="text-2xs font-medium text-foreground-muted">
            {questionIndex + 1} of {totalQuestions}
          </span>
        )}
      </div>

      {/* Question Prompt */}
      <h4 className="text-sm font-semibold text-foreground mb-3.5 leading-relaxed">
        {item.question}
      </h4>

      {/* Answer Options */}
      <div className="space-y-2 mb-3">
        {item.options.map((opt, idx) => {
          const letter = opt.id || String.fromCharCode(65 + idx);
          const isSelected = selectedOptionId === opt.id;
          const isThisOptionCorrect = opt.isCorrect ?? false;

          let btnStyles =
            "border-border bg-surface hover:border-border-strong hover:bg-surface-hover text-foreground";

          if (isAnswered) {
            if (isSelected) {
              btnStyles = isCorrect
                ? "border-foreground bg-surface-hover text-foreground ring-1 ring-foreground/30 font-medium"
                : "border-destructive bg-destructive/10 text-foreground ring-1 ring-destructive/30";
            } else if (isThisOptionCorrect) {
              btnStyles = "border-foreground/50 bg-surface-hover/70 text-foreground font-medium";
            } else {
              btnStyles = "border-border-subtle bg-surface/30 text-foreground-muted opacity-50";
            }
          }

          return (
            <Button
              key={opt.id || idx}
              type="button"
              variant="outline"
              disabled={isAnswered}
              onClick={() => handleSelect(opt.id)}
              className={`w-full flex items-start justify-start text-left p-3 h-auto rounded-xl border text-xs transition-all duration-150 cursor-pointer disabled:cursor-default whitespace-normal font-normal shadow-none ${btnStyles}`}
            >
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-2xs shrink-0 mr-3 mt-0.5 transition-colors ${
                  isAnswered && isSelected
                    ? isCorrect
                      ? "bg-foreground text-background"
                      : "bg-destructive text-destructive-foreground"
                    : isAnswered && isThisOptionCorrect
                    ? "bg-foreground/20 text-foreground"
                    : "bg-surface-hover text-foreground-muted"
                }`}
              >
                {isAnswered && isSelected ? (
                  isCorrect ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                  )
                ) : (
                  letter
                )}
              </div>
              <span className="flex-1 leading-relaxed">{opt.text}</span>
            </Button>
          );
        })}
      </div>

      {/* Post-Answer Explanation & Feedback */}
      {isAnswered && (
        <div className="pt-2 animate-in fade-in-50 duration-200">
          <div
            className={`p-3 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
              isCorrect
                ? "bg-surface-hover border-border text-foreground"
                : "bg-surface border-border text-foreground"
            }`}
          >
            <div className="flex items-center space-x-1.5 font-semibold">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" />
                  <span className="text-foreground">Correct! Great retention.</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  <span className="text-foreground">Review explanation:</span>
                </>
              )}
            </div>

            {item.explanation && (
              <p className="text-xs opacity-90 text-foreground-muted">{item.explanation}</p>
            )}

            {/* Profile update confirmation */}
            {workspaceId && item.concept && (
              <div className="flex items-center space-x-1 text-2xs pt-1 font-medium text-foreground-muted">
                <Sparkles className="w-3 h-3 text-foreground" />
                <span>
                  {isUpdatingProfile
                    ? "Updating Knowledge Profile..."
                    : profileUpdated
                    ? `Knowledge profile updated: ${item.concept} (${
                        isCorrect ? "+Confidence" : "Recorded for review"
                      })`
                    : "Concept recorded in Knowledge Profile"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function QuizCard({
  rawCode,
  workspaceId,
}: {
  rawCode: string;
  workspaceId?: string;
}) {
  let parsed: QuizItem | QuizItem[] | null = null;

  try {
    const cleaned = rawCode.trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // If not JSON, render fallback block
    return (
      <div className="my-3 p-3 rounded-xl bg-surface border border-border text-xs text-foreground font-mono">
        {rawCode}
      </div>
    );
  }

  if (!parsed) return null;

  const items: QuizItem[] = Array.isArray(parsed) ? parsed : [parsed];

  return (
    <div className="w-full space-y-3">
      {items.map((item, idx) => (
        <SingleQuizCard
          key={idx}
          item={item}
          questionIndex={idx}
          totalQuestions={items.length}
          workspaceId={workspaceId}
        />
      ))}
    </div>
  );
}
