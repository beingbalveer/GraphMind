import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { RoadmapImportModal } from "../RoadmapImportModal";
import * as api from "@/lib/roadmapImportApi";

const mock = vi.hoisted(() => ({
  push: vi.fn(),
  fields: [] as api.RoadmapImportField[],
  response: {
    results: [] as api.RoadmapImportResultItem[],
    errors: [] as api.RoadmapImportError[],
  } as api.RoadmapImportResponse,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mock.push }),
}));
vi.mock("@/lib/roadmapImportApi", () => ({
  listRoadmapImportFields: vi.fn(),
  createRoadmapImports: vi.fn(),
}));

const FIELDS: api.RoadmapImportField[] = [
  { slug: "devops", title: "DevOps Roadmap", url: "https://roadmap.sh/devops", topicCount: 140 },
  { slug: "ai-engineer", title: "AI Engineer Roadmap", url: "https://roadmap.sh/ai-engineer", topicCount: 194 },
  { slug: "frontend", title: "Frontend Roadmap", url: "https://roadmap.sh/frontend", topicCount: 121 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mock.push.mockReset();
  mock.response = { results: [], errors: [] };
  vi.mocked(api.listRoadmapImportFields).mockResolvedValue(FIELDS);
  vi.mocked(api.createRoadmapImports).mockImplementation(async () => mock.response);
});

it("lists curated fields with toggles for selection", async () => {
  render(<RoadmapImportModal isOpen onClose={vi.fn()} />);

  expect(
    await screen.findByRole("heading", { name: "Browse curated roadmaps" }),
  ).toBeVisible();
  expect(screen.getByText("DevOps Roadmap")).toBeVisible();
  expect(screen.getByText("194 topics · self-paced")).toBeVisible();

  const devopsSwitch = screen.getByRole("switch", { name: /DevOps Roadmap/ });
  expect(devopsSwitch).toBeChecked();

  await userEvent.click(devopsSwitch);
  expect(devopsSwitch).not.toBeChecked();
  // All fields are selected initially; toggling one off leaves 2 of 3.
  expect(screen.getByText("2 of 3 selected · imported as new workspaces")).toBeVisible();
});

it("imports the selected fields and navigates to the created workspace", async () => {
  mock.response = {
    results: [
      {
        slug: "devops",
        title: "DevOps Roadmap",
        status: "created",
        workspaceId: "ws_abc123",
        roadmapId: "roadmap_1",
        revisionId: "rev_1",
        topicCount: 139,
      },
    ],
    errors: [],
  };
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const onClose = vi.fn();
  render(<RoadmapImportModal isOpen onClose={onClose} />);
  await screen.findByText("DevOps Roadmap");

  await user.click(screen.getByRole("button", { name: /^Import 3 roadmaps$/ }));
  await waitFor(() => expect(api.createRoadmapImports).toHaveBeenCalledWith(["devops", "ai-engineer", "frontend"]));

  expect(screen.getByRole("button", { name: "Go to my workspace" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Go to my workspace" }));
  expect(onClose).toHaveBeenCalled();
  expect(mock.push).toHaveBeenCalledWith("/w/ws_abc123");
});

it("surfaces errors when nothing could be imported", async () => {
  mock.response = {
    results: [],
    errors: [{ slug: "devops", error: "ROADMAP_SH_INVALID: no topics" }],
  };
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<RoadmapImportModal isOpen onClose={vi.fn()} />);
  await screen.findByText("DevOps Roadmap");

  await user.click(screen.getByRole("button", { name: /^Import 3 roadmaps$/ }));

  expect(await screen.findByText("ROADMAP_SH_INVALID: no topics")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Go to my workspace" })).not.toBeInTheDocument();
});

it("shows a loading state and then the fields; failures render inline feedback", async () => {
  vi.mocked(api.listRoadmapImportFields).mockRejectedValue(new Error("Network down"));
  render(<RoadmapImportModal isOpen onClose={vi.fn()} />);
  expect(await screen.findByText("Network down")).toBeVisible();
  expect(screen.queryByText("DevOps Roadmap")).not.toBeInTheDocument();
});