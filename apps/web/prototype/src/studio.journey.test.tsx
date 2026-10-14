import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { LearningStudio } from "./studio";

beforeEach(() => {
  Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => Boolean(key) && key!.startsWith("graphmind-studio-"))
    .forEach((key) => localStorage.removeItem(key));
});

describe("public-to-learner journeys", () => {
  it("lets a guest browse and read a public lesson without opening the sign-in gate", async () => {
    const user = userEvent.setup();
    render(<LearningStudio />);
    await user.click(
      screen.getAllByRole("button", { name: "View roadmap" })[0],
    );
    await user.click(screen.getByRole("button", { name: "Read first lesson" }));
    expect(screen.getByText(/Public lesson preview/)).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Demo sign in" })).toBeNull();
  });
  it("saves the selected public roadmap after demo sign-in", async () => {
    const user = userEvent.setup();
    render(<LearningStudio />);
    await user.click(
      screen.getAllByRole("button", { name: "View roadmap" })[0],
    );
    await user.click(
      screen.getByRole("button", { name: "Save to My learning" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue as demo learner" }),
    );
    expect(screen.getByRole("heading", { name: "My learning" })).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "Python foundations for backend work",
      }),
    ).toBeTruthy();
  });
});

describe("gated tutor and generator journeys", () => {
  it("keeps a selected public passage through simulated sign-in and opens the topic tutor", async () => {
    const user = userEvent.setup();
    render(<LearningStudio />);
    await user.click(
      screen.getAllByRole("button", { name: "View roadmap" })[0],
    );
    await user.click(screen.getByRole("button", { name: "Read first lesson" }));
    const paragraph = screen.getByText(/A Python program is a sequence/);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    await user.click(
      screen.getByRole("button", { name: "Ask about selected passage" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Continue as a demo learner" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Continue as demo learner" }),
    );
    expect(await screen.findByText("Selected passage")).toBeTruthy();
    expect(
      screen.getAllByText(/A Python program is a sequence/).length,
    ).toBeGreaterThan(0);
    await user.click(
      screen.getByRole("button", { name: "Open full conversation" }),
    );
    expect(
      screen.getByRole("textbox", {
        name: "Write a message in this lesson conversation",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Selected passage")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Remove quoted passage" }),
    );
    expect(screen.queryByText("Selected passage")).toBeNull();
  });

  it("preserves generator edits across review and creates a distinct personal copy", async () => {
    const user = userEvent.setup();
    render(<LearningStudio />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(
      screen.getByRole("button", { name: "Continue as demo learner" }),
    );
    await user.click(
      screen.getAllByRole("button", { name: "Create roadmap" })[0],
    );
    expect(screen.getByRole("tablist", { name: "Current level" })).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /Python foundations for backend work/,
      }),
    ).toBeTruthy();
    await user.type(
      screen.getByPlaceholderText("e.g. Build my first API"),
      "Build a weather API",
    );
    await user.type(
      screen.getByPlaceholderText("What do you want to learn and why?"),
      "Learn how to build a small weather API",
    );
    await user.click(screen.getByRole("button", { name: "Add background and planning details" }));
    const outcomeInput = screen.getByPlaceholderText("What should you be able to do?");
    await user.clear(outcomeInput);
    await user.type(outcomeInput, "Deploy an API with a clear health endpoint");
    await user.click(
      screen.getByRole("button", { name: "Review roadmap details" }),
    );
    expect(screen.getByText(/Build a weather API/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back and edit" }));
    expect(
      (
        screen.getByPlaceholderText(
          "What should you be able to do?",
        ) as HTMLInputElement
      ).value,
    ).toBe("Deploy an API with a clear health endpoint");
    await user.click(
      screen.getByRole("button", { name: "Review roadmap details" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Start demo generation" }),
    );
    await user.click(
      await screen.findByRole(
        "button",
        { name: "Show collection" },
        { timeout: 3000 },
      ),
    );
    expect(
      screen.getByRole("heading", { name: "Build a weather API" }),
    ).toBeTruthy();
  });
});

it("filters My learning by completion state", async () => {
  const user = userEvent.setup();
  render(<LearningStudio />);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await user.click(
    screen.getByRole("button", { name: "Continue as demo learner" }),
  );
  await user.click(
    screen.getAllByRole("button", { name: "Browse roadmaps" })[0],
  );
  await user.click(screen.getAllByRole("button", { name: "View roadmap" })[0]);
  await user.click(screen.getByRole("button", { name: "Save to My learning" }));
  expect(
    screen.getByRole("heading", {
      name: "Python foundations for backend work",
    }),
  ).toBeTruthy();
  await user.click(screen.getByRole("tab", { name: "Completed" }));
  expect(screen.getByText("No matching roadmaps")).toBeTruthy();
  await user.click(screen.getByRole("tab", { name: "Not started" }));
  expect(
    screen.getByRole("heading", {
      name: "Python foundations for backend work",
    }),
  ).toBeTruthy();
});

it("lets a signed-in learner track a public lesson without a second sign-in dialog", async () => {
  const user = userEvent.setup();
  render(<LearningStudio />);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await user.click(
    screen.getByRole("button", { name: "Continue as demo learner" }),
  );
  await user.click(
    screen.getAllByRole("button", { name: "Browse roadmaps" })[0],
  );
  await user.click(screen.getAllByRole("button", { name: "View roadmap" })[0]);
  await user.click(screen.getByRole("button", { name: "Read first lesson" }));
  await user.click(screen.getByRole("button", { name: "Track progress" }));
  expect(
    screen.queryByRole("dialog", { name: "Continue as a demo learner" }),
  ).toBeNull();
});

it("resumes the roadmap shown on Home when a learner has multiple enrollments", async () => {
  const user = userEvent.setup();
  render(<LearningStudio />);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await user.click(
    screen.getByRole("button", { name: "Continue as demo learner" }),
  );
  await user.click(
    screen.getAllByRole("button", { name: "Browse roadmaps" })[0],
  );
  await user.click(screen.getAllByRole("button", { name: "View roadmap" })[0]);
  await user.click(screen.getByRole("button", { name: "Save to My learning" }));
  await user.click(
    screen.getAllByRole("button", { name: "Browse roadmaps" })[0],
  );
  await user.click(screen.getAllByRole("button", { name: "View roadmap" })[1]);
  await user.click(screen.getByRole("button", { name: "Save to My learning" }));
  await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
  expect(
    screen.getByRole("heading", { name: "Accessible web foundations" }),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Continue learning" }));
  expect(
    screen.getByRole("heading", {
      name: "Give content a meaningful structure",
    }),
  ).toBeTruthy();
});
