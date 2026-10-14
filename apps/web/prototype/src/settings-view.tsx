import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { DemoPreferences, DemoScenario } from "./state";

type Tab = "profile" | "appearance" | "learning" | "demo";
export function SettingsView({
  preferences,
  onChange,
  scenario,
  onScenarioChange,
  onExport,
  onResetRequest,
  roadmapCount,
  completedCount,
}: {
  preferences: DemoPreferences;
  onChange: (partial: Partial<DemoPreferences>) => void;
  scenario: DemoScenario;
  onScenarioChange: (scenario: DemoScenario) => void;
  onExport: () => void;
  onResetRequest: () => void;
  roadmapCount: number;
  completedCount: number;
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const [exported, setExported] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState(
    String(preferences.weeklyHours),
  );
  useEffect(
    () => setWeeklyHours(String(preferences.weeklyHours)),
    [preferences.weeklyHours],
  );
  const parsedHours = Number(weeklyHours);
  const hoursValid =
    Number.isInteger(parsedHours) && parsedHours >= 1 && parsedHours <= 40;
  const row =
    "flex flex-col gap-3 border-b border-border-subtle py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between";
  const title = "text-sm font-medium";
  const desc = "mt-1 text-sm leading-5 text-foreground-muted";
  return (
    <section
      className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10"
      aria-labelledby="settings-title"
    >
      <Badge variant="secondary">LEARNER SETTINGS</Badge>
      <h1 id="settings-title" className="mt-4 text-xl font-semibold">
        Settings
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Preferences for this local learning preview.
      </p>
      <div className="mt-6">
        <SegmentedTabs
          ariaLabel="Settings sections"
          value={tab}
          onChange={setTab}
          items={[
            { id: "profile", label: "Profile" },
            { id: "appearance", label: "Appearance" },
            { id: "learning", label: "Learning" },
            { id: "demo", label: "Demo data" },
          ]}
        />
      </div>
      <section className="mt-5 rounded-2xl border border-border-subtle bg-surface p-5">
        {tab === "profile" && (
          <>
            <h2 className={title}>Profile</h2>
            <p className={desc}>
              Your display name appears in the learning home greeting. The
              preview does not collect account details.
            </p>
            <div className={`${row} mt-3`}>
              <div>
                <label className={title} htmlFor="display-name">
                  Display name
                </label>
                <p className={desc}>Shown in your local learning experience.</p>
              </div>
              <Input
                id="display-name"
                className="sm:max-w-xs"
                value={preferences.displayName}
                maxLength={60}
                onChange={(e) => onChange({ displayName: e.target.value })}
              />
            </div>
            <p className="text-xs text-foreground-muted">
              This preview asks for no password, email address, payment details,
              or provider keys.
            </p>
          </>
        )}
        {tab === "appearance" && (
          <>
            <h2 className={title}>Appearance</h2>
            <p className={desc}>
              These choices apply immediately to the preview.
            </p>
            <div className={`${row} mt-3`}>
              <div>
                <p className={title}>Theme</p>
                <p className={desc}>Choose a theme or follow your device.</p>
              </div>
              <Select
                value={preferences.theme}
                onValueChange={(v) =>
                  onChange({ theme: String(v) as DemoPreferences["theme"] })
                }
              >
                <SelectTrigger className="sm:w-44" aria-label="Theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={row}>
              <div>
                <p className={title}>Reading size</p>
                <p className={desc}>
                  Large text increases lesson body copy size.
                </p>
              </div>
              <SegmentedTabs
                ariaLabel="Reading size"
                value={preferences.readingSize}
                onChange={(readingSize) => onChange({ readingSize })}
                items={[
                  { id: "standard", label: "Standard" },
                  { id: "large", label: "Large" },
                ]}
                size="sm"
              />
            </div>
            <div className={row}>
              <div>
                <p className={title}>Reduced motion</p>
                <p className={desc}>
                  Shortens transitions and removes nonessential movement.
                </p>
              </div>
              <Switch
                checked={preferences.reducedMotion}
                onCheckedChange={(reducedMotion) => onChange({ reducedMotion })}
                aria-label="Reduced motion"
              />
            </div>
          </>
        )}
        {tab === "learning" && (
          <>
            <h2 className={title}>Learning preferences</h2>
            <p className={desc}>
              Used as defaults in the generator and sample tutor.
            </p>
            <div className={`${row} mt-3`}>
              <div>
                <label className={title} htmlFor="weekly-hours">
                  Weekly study time
                </label>
                <p className={desc}>
                  Suggested hours per week for a new roadmap.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="weekly-hours"
                  type="number"
                  min={1}
                  max={40}
                  step={1}
                  className="w-24"
                  value={weeklyHours}
                  aria-invalid={!hoursValid}
                  onChange={(e) => {
                    setWeeklyHours(e.target.value);
                    const next = Number(e.target.value);
                    if (Number.isInteger(next) && next >= 1 && next <= 40)
                      onChange({ weeklyHours: next });
                  }}
                />
                <span className="text-sm text-foreground-muted">hours</span>
              </div>
              {!hoursValid && (
                <p role="alert" className="text-xs text-destructive">
                  Enter a whole number from 1 to 40 hours.
                </p>
              )}
            </div>
            <div className={row}>
              <div>
                <p className={title}>Tutor response style</p>
                <p className={desc}>
                  Step-by-step replies include a short explanation; concise
                  replies use fewer steps.
                </p>
              </div>
              <SegmentedTabs
                ariaLabel="Tutor response style"
                value={preferences.tutorStyle}
                onChange={(tutorStyle) => onChange({ tutorStyle })}
                items={[
                  { id: "concise", label: "Concise" },
                  { id: "step-by-step", label: "Step by step" },
                ]}
                size="sm"
              />
            </div>
          </>
        )}
        {tab === "demo" && (
          <>
            <h2 className={title}>Demo data</h2>
            <p className={desc}>
              Demo activity is stored locally in this browser and remains
              available after refresh. Signing out hides learner data while you
              browse as a guest.
            </p>
            <div className={`${row} mt-3`}>
              <div>
                <p className={title}>Next action scenario</p>
                <p className={desc}>
                  Choose a scripted case for the next matching action. It is
                  consumed once.
                </p>
              </div>
              <Select
                value={scenario}
                onValueChange={(v) =>
                  onScenarioChange(String(v) as DemoScenario)
                }
              >
                <SelectTrigger
                  className="sm:w-64"
                  aria-label="Next action scenario"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal flow</SelectItem>
                  <SelectItem value="generation-clarification">
                    Generator asks for clarification
                  </SelectItem>
                  <SelectItem value="generation-error">
                    Generator fails once
                  </SelectItem>
                  <SelectItem value="tutor-error">
                    Tutor request fails once
                  </SelectItem>
                  <SelectItem value="save-error">
                    Save request fails once
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={row}>
              <div>
                <p className={title}>Current sample data</p>
                <p className={desc}>
                  {roadmapCount} personal roadmaps · {completedCount} lessons
                  marked complete
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  onExport();
                  setExported(true);
                }}
              >
                Export demo data
              </Button>
            </div>
            {exported && (
              <p role="status" className="text-sm text-success">
                Export prepared for this demo.
              </p>
            )}
            <div className={row}>
              <div>
                <p className={title}>Reset preview</p>
                <p className={desc}>
                  Clear local learning progress, conversations, preferences, and
                  the selected scenario.
                </p>
              </div>
              <Button variant="destructive" onClick={onResetRequest}>
                Reset demo
              </Button>
            </div>
            <div className="rounded-xl bg-background-secondary p-4">
              <h3 className="text-sm font-medium">Storage and privacy</h3>
              <p className="mt-1 text-sm leading-5 text-foreground-muted">
                This prototype stores sample state in this browser. Sign out
                returns to guest browsing and hides the stored learner data.
              </p>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
