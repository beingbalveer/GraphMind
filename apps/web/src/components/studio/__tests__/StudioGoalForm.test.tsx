import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudioGoalForm } from "../StudioGoalForm";
import { APPROVED_SAMPLE_TEMPLATES } from "@/lib/generatorProfile";

function openDetails() {
  fireEvent.click(
    screen.getByRole("button", { name: /Background and planning details/i }),
  );
}

describe("StudioGoalForm (LSI-021)", () => {
  it("maps real inputs onto the extended request and shows an immutable submitted profile", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<StudioGoalForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Learning goal"), {
      target: { value: "I want to learn to build a small API" },
    });
    fireEvent.change(screen.getByLabelText(/Roadmap title/), {
      target: { value: "API Basics" },
    });
    openDetails();
    fireEvent.change(screen.getByLabelText(/Desired outcome/), {
      target: { value: "Deploy one tested endpoint" },
    });
    fireEvent.change(screen.getByLabelText("Known skills"), {
      target: { value: "Python" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText(/Reference URL/), {
      target: { value: "https://example.com/syllabus" },
    });
    fireEvent.change(screen.getByLabelText("Hours per week"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("Duration in weeks"), {
      target: { value: "8" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Review details" }));

    // Review shows exactly the submitted snapshot and no editable controls.
    const review = screen.getByTestId("studio-goal-form-review");
    expect(review).toHaveTextContent("API Basics");
    expect(review).toHaveTextContent("Deploy one tested endpoint");
    expect(review).toHaveTextContent("Python");
    expect(review).toHaveTextContent("New generation");
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Generate roadmap" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "API Basics",
        prompt: "I want to learn to build a small API",
        level: "beginner",
        outcome: "Deploy one tested endpoint",
        knownSkills: ["Python"],
        referenceUrl: "https://example.com/syllabus",
        sampleTemplateRef: null,
        hoursPerWeek: 6,
        duration: { value: 8, unit: "weeks" },
      }),
      expect.objectContaining({ sampleTemplateRef: "" }),
    );
  });

  it("keeps the edited profile and submitted snapshot when submission fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Service unavailable"));
    render(<StudioGoalForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Learning goal"), {
      target: { value: "Learn to write reliable integration tests" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review details" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate roadmap" }));

    expect(await screen.findByText("Service unavailable")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Back and edit" }));
    expect(screen.getByLabelText("Learning goal")).toHaveValue(
      "Learn to write reliable integration tests",
    );
  });

  it("blocks review until the goal meets the bounds", () => {
    render(<StudioGoalForm onSubmit={vi.fn()} />);
    const review = screen.getByRole("button", { name: "Review details" });
    expect(review).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Learning goal"), {
      target: { value: "short" },
    });
    expect(screen.getByText(/at least 10 characters/i)).toBeVisible();
    expect(review).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Learning goal"), {
      target: { value: "Learn enough to build a small service" },
    });
    expect(review).toBeEnabled();
  });

  it("keeps the sample-copy path separate and optional for real generation", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<StudioGoalForm onSubmit={onSubmit} />);

    // Real generation needs no sample at all.
    expect(screen.queryByTestId("studio-goal-form-samples")).toBeNull();
    fireEvent.change(screen.getByLabelText("Learning goal"), {
      target: { value: "Learn relational query planning" },
    });
    expect(screen.getByRole("button", { name: "Review details" })).toBeEnabled();

    // The sample-copy path is a distinct mode with its own approved list.
    fireEvent.click(screen.getByRole("tab", { name: "Copy a sample roadmap" }));
    expect(screen.getByTestId("studio-goal-form-samples")).toBeVisible();
    expect(screen.getByRole("button", { name: "Review details" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /SQL Queries/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review details" }));

    expect(screen.getByText("Sample copy")).toBeVisible();
    expect(screen.getByText(/SQL Queries · fixed sample lessons/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Copy sample roadmap" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].sampleTemplateRef).toBe(
      APPROVED_SAMPLE_TEMPLATES[2].ref,
    );
    expect(onSubmit.mock.calls[0][0].prompt).toBe("Learn relational query planning");
  });

  it("seeds a blank form from approved preference defaults", () => {
    render(
      <StudioGoalForm
        defaults={{ level: "advanced", hoursPerWeek: 10, durationWeeks: 12 }}
        onSubmit={vi.fn()}
      />,
    );
    openDetails();
    expect(screen.getByLabelText("Hours per week")).toHaveValue(10);
    expect(screen.getByLabelText("Duration in weeks")).toHaveValue(12);
    expect(
      screen.getByRole("tab", { name: "Advanced" }),
    ).toHaveAttribute("data-active");
  });
});
