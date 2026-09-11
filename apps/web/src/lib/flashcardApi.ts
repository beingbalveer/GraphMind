import type {
  Flashcard,
  FlashcardGenerateInput,
  FlashcardUpdateInput,
} from "@graphmind/shared";
import { apiClient } from "./apiClient";

export type FlashcardGenerationConfig = Pick<
  FlashcardGenerateInput,
  "provider" | "model" | "apiKey" | "baseUrl"
>;

const basePath = (workspaceId: string, nodeId: string) =>
  "/workspaces/" +
  encodeURIComponent(workspaceId) +
  "/nodes/" +
  encodeURIComponent(nodeId) +
  "/flashcards";

export const listNodeFlashcards = (workspaceId: string, nodeId: string) =>
  apiClient.get<Flashcard[]>(basePath(workspaceId, nodeId));

export const generateNodeFlashcards = (
  workspaceId: string,
  nodeId: string,
  input: FlashcardGenerateInput
) => apiClient.post<Flashcard[]>(basePath(workspaceId, nodeId) + "/generate", input);

export const updateNodeFlashcard = (
  workspaceId: string,
  nodeId: string,
  cardId: string,
  input: FlashcardUpdateInput
) =>
  apiClient.patch<Flashcard>(
    basePath(workspaceId, nodeId) + "/" + encodeURIComponent(cardId),
    input
  );

export const deleteNodeFlashcard = (
  workspaceId: string,
  nodeId: string,
  cardId: string
) =>
  apiClient.delete<void>(
    basePath(workspaceId, nodeId) + "/" + encodeURIComponent(cardId)
  );
