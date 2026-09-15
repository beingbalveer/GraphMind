"use client";

import * as React from "react";
import type { Flashcard, FlashcardUpdateInput } from "@graphmind/shared";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineFeedback } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Surface } from "@/components/ui/surface";
import { FlashcardItem } from "./FlashcardItem";
import {
  listNodeFlashcards,
  generateNodeFlashcards,
  updateNodeFlashcard,
  deleteNodeFlashcard,
  type FlashcardGenerationConfig,
} from "@/lib/flashcardApi";
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  BookOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  nodeId: string;
  sourcePreview?: string;
  generationConfig?: FlashcardGenerationConfig;
  onGoToSource?: () => void;
  canEdit?: boolean;
}

export function FlashcardModal({
  isOpen,
  onClose,
  workspaceId,
  nodeId,
  sourcePreview = "",
  generationConfig,
  onGoToSource,
  canEdit = true,
}: FlashcardModalProps) {
  const [cards, setCards] = React.useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [failedPhase, setFailedPhase] = React.useState<"load" | "generate" | null>(null);

  const [busyCardId, setBusyCardId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Flashcard | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [showRegenerateConfirm, setShowRegenerateConfirm] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [isForbiddenViewer, setIsForbiddenViewer] = React.useState(false);
  const [activeCardIndex, setActiveCardIndex] = React.useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = React.useState(false);
  const [confidenceByCardId, setConfidenceByCardId] = React.useState<Record<string, string>>({});
  const [isManagingCards, setIsManagingCards] = React.useState(false);

  const truncatedPreview = React.useMemo(() => {
    if (!sourcePreview) return "";
    return sourcePreview.length > 80
      ? `${sourcePreview.slice(0, 80)}…`
      : sourcePreview;
  }, [sourcePreview]);

  // Initial Load and Auto-Generation
  React.useEffect(() => {
    if (!isOpen || !workspaceId || !nodeId) {
      setCards([]);
      setActiveCardIndex(0);
      setIsAnswerRevealed(false);
      setConfidenceByCardId({});
      setIsManagingCards(false);
      setError(null);
      setFailedPhase(null);
      setIsLoading(false);
      setStatusMessage(null);
      setIsForbiddenViewer(false);
      return;
    }

    let isCancelled = false;

    const loadOrGenerate = async () => {
      let currentPhase: "load" | "generate" = "load";
      setIsLoading(true);
      setError(null);
      setFailedPhase(null);
      setStatusMessage("Checking existing flashcards…");
      setIsForbiddenViewer(false);

      try {
        const existing = await listNodeFlashcards(workspaceId, nodeId);
        if (isCancelled) return;

        if (existing.length > 0) {
          setCards(existing);
          setActiveCardIndex(0);
          setIsAnswerRevealed(false);
          setConfidenceByCardId({});
          setIsLoading(false);
          setStatusMessage(null);
          return;
        }

        // If user cannot edit, do not attempt to auto-generate
        if (!canEdit) {
          setCards([]);
          setIsLoading(false);
          setStatusMessage(null);
          return;
        }

        // Existing is empty -> trigger auto-generation
        currentPhase = "generate";
        setStatusMessage("Generating 5 flashcards from response…");
        const generated = await generateNodeFlashcards(workspaceId, nodeId, {
          count: 5,
          replaceExisting: false,
          ...generationConfig,
        });

        if (isCancelled) return;
        setCards(generated);
        setActiveCardIndex(0);
        setIsAnswerRevealed(false);
        setConfidenceByCardId({});
        setIsLoading(false);
        setStatusMessage(null);
      } catch (err: unknown) {
        if (isCancelled) return;

        // Gracefully handle 403 Forbidden for viewers during generation
        const isForbidden =
          (err instanceof Error &&
            (err.message.includes("403") || err.message.toLowerCase().includes("forbidden"))) ||
          (typeof err === "object" && err !== null && (err as { status?: number }).status === 403);

        if (isForbidden) {
          setCards([]);
          setError(null);
          setFailedPhase(null);
          setIsLoading(false);
          setStatusMessage(null);
          setIsForbiddenViewer(true);
          return;
        }

        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load or generate flashcards";
        setError(msg);
        setFailedPhase(currentPhase);
        setIsLoading(false);
        setStatusMessage(null);
      }
    };

    loadOrGenerate();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, workspaceId, nodeId, generationConfig, canEdit]);

  const handleRetry = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (failedPhase === "generate") {
        setStatusMessage("Generating 5 flashcards from response…");
        const generated = await generateNodeFlashcards(workspaceId, nodeId, {
          count: 5,
          replaceExisting: cards.length > 0,
          ...generationConfig,
        });
        setCards(generated);
        setActiveCardIndex(0);
        setIsAnswerRevealed(false);
        setConfidenceByCardId({});
      } else {
        setStatusMessage("Loading flashcards…");
        const existing = await listNodeFlashcards(workspaceId, nodeId);
        if (existing.length > 0) {
          setCards(existing);
        } else {
          setStatusMessage("Generating 5 flashcards from response…");
          const generated = await generateNodeFlashcards(workspaceId, nodeId, {
            count: 5,
            replaceExisting: false,
            ...generationConfig,
          });
          setCards(generated);
          setActiveCardIndex(0);
          setIsAnswerRevealed(false);
          setConfidenceByCardId({});
        }
      }
      setFailedPhase(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Retry operation failed";
      setError(msg);
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  const handleSaveCard = async (
    cardId: string,
    update: FlashcardUpdateInput
  ) => {
    setBusyCardId(cardId);
    setError(null);

    try {
      const updated = await updateNodeFlashcard(
        workspaceId,
        nodeId,
        cardId,
        update
      );
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? updated : c))
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update flashcard";
      setError(msg);
      throw err;
    } finally {
      setBusyCardId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteNodeFlashcard(workspaceId, nodeId, pendingDelete.id);
      setCards((prev) => {
        const next = prev.filter((c) => c.id !== pendingDelete.id);
        return next.map((c, idx) => ({ ...c, position: idx }));
      });
      setActiveCardIndex((index) => Math.max(0, Math.min(index, cards.length - 2)));
      setIsAnswerRevealed(false);
      setPendingDelete(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete flashcard";
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const fresh = await generateNodeFlashcards(workspaceId, nodeId, {
        count: 5,
        replaceExisting: true,
        ...generationConfig,
      });
      setCards(fresh);
      setActiveCardIndex(0);
      setIsAnswerRevealed(false);
      setConfidenceByCardId({});
      setIsManagingCards(false);
      setShowRegenerateConfirm(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to regenerate flashcards";
      setError(msg);
    } finally {
      setIsRegenerating(false);
    }
  };

  const isMutating = isDeleting || isRegenerating;
  const isAnyBusy = isLoading || isMutating || Boolean(busyCardId);
  const activeCard = cards[activeCardIndex];

  const moveToCard = (index: number) => {
    setActiveCardIndex(Math.max(0, Math.min(index, cards.length - 1)));
    setIsAnswerRevealed(false);
  };

  const recordConfidence = (value: string) => {
    if (!activeCard) return;
    setConfidenceByCardId((previous) => ({ ...previous, [activeCard.id]: value }));
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={isMutating ? () => {} : onClose}
        title="Study response"
        description={truncatedPreview || "Practice the key ideas from this message"}
        icon={<BookOpen className="size-4" />}
        hasBackdrop={false}
        widthClassName="w-full sm:w-[440px] md:w-[500px]"
        headerActions={
          cards.length > 0 && !isLoading ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsManagingCards((value) => !value)}
                disabled={isAnyBusy}
              >
                {isManagingCards ? "Study" : "Manage cards"}
              </Button>
              {canEdit && !isForbiddenViewer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateConfirm(true)}
              disabled={isAnyBusy}
              aria-label="Regenerate flashcards"
            >
              <Sparkles className="size-3.5 mr-1.5 text-primary" />
              Regenerate
            </Button>
              )}
            </>
          ) : undefined
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          {error && (
            <InlineFeedback
              tone="destructive"
              title="Flashcard Error"
              action={
                failedPhase ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isLoading}
                  >
                    <RefreshCw className="size-3.5 mr-1.5" />
                    Retry
                  </Button>
                ) : undefined
              }
            >
              {error}
            </InlineFeedback>
          )}

          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="py-10 flex flex-col items-center justify-center gap-2.5 text-foreground-muted"
              data-testid="flashcard-loading-state"
            >
              <Loader2 className="size-5 animate-spin text-primary" />
              <p className="text-xs">{statusMessage || "Loading flashcards…"}</p>
            </div>
          ) : cards.length > 0 && isManagingCards ? (
            <div className="flex flex-col gap-2">
              {cards.map((card, index) => (
                <FlashcardItem
                  key={card.id}
                  card={card}
                  displayIndex={index + 1}
                  onSave={handleSaveCard}
                  onRequestDelete={(c) => setPendingDelete(c)}
                  isBusy={busyCardId === card.id || isAnyBusy}
                />
              ))}
            </div>
          ) : activeCard ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-foreground-muted">
                <span>{activeCardIndex + 1} of {cards.length}</span>
                {confidenceByCardId[activeCard.id] ? (
                  <Badge variant="secondary">{confidenceByCardId[activeCard.id]}</Badge>
                ) : null}
              </div>
              <div
                className="h-1 overflow-hidden rounded-full bg-background-secondary"
                role="progressbar"
                aria-label="Study progress"
                aria-valuemin={1}
                aria-valuemax={cards.length}
                aria-valuenow={activeCardIndex + 1}
              >
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${((activeCardIndex + 1) / cards.length) * 100}%` }}
                />
              </div>
              <Surface variant="base" radius="card" className="flex min-h-64 flex-1 flex-col justify-center gap-5 p-6 sm:p-8">
                <p className="text-lg font-semibold leading-relaxed text-foreground">{activeCard.question}</p>
                {isAnswerRevealed ? (
                  <div className="border-t border-border-subtle pt-5">
                    <p className="text-sm leading-relaxed text-foreground-muted">{activeCard.answer}</p>
                    <div className="mt-6">
                      <p className="mb-2 text-xs font-medium text-foreground-muted">How did that feel?</p>
                      <div className="flex flex-wrap gap-2">
                        {["Got it", "Almost", "Review again"].map((value) => (
                          <Button
                            key={value}
                            variant={confidenceByCardId[activeCard.id] === value ? "default" : "secondary"}
                            size="sm"
                            onClick={() => recordConfidence(value)}
                          >
                            {value}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setIsAnswerRevealed(true)}>
                    Show answer
                  </Button>
                )}
              </Surface>
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveToCard(activeCardIndex - 1)}
                  disabled={activeCardIndex === 0}
                >
                  <ChevronLeft className="mr-1 size-3.5" />
                  Previous
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => moveToCard(activeCardIndex + 1)}
                  disabled={activeCardIndex === cards.length - 1}
                >
                  Next
                  <ChevronRight className="ml-1 size-3.5" />
                </Button>
              </div>
            </div>
          ) : !error ? (
            <div className="py-8 text-center text-xs text-foreground-muted">
              {!canEdit || isForbiddenViewer
                ? "No flashcards have been generated for this response yet. An editor or workspace owner can generate flashcards."
                : "No flashcards found for this response."}
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-border-subtle pt-3">
            {onGoToSource ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClose();
                  requestAnimationFrame(() => setTimeout(onGoToSource, 60));
                }}
                disabled={isMutating}
              >
                <ExternalLink className="mr-1.5 size-3.5" />
                Go to source
              </Button>
            ) : <span />}
            <Button variant="outline" size="sm" onClick={onClose} disabled={isMutating}>Close</Button>
          </div>
        </div>
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Flashcard"
        description={`Are you sure you want to delete Card ${(pendingDelete?.position ?? 0) + 1}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />

      {/* Regenerate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRegenerateConfirm}
        onClose={() => setShowRegenerateConfirm(false)}
        onConfirm={handleConfirmRegenerate}
        title="Regenerate Flashcards"
        description="Are you sure you want to regenerate all flashcards? Your previous cards and any custom edits will be replaced."
        confirmText="Regenerate"
        cancelText="Cancel"
        variant="default"
        isLoading={isRegenerating}
      />
    </>
  );
}
