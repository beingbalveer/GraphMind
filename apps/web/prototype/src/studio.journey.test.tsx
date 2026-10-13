import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LearningStudio } from "./studio";

describe("learning studio rendered journey", () => {
  it("keeps the current-topic composer and reply after expanding, then returns to the same reading position", async () => {
    const user = userEvent.setup();
    render(<LearningStudio />);

    await user.click(
      screen.getByRole("button", { name: /continue learning/i }),
    );
    const main = document.querySelector("main")!;
    main.scrollTop = 79;
    fireEvent.scroll(main);

    await user.click(screen.getByRole("button", { name: "Tutor" }));
    await user.type(
      screen.getByRole("textbox", { name: "Ask a question about this lesson" }),
      "Why use a named function?",
    );
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(
      await screen.findByText(/Sample tutor reply: In Python foundations/),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Open full conversation" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "Python foundations for backend work",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Why use a named function?")).toBeTruthy();
    await user.type(
      screen.getByRole("textbox", {
        name: "Write a message in this lesson conversation",
      }),
      "One more question",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByText("One more question")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Return to lesson" }));
    await waitFor(() => expect(main.scrollTop).toBe(79));
  });

  it("offers all four navigation areas and resets local progress from the mobile navigation drawer", async () => {
    const user = userEvent.setup();
    render(<LearningStudio />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Dark appearance" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset demo" })).toBeTruthy();
  });
});

it("keeps drafts with each lesson conversation and clears them when the demo resets", async () => {
  const user = userEvent.setup();
  render(<LearningStudio />);
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  await user.click(screen.getByRole("button", { name: "Conversations" }));
  const composer = () =>
    screen.getByRole("textbox", {
      name: "Write a message in this lesson conversation",
    });
  await user.type(composer(), "Draft for Python");
  await user.click(
    screen.getByRole("button", { name: "Shape data with types and models" }),
  );
  expect((composer() as HTMLTextAreaElement).value).toBe("");
  await user.type(composer(), "Draft for Pydantic");
  await user.click(
    screen.getByRole("button", { name: "Python foundations for backend work" }),
  );
  expect((composer() as HTMLTextAreaElement).value).toBe("Draft for Python");

  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  await user.click(screen.getByRole("button", { name: "Reset demo" }));
  await user.click(screen.getByRole("button", { name: /continue learning/i }));
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  await user.click(screen.getByRole("button", { name: "Conversations" }));
  expect((composer() as HTMLTextAreaElement).value).toBe("");
});

it("offers passage selection and carries a removable quote into the expanded conversation", async () => {
  const user = userEvent.setup();
  render(<LearningStudio />);
  await user.click(screen.getByRole("button", { name: /continue learning/i }));
  const paragraph = screen.getByText(/A Python program is a sequence/);
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  await user.click(
    screen.getByRole("button", { name: "Ask about selected text" }),
  );
  expect(
    (await screen.findAllByText(/A Python program is a sequence/)).length,
  ).toBe(2);
  await user.click(
    screen.getByRole("button", { name: "Open full conversation" }),
  );
  expect(screen.getAllByText(/A Python program is a sequence/).length).toBe(1);
  await user.click(
    screen.getByRole("button", { name: "Remove quoted passage" }),
  );
  expect(screen.queryByText(/A Python program is a sequence/)).toBeNull();
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  await user.click(screen.getByRole("button", { name: "Reset demo" }));
  await user.click(screen.getByRole("button", { name: /continue learning/i }));
  await user.click(screen.getByRole("button", { name: "Tutor" }));
  expect(screen.queryByText("Selected passage")).toBeNull();
});
