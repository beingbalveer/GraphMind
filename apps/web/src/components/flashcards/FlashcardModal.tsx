"use client";

import * as React from "react";
import type { Flashcard, FlashcardUpdateInput } from "@graphmind/shared";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineFeedback } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FlashcardItem } from "./FlashcardItem";
import {
  listNodeFlashcards,
  generateNodeFlashcards,
  updateNodeFlashcard,
  deleteNodeFlashcard,
  type FlashcardGenerationConfig,
} from "@/lib/flashcardApi";
import { Sparkles, RefreshCw, ExternalLink, BookOpen, Loader2 } from "lucide-react";

export interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  nodeId: string;
  sourcePreview?: string;
  generationConfig?: FlashcardGenerationConfig;
  onGoToSource?: () => void;
}

export function FlashcardModal({
  isOpen,
  onClose,
  workspaceId,
  nodeId,
  sourcePreview = "",
  generationConfig,
  onGoToSource,
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
      setError(null);
      setFailedPhase(null);
      setIsLoading(false);
      setStatusMessage(null);
      return;
    }

    let isCancelled = false;

    const loadOrGenerate = async () => {
      setIsLoading(true);
      setError(null);
      setFailedPhase(null);
      setStatusMessage("Checking existing flashcards…");

      try {
        const existing = await listNodeFlashcards(workspaceId, nodeId);
        if (isCancelled) return;

        if (existing.length > 0) {
          setCards(existing);
          setIsLoading(false);
          setStatusMessage(null);
          return;
        }

        // Existing is empty -> trigger auto-generation
        setStatusMessage("Generating 5 flashcards from response…");
        const generated = await generateNodeFlashcards(workspaceId, nodeId, {
          count: 5,
          replaceExisting: false,
          ...generationConfig,
        });

        if (isCancelled) return;
        setCards(generated);
        setIsLoading(false);
        setStatusMessage(null);
      } catch (err: unknown) {
        if (isCancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load or generate flashcards";
        setError(msg);
        setFailedPhase(cards.length > 0 ? "generate" : "load");
        setIsLoading(false);
        setStatusMessage(null);
      }
    };

    loadOrGenerate();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, workspaceId, nodeId, generationConfig]);

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
      setCards((prev) => prev.filter((c) => c.id !== pendingDelete.id));
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
      setShowRegenerateConfirm(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to regenerate flashcards";
      setError(msg);
    } finally {
      setIsRegenerating(false);
    }
  };

  const isAnyBusy = isLoading || isRegenerating || Boolean(busyCardId);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={isAnyBusy ? () => {} : onClose}
        size="2xl"
        ariaLabel="Response Flashcards"
        closeOnClickOutside={!isAnyBusy}
      >
        <ModalHeader
          icon={<BookOpen className="size-4 text-primary" />}
          title={
            <div className="flex items-center gap-2">
              <span>Response Flashcards</span>
              {cards.length > 0 && (
                <Badge variant="secondary">
                  {cards.length} {cards.length === 1 ? "card" : "cards"}
                </Badge>
              )}
            </div>
          }
          description={truncatedPreview || "Study key concepts from this message"}
          onClose={isAnyBusy ? undefined : onClose}
        >
          {cards.length > 0 && !isLoading && (
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
        </ModalHeader>

        <ModalBody className="p-4 sm:p-5 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
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
              className="py-12 flex flex-col items-center justify-center gap-3 text-foreground-muted"
              data-testid="flashcard-loading-state"
            >
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs">{statusMessage || "Loading flashcards…"}</p>
            </div>
          ) : cards.length > 0 ? (
            <div className="flex flex-col gap-3">
              {cards.map((card) => (
                <FlashcardItem
                  key={card.id}
                  card={card}
                  onSave={handleSaveCard}
                  onRequestDelete={(c) => setPendingDelete(c)}
                  isBusy={busyCardId === card.id || isAnyBusy}
                />
              ))}
            </div>
          ) : !error ? (
            <div className="py-10 text-center text-xs text-foreground-muted">
              No flashcards found for this response.
            </div>
          ) : null}
        </ModalBody>

        <ModalFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {onGoToSource ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onGoToSource();
                  onClose();
                }}
                disabled={isAnyBusy}
              >
                <ExternalLink className="size-3.5 mr-1.5" />
                Go to source
              </Button>
            ) : null}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isAnyBusy}
          >
            Close
          </Button>
        </ModalFooter>
      </Modal>

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
