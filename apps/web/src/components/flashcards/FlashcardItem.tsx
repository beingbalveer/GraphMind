"use client";

import * as React from "react";
import type { Flashcard, FlashcardUpdateInput } from "@graphmind/shared";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Trash2, Eye, EyeOff, Check, X } from "lucide-react";

export interface FlashcardItemProps {
  card: Flashcard;
  onSave: (cardId: string, update: FlashcardUpdateInput) => Promise<void> | void;
  onRequestDelete: (card: Flashcard) => void;
  isBusy?: boolean;
}

export function FlashcardItem({
  card,
  onSave,
  onRequestDelete,
  isBusy = false,
}: FlashcardItemProps) {
  const [isRevealed, setIsRevealed] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedQuestion, setEditedQuestion] = React.useState(card.question);
  const [editedAnswer, setEditedAnswer] = React.useState(card.answer);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setIsRevealed(false);
    setIsEditing(false);
    setEditedQuestion(card.question);
    setEditedAnswer(card.answer);
  }, [card.id, card.question, card.answer]);

  const handleStartEdit = () => {
    setEditedQuestion(card.question);
    setEditedAnswer(card.answer);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedQuestion(card.question);
    setEditedAnswer(card.answer);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmedQ = editedQuestion.trim();
    const trimmedA = editedAnswer.trim();
    if (!trimmedQ || !trimmedA) return;

    setIsSaving(true);
    try {
      await onSave(card.id, { question: trimmedQ, answer: trimmedA });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const canSave =
    editedQuestion.trim().length > 0 &&
    editedAnswer.trim().length > 0 &&
    (editedQuestion.trim() !== card.question || editedAnswer.trim() !== card.answer) &&
    !isBusy &&
    !isSaving;

  return (
    <Surface
      variant="base"
      radius="card"
      className="p-4 transition-all duration-200 hover:border-border flex flex-col gap-3"
      data-testid={`flashcard-item-${card.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="subtle" size="sm">
          Card {card.position + 1}
        </Badge>
        <div className="flex items-center gap-1">
          {!isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                disabled={isBusy}
                aria-label="Edit flashcard"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRequestDelete(card)}
                disabled={isBusy}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Delete flashcard"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground-muted" htmlFor={`q-${card.id}`}>
              Question
            </label>
            <Textarea
              id={`q-${card.id}`}
              value={editedQuestion}
              onChange={(e) => setEditedQuestion(e.target.value)}
              disabled={isBusy || isSaving}
              rows={2}
              aria-label="Edit question"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground-muted" htmlFor={`a-${card.id}`}>
              Answer
            </label>
            <Textarea
              id={`a-${card.id}`}
              value={editedAnswer}
              onChange={(e) => setEditedAnswer(e.target.value)}
              disabled={isBusy || isSaving}
              rows={3}
              aria-label="Edit answer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isBusy || isSaving}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!canSave}
              loading={isSaving}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-sm font-medium text-foreground leading-relaxed">
            {card.question}
          </div>

          {isRevealed ? (
            <div
              className="mt-1 pt-3 border-t border-border-subtle text-xs text-foreground-muted leading-relaxed"
              data-testid={`flashcard-answer-${card.id}`}
            >
              {card.answer}
            </div>
          ) : null}

          <div className="pt-2 flex justify-start">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setIsRevealed(!isRevealed)}
              aria-label={isRevealed ? "Hide answer" : "Show answer"}
            >
              {isRevealed ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                  Hide answer
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Show answer
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Surface>
  );
}
