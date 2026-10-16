import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const authState = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: authState.isAuthenticated }),
}));

const api = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock("@/lib/preferencesApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/preferencesApi")>(
    "@/lib/preferencesApi",
  );
  return { ...actual, ...api };
});

import { PreferencesProvider, usePreferences } from "../PreferencesContext";

function Consumer() {
  const { preferences, save } = usePreferences();
  return (
    <div>
      <span data-testid="theme">{preferences.theme}</span>
      <span data-testid="hours">{preferences.defaultStudyHours}</span>
      <button onClick={() => void save({ theme: "light" })}>set-light</button>
    </div>
  );
}

describe("PreferencesProvider", () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
    api.getPreferences.mockReset();
    api.updatePreferences.mockReset();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-reading-size");
    document.documentElement.removeAttribute("data-reduced-motion");
  });

  afterEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-reading-size");
    document.documentElement.removeAttribute("data-reduced-motion");
  });

  it("loads the account preferences and applies their rendered effects", async () => {
    api.getPreferences.mockResolvedValue({
      theme: "dark",
      readingFontSize: "lg",
      reducedMotion: true,
      defaultStudyHours: 6,
      tutorStyle: "detailed",
      version: 3,
      updatedAt: "2026-10-16T00:00:00Z",
    });

    render(
      <PreferencesProvider>
        <Consumer />
      </PreferencesProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"));
    expect(screen.getByTestId("hours")).toHaveTextContent("6");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-reading-size")).toBe("lg");
    expect(document.documentElement.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("saves with the loaded version and re-applies the updated preferences", async () => {
    api.getPreferences.mockResolvedValue({
      theme: "dark",
      readingFontSize: "md",
      reducedMotion: false,
      defaultStudyHours: 4,
      tutorStyle: "socratic",
      version: 2,
      updatedAt: "2026-10-16T00:00:00Z",
    });
    api.updatePreferences.mockResolvedValue({
      theme: "light",
      readingFontSize: "md",
      reducedMotion: false,
      defaultStudyHours: 4,
      tutorStyle: "socratic",
      version: 3,
      updatedAt: "2026-10-16T00:00:00Z",
    });

    render(
      <PreferencesProvider>
        <Consumer />
      </PreferencesProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"));
    fireEvent.click(screen.getByRole("button", { name: "set-light" }));

    await waitFor(() =>
      expect(api.updatePreferences).toHaveBeenCalledWith({
        theme: "light",
        version: 2,
      }),
    );
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("light"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applies approved defaults for guests without calling the API", async () => {
    authState.isAuthenticated = false;

    render(
      <PreferencesProvider>
        <Consumer />
      </PreferencesProvider>,
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("hours")).toHaveTextContent("4");
    expect(api.getPreferences).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute("data-reading-size")).toBe("md");
    expect(document.documentElement.getAttribute("data-reduced-motion")).toBe("false");
  });
});
