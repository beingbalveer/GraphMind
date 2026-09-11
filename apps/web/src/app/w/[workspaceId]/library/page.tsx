/**
 * /w/{workspaceId}/library — Full-Page File Library & Knowledge Assets view.
 *
 * Rendered within the persistent WorkspaceShell by parent layout.tsx.
 * This page returns null to satisfy the Next.js App Router without re-mounting.
 */
export default function WorkspaceLibraryPage() {
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return {
    title: "File Library — GraphMind",
    description: `Manage and search multimodal documents, code, and datasets in workspace ${workspaceId}`,
  };
}
