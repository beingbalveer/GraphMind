"use client";

import * as React from "react";
import type { Flashcard, FlashcardUpdateInput } from "@graphmind/shared";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Trash2, Eye, EyeOff, Check, X, MoreHorizontal } from "lucide-react";

export interface FlashcardItemProps {
  card: Flashcard;
  displayIndex?: number;
  onSave: (cardId: string, update: FlashcardUpdateInput) => Promise<void> | void;
  onRequestDelete: (card: Flashcard) => void;
  isBusy?: boolean;
}

export function FlashcardItem({
  card,
  displayIndex,
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
    } catch {
      // Keep isEditing true, preserve entered content in editedQuestion and editedAnswer
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
      radius="control"
      className="p-3 transition-all duration-200 hover:border-border flex flex-col gap-2"
      data-testid={`flashcard-item-${card.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary">
          Card {displayIndex ?? card.position + 1}
        </Badge>
        {!isEditing ? (
          <DropdownMenu
            trigger={
              <IconButton
                variant="ghost"
                label="Flashcard actions"
                title="Flashcard actions"
                disabled={isBusy}
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </IconButton>
            }
            items={[
              {
                label: "Edit flashcard",
                icon: <Edit2 aria-hidden="true" />,
                onClick: handleStartEdit,
                disabled: isBusy,
              },
              {
                label: "Delete flashcard",
                icon: <Trash2 aria-hidden="true" />,
                variant: "destructive",
                onClick: () => onRequestDelete(card),
                disabled: isBusy,
              },
            ]}
          />
        ) : null}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-2xs font-medium text-foreground-muted" htmlFor={`q-${card.id}`}>
              Question
            </label>
            <Textarea
              id={`q-${card.id}`}
              value={editedQuestion}
              onChange={(e) => setEditedQuestion(e.target.value)}
              disabled={isBusy || isSaving}
              rows={1}
              className="min-h-[38px] text-xs py-1.5"
              aria-label="Edit question"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-2xs font-medium text-foreground-muted" htmlFor={`a-${card.id}`}>
              Answer
            </label>
            <Textarea
              id={`a-${card.id}`}
              value={editedAnswer}
              onChange={(e) => setEditedAnswer(e.target.value)}
              disabled={isBusy || isSaving}
              rows={2}
              className="min-h-[52px] text-xs py-1.5"
              aria-label="Edit answer"
            />
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isBusy || isSaving}
            >
              <X className="size-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={!canSave}
              loading={isSaving}
            >
              <Check className="size-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-foreground leading-snug">
            {card.question}
          </div>

          {isRevealed ? (
            <div
              className="mt-0.5 pt-2 border-t border-border-subtle/70 text-xs text-foreground-muted leading-relaxed"
              data-testid={`flashcard-answer-${card.id}`}
            >
              {card.answer}
            </div>
          ) : null}

          <div className="pt-0.5 flex justify-start">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRevealed(!isRevealed)}
              aria-label={isRevealed ? "Hide answer" : "Show answer"}
            >
              {isRevealed ? (
                <>
                  <EyeOff className="size-3.5 mr-1.5" />
                  Hide answer
                </>
              ) : (
                <>
                  <Eye className="size-3.5 mr-1.5" />
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
