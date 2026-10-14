import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneratorFlow } from "./generator-flow";
import { SettingsView } from "./settings-view";
import {
  blankProfile,
  defaultPreferences,
  type GeneratorProfile,
  type DemoScenario,
} from "./state";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function setupGenerator(scenario: DemoScenario = "normal") {
  const onCreate = vi.fn();
  const onScenarioConsumed = vi.fn();
  const onProfile = vi.fn();
  const profile: GeneratorProfile = {
    ...blankProfile,
    title: "Build a weather API",
    prompt: "Learn how to build a small weather API",
    outcome: "Deploy one tested service",
    hoursPerWeek: 4,
    duration: 6,
  };
  const props = {
    profile,
    selectedTemplate: "roadmap-python-backend",
    onProfile,
    onTemplate: vi.fn(),
    onCreate,
    scenario,
    onScenarioConsumed,
    onStartLearning: vi.fn(),
    onShowCollection: vi.fn(),
  };
  const view = render(<GeneratorFlow {...props} />);
  return {
    view,
    onCreate,
    onScenarioConsumed,
    onProfile,
    normalProps: { ...props, scenario: "normal" as const },
  };
}
function ControlledGenerator() {
  const [profile, setProfile] = useState({
    ...blankProfile,
    prompt: "Build a SQL dashboard",
  });
  return (
    <GeneratorFlow
      profile={profile}
      selectedTemplate="roadmap-python-backend"
      onProfile={(field, value) =>
        setProfile((current) => ({ ...current, [field]: value }))
      }
      onTemplate={() => {}}
      onCreate={() => {}}
      scenario="normal"
      onScenarioConsumed={() => {}}
      onStartLearning={() => {}}
      onShowCollection={() => {}}
    />
  );
}
async function reviewAndStart() {
  fireEvent.click(
    screen.getByRole("button", { name: /review roadmap details/i }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /start demo generation/i }),
  );
}

describe("generator product flow", () => {
  it("validates required title, goal, outcome, typed pace, and accessible field names", async () => {
    const onProfile = vi.fn();
    render(
      <GeneratorFlow
        profile={{
          ...blankProfile,
          title: "x",
          prompt: "short",
          outcome: "no",
        }}
        selectedTemplate="roadmap-python-backend"
        onProfile={onProfile}
        onTemplate={vi.fn()}
        onCreate={vi.fn()}
        scenario="normal"
        onScenarioConsumed={vi.fn()}
        onStartLearning={vi.fn()}
        onShowCollection={vi.fn()}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: /review roadmap details/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByLabelText("Optional roadmap title")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Learning goal"), {
      target: { value: "short enough context" },
    });
    expect(onProfile).toHaveBeenCalledWith("prompt", "short enough context");
  });
  it("creates one personal copy after progressive phases with submitted profile intact", async () => {
    vi.useFakeTimers();
    const { onCreate } = setupGenerator();
    await reviewAndStart();
    expect(onCreate).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      title: "Build a weather API",
      outcome: "Deploy one tested service",
      hoursPerWeek: 4,
      duration: 6,
    });
    expect(
      screen.getByText("Learn how to build a small weather API"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start learning" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Show collection" }),
    ).toBeTruthy();
  });
  it("accepts a goal without a title or outcome and supplies practical defaults", async () => {
    const onProfile = vi.fn();
    render(
      <GeneratorFlow
        profile={{ ...blankProfile, prompt: "Learn to build a small API" }}
        selectedTemplate="roadmap-python-backend"
        onProfile={onProfile}
        onTemplate={vi.fn()}
        onCreate={vi.fn()}
        scenario="normal"
        onScenarioConsumed={vi.fn()}
        onStartLearning={vi.fn()}
        onShowCollection={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /review roadmap details/i }),
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Learn to build a small API",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Be able to build a small API")).toBeTruthy();
    expect(onProfile).toHaveBeenCalledWith(
      "title",
      "Learn to build a small API",
    );
    expect(onProfile).toHaveBeenCalledWith(
      "outcome",
      "Be able to build a small API",
    );
  });
  it("refreshes only auto-derived title and outcome when the goal changes", () => {
    render(<ControlledGenerator />);
    fireEvent.click(
      screen.getByRole("button", { name: /review roadmap details/i }),
    );
    expect(screen.getByText("Be able to build a SQL dashboard")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back and edit" }));
    fireEvent.change(screen.getByLabelText("Learning goal"), {
      target: { value: "Create a query explorer" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /review roadmap details/i }),
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Create a query explorer",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Be able to create a query explorer")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back and edit" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /add background and planning details/i,
      }),
    );
    fireEvent.change(screen.getByLabelText("Optional desired outcome"), {
      target: { value: "Ship a reviewed tool" },
    });
    fireEvent.change(screen.getByLabelText("Learning goal"), {
      target: { value: "Design a new query interface" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /review roadmap details/i }),
    );
    expect(screen.getByText("Ship a reviewed tool")).toBeTruthy();
  });
  it("asks one follow-up and resumes the same profile", async () => {
    vi.useFakeTimers();
    const { onCreate, onScenarioConsumed } = setupGenerator(
      "generation-clarification",
    );
    await reviewAndStart();
    expect(
      screen.getByText(/what would make this outcome useful/i),
    ).toBeTruthy();
    expect(onScenarioConsumed).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Clarification answer"), {
      target: { value: "Ship a working endpoint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue to review" }));
    expect(
      screen.getByText("Clarification: Ship a working endpoint"),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Start demo generation" }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0].background).toContain(
      "Clarification: Ship a working endpoint",
    );
  });
  it("keeps profile on a scripted failure and retries with a fresh successful run", async () => {
    vi.useFakeTimers();
    const { onCreate, view, normalProps } = setupGenerator("generation-error");
    await reviewAndStart();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "Generation failed",
    );
    expect(onCreate).not.toHaveBeenCalled();
    const editedProfile = {
      ...normalProps.profile,
      title: "Build a keyboard accessible form",
      prompt: "Build an accessible keyboard-first form flow",
      outcome: "Be able to build an accessible form",
    };
    view.rerender(<GeneratorFlow {...normalProps} profile={editedProfile} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Accessible web foundations/i }),
    );
    view.rerender(
      <GeneratorFlow
        {...normalProps}
        profile={editedProfile}
        selectedTemplate="roadmap-web-accessibility"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry generation" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0].prompt).toBe(
      "Build an accessible keyboard-first form flow",
    );
    expect(onCreate.mock.calls[0][1]).toBe("roadmap-web-accessibility");
  });
  it("cancels timers without publishing a stale completion", async () => {
    vi.useFakeTimers();
    const { onCreate } = setupGenerator();
    await reviewAndStart();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });
    fireEvent.click(
      screen.getByRole("button", { name: /cancel demo generation/i }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText("Build a weather API")).toBeTruthy();
  });
});

describe("settings effects", () => {
  it("exposes preference, scenario, export, and confirmed reset actions", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn(),
      onScenarioChange = vi.fn(),
      onExport = vi.fn(),
      onResetRequest = vi.fn();
    render(
      <SettingsView
        preferences={defaultPreferences}
        onChange={onChange}
        scenario="normal"
        onScenarioChange={onScenarioChange}
        onExport={onExport}
        onResetRequest={onResetRequest}
        roadmapCount={2}
        completedCount={3}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    await user.click(screen.getByRole("switch", { name: "Reduced motion" }));
    expect(onChange).toHaveBeenCalledWith({ reducedMotion: true });
    await user.click(screen.getByRole("tab", { name: "Learning" }));
    expect(screen.getByRole("tab", { name: "Step by step" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Weekly study time"), {
      target: { value: "0" },
    });
    expect(screen.getByRole("alert").textContent).toContain("1 to 40");
    expect(onChange).not.toHaveBeenCalledWith({ weeklyHours: 0 });
    fireEvent.change(screen.getByLabelText("Weekly study time"), {
      target: { value: "6" },
    });
    expect(onChange).toHaveBeenCalledWith({ weeklyHours: 6 });
    await user.click(screen.getByRole("tab", { name: "Demo data" }));
    expect(screen.getByText(/2 personal roadmaps · 3 lessons/i)).toBeTruthy();
    await user.click(
      screen.getByRole("combobox", { name: "Next action scenario" }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Generator fails once" }),
    );
    expect(onScenarioChange).toHaveBeenCalledWith("generation-error");
    await user.click(screen.getByRole("button", { name: "Export demo data" }));
    expect(onExport).toHaveBeenCalled();
    expect((await screen.findByRole("status")).textContent).toContain(
      "Export prepared",
    );
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(onResetRequest).toHaveBeenCalledTimes(1);
  });
});
