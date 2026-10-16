"use client";

/**
 * PreferencesProvider (LSI-044) — loads the authenticated account's persisted
 * preferences, applies their visible effects to the document root, and exposes
 * a `save()` that performs an optimistic-concurrency update.
 *
 * The default context value is safe (approved defaults + no-op save) so
 * components and tests can call `usePreferences()` outside the provider.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { applyPreferences } from "@/lib/applyPreferences";
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  updatePreferences,
  type UserPreferences,
  type UserPreferencesUpdate,
} from "@/lib/preferencesApi";

export interface PreferencesContextValue {
  preferences: UserPreferences;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  save: (patch: UserPreferencesUpdate) => Promise<void>;
  reload: () => Promise<void>;
}

const defaultContextValue: PreferencesContextValue = {
  preferences: DEFAULT_PREFERENCES,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  save: async () => {},
  reload: async () => {},
};

const PreferencesContext =
  createContext<PreferencesContextValue>(defaultContextValue);

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setPreferences(DEFAULT_PREFERENCES);
      setError(null);
      return;
    }
    setIsLoading(true);
    try {
      const loaded = await getPreferences();
      setPreferences(loaded);
      setError(null);
    } catch {
      setError("Could not load your preferences.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Apply visible effects; re-apply when the OS color scheme changes.
  useEffect(() => {
    applyPreferences(preferences, document.documentElement, prefersDark());
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () =>
      applyPreferences(preferences, document.documentElement, media.matches);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [preferences]);

  const save = useCallback(
    async (patch: UserPreferencesUpdate) => {
      if (!isAuthenticated) return;
      setIsLoading(true);
      try {
        const next = await updatePreferences({
          ...patch,
          version: preferences.version,
        });
        setPreferences(next);
        setError(null);
      } catch (err) {
        setError("Could not save your preferences.");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, preferences.version],
  );

  const value = useMemo(
    () => ({ preferences, isAuthenticated, isLoading, error, save, reload }),
    [preferences, isAuthenticated, isLoading, error, save, reload],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
