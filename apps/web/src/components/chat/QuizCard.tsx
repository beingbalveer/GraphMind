"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, Sparkles, Check } from "lucide-react";
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
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-4.5 my-4 shadow-2xs select-none transition-all">
      {/* Quiz Card Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2 min-w-0">
          <span className="flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200/70">
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>Interactive Quiz</span>
          </span>
          {item.concept && (
            <span className="text-2xs font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md truncate max-w-[200px]">
              {item.concept}
            </span>
          )}
        </div>

        {totalQuestions && totalQuestions > 1 && questionIndex !== undefined && (
          <span className="text-2xs font-medium text-zinc-400">
            {questionIndex + 1} of {totalQuestions}
          </span>
        )}
      </div>

      {/* Question Prompt */}
      <h4 className="text-sm font-semibold text-zinc-950 mb-3.5 leading-relaxed">
        {item.question}
      </h4>

      {/* Answer Options */}
      <div className="space-y-2 mb-3">
        {item.options.map((opt, idx) => {
          const letter = opt.id || String.fromCharCode(65 + idx);
          const isSelected = selectedOptionId === opt.id;
          const isThisOptionCorrect = opt.isCorrect ?? false;

          let btnStyles =
            "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/70 text-zinc-800";

          if (isAnswered) {
            if (isSelected) {
              btnStyles = isCorrect
                ? "border-emerald-500 bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-500/20"
                : "border-rose-400 bg-rose-50/80 text-rose-950 ring-1 ring-rose-400/20";
            } else if (isThisOptionCorrect) {
              btnStyles = "border-emerald-300 bg-emerald-50/40 text-emerald-900";
            } else {
              btnStyles = "border-zinc-200/60 bg-zinc-50/40 text-zinc-400 opacity-60";
            }
          }

          return (
            <button
              key={opt.id || idx}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelect(opt.id)}
              className={`w-full flex items-start text-left p-3 rounded-xl border text-xs transition-all duration-150 cursor-pointer disabled:cursor-default ${btnStyles}`}
            >
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-2xs shrink-0 mr-3 mt-0.5 transition-colors ${
                  isAnswered && isSelected
                    ? isCorrect
                      ? "bg-emerald-600 text-white"
                      : "bg-rose-600 text-white"
                    : isAnswered && isThisOptionCorrect
                    ? "bg-emerald-200 text-emerald-900"
                    : "bg-zinc-100 text-zinc-700"
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
            </button>
          );
        })}
      </div>

      {/* Post-Answer Explanation & Feedback */}
      {isAnswered && (
        <div className="pt-2 animate-in fade-in-50 duration-200">
          <div
            className={`p-3 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
              isCorrect
                ? "bg-emerald-50/50 border-emerald-200/80 text-emerald-900"
                : "bg-zinc-50 border-zinc-200/80 text-zinc-800"
            }`}
          >
            <div className="flex items-center space-x-1.5 font-semibold">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-950">Correct! Great retention.</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-zinc-950">Review explanation:</span>
                </>
              )}
            </div>

            {item.explanation && (
              <p className="text-xs opacity-90">{item.explanation}</p>
            )}

            {/* Profile update confirmation */}
            {workspaceId && item.concept && (
              <div className="flex items-center space-x-1 text-2xs pt-1 font-medium text-purple-700">
                <Sparkles className="w-3 h-3 text-purple-500" />
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
      <div className="my-3 p-3 rounded-xl bg-purple-50/50 border border-purple-200 text-xs text-purple-900 font-mono">
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
