"use client";

import React, { useId, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  Copy,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  APPROVED_SAMPLE_TEMPLATES,
  BACKGROUND_MAX_LENGTH,
  DURATION_WEEKS_MAX,
  DURATION_WEEKS_MIN,
  GOAL_MAX_LENGTH,
  HOURS_MAX,
  HOURS_MIN,
  KNOWN_SKILLS_MAX,
  KNOWN_SKILL_MAX_LENGTH,
  OUTCOME_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type GeneratorPreferences,
  type GeneratorProfile,
  type SampleTemplateOption,
  buildRoadmapRequest,
  createBlankProfile,
  deriveProfileDefaults,
  validateProfile,
} from "@/lib/generatorProfile";
import { cn } from "@/lib/utils";
import type { RoadmapRequest } from "@/lib/roadmapTypes";

type GoalFormMode = "generate" | "sample";
type GoalFormStep = "form" | "review";

export interface StudioGoalFormProps {
  /** Approved preference defaults (e.g. stored study hours) seeding a blank form. */
  defaults?: Partial<GeneratorPreferences> | null;
  /** Optional pre-filled draft; otherwise an approved-default blank profile. */
  initialProfile?: GeneratorProfile;
  /** Approved sample-copy options; defaults to the LSI-020 curated allowlist. */
  samples?: SampleTemplateOption[];
  /** Called with the mapped request and the immutable submitted snapshot. */
  onSubmit: (
    request: RoadmapRequest,
    profile: GeneratorProfile,
  ) => void | Promise<void>;
  className?: string;
}

/**
 * StudioGoalForm (LSI-021) — production goal form and profile review.
 *
 * Maps real inputs onto the LSI-020 `RoadmapRequest` extensions, validates them
 * against the server bounds, and shows an immutable review of the submitted
 * profile. Real generation no longer requires a fixed sample: the sample-copy
 * path is a clearly separate mode. A failed submission keeps the learner's
 * edits and the submitted snapshot intact.
 */
export function StudioGoalForm({
  defaults,
  initialProfile,
  samples = APPROVED_SAMPLE_TEMPLATES,
  onSubmit,
  className,
}: StudioGoalFormProps) {
  const fieldId = useId();
  const [profile, setProfile] = useState<GeneratorProfile>(
    () => initialProfile ?? createBlankProfile(defaults),
  );
  const [mode, setMode] = useState<GoalFormMode>("generate");
  const [step, setStep] = useState<GoalFormStep>("form");
  const [submitted, setSubmitted] = useState<GeneratorProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalTouched, setGoalTouched] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");

  const validation = useMemo(() => validateProfile(profile), [profile]);
  const selectedSample = samples.find(
    (sample) => sample.ref === profile.sampleTemplateRef.trim(),
  );
  const sampleReady = mode === "generate" || Boolean(selectedSample);
  const canReview = validation.valid && sampleReady;
  const displayed = submitted ?? profile;
  const card = "rounded-2xl border border-border-subtle bg-surface p-5";

  const edit = <K extends keyof GeneratorProfile>(
    field: K,
    value: GeneratorProfile[K],
  ) => setProfile((current) => ({ ...current, [field]: value }));

  const changeMode = (next: GoalFormMode) => {
    setMode(next);
    setStep("form");
    setSubmitted(null);
    setError(null);
    if (next === "generate") edit("sampleTemplateRef", "");
  };

  const addSkill = () => {
    const value = skillDraft.trim();
    if (!value) return;
    setProfile((current) =>
      current.knownSkills.includes(value)
        ? current
        : { ...current, knownSkills: [...current.knownSkills, value] },
    );
    setSkillDraft("");
  };

  const review = () => {
    if (!canReview) return;
    setGoalTouched(true);
    const snapshot = deriveProfileDefaults(profile);
    setProfile(snapshot);
    setSubmitted(snapshot);
    setError(null);
    setStep("review");
  };

  const backToEdit = () => {
    setStep("form");
    setError(null);
  };

  const confirm = async () => {
    const snapshot = submitted ?? deriveProfileDefaults(profile);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(buildRoadmapRequest(snapshot), snapshot);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not start generation. Your details are still here.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      data-testid="studio-goal-form"
      aria-labelledby="studio-goal-form-title"
      className={cn(
        "mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10",
        className,
      )}
    >
      <Badge variant="secondary">New roadmap</Badge>
      <h1
        id="studio-goal-form-title"
        className="mt-4 break-words text-xl font-semibold"
      >
        Create a focused roadmap
      </h1>
      <p className="mt-2 text-sm leading-6 text-foreground-muted">
        Describe your goal and pace. Real generation studies your goal; copying an
        approved sample is a separate path.
      </p>

      <div className="mt-6">
        <SegmentedTabs<GoalFormMode>
          ariaLabel="Roadmap creation path"
          value={mode}
          onChange={changeMode}
          items={[
            { id: "generate", label: "Generate from my goal" },
            { id: "sample", label: "Copy a sample roadmap" },
          ]}
        />
      </div>

      {step === "form" ? (
        <div className="mt-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-background-secondary p-4 text-sm"
            >
              <strong className="text-destructive">Could not continue.</strong>
              <p className="mt-1 text-foreground-muted">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor={`${fieldId}-goal`}
              className="block text-sm font-medium"
            >
              Learning goal
            </label>
            <Textarea
              id={`${fieldId}-goal`}
              value={profile.goal}
              maxLength={GOAL_MAX_LENGTH}
              required
              placeholder="What do you want to learn and why?"
              invalid={goalTouched && Boolean(validation.errors.goal)}
              errorMessage={goalTouched ? validation.errors.goal : undefined}
              onChange={(e) => {
                setGoalTouched(true);
                edit("goal", e.target.value);
              }}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`${fieldId}-title`}
              className="block text-sm font-medium"
            >
              Roadmap title{" "}
              <span className="font-normal text-foreground-muted">
                · optional
              </span>
            </label>
            <Input
              id={`${fieldId}-title`}
              value={profile.title}
              maxLength={TITLE_MAX_LENGTH}
              placeholder="e.g. Build my first API"
              invalid={Boolean(validation.errors.title)}
              errorMessage={validation.errors.title}
              onChange={(e) => edit("title", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <span
              id={`${fieldId}-level-label`}
              className="block text-sm font-medium"
            >
              Current level
            </span>
            <SegmentedTabs
              ariaLabel="Current level"
              value={profile.level}
              size="sm"
              onChange={(value) =>
                edit("level", value as GeneratorProfile["level"])
              }
              items={[
                { id: "beginner", label: "Beginner" },
                { id: "intermediate", label: "Intermediate" },
                { id: "advanced", label: "Advanced" },
              ]}
            />
          </div>

          <Collapsible className="rounded-xl border border-border-subtle bg-background-secondary p-4">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between px-0"
              >
                Background and planning details
                <ChevronDown className="size-4 text-foreground-muted" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-5 pt-4">
              <div className="space-y-2">
                <label
                  htmlFor={`${fieldId}-outcome`}
                  className="block text-sm font-medium"
                >
                  Desired outcome{" "}
                  <span className="font-normal text-foreground-muted">
                    · optional
                  </span>
                </label>
                <Input
                  id={`${fieldId}-outcome`}
                  value={profile.outcome}
                  maxLength={OUTCOME_MAX_LENGTH}
                  placeholder="What should you be able to do?"
                  invalid={Boolean(validation.errors.outcome)}
                  errorMessage={validation.errors.outcome}
                  onChange={(e) => edit("outcome", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${fieldId}-skill`}
                  className="block text-sm font-medium"
                >
                  Known skills
                </label>
                <div className="flex gap-2">
                  <Input
                    id={`${fieldId}-skill`}
                    value={skillDraft}
                    maxLength={KNOWN_SKILL_MAX_LENGTH}
                    placeholder="A skill you already have"
                    onChange={(e) => setSkillDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!skillDraft.trim()}
                    onClick={addSkill}
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
                {profile.knownSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {profile.knownSkills.map((skill) => (
                      <span key={skill} className="inline-flex items-center">
                        <Badge variant="outline" className="gap-1 pr-1">
                          {skill}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Remove ${skill}`}
                            onClick={() =>
                              edit(
                                "knownSkills",
                                profile.knownSkills.filter(
                                  (value) => value !== skill,
                                ),
                              )
                            }
                          >
                            <X className="size-3" />
                          </Button>
                        </Badge>
                      </span>
                    ))}
                  </div>
                )}
                {validation.errors.knownSkills && (
                  <p role="alert" className="text-xs text-destructive">
                    {validation.errors.knownSkills}
                  </p>
                )}
                {profile.knownSkills.length >= KNOWN_SKILLS_MAX && (
                  <p className="text-xs text-foreground-muted">
                    Up to {KNOWN_SKILLS_MAX} known skills are supported.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${fieldId}-background`}
                  className="block text-sm font-medium"
                >
                  Prior background{" "}
                  <span className="font-normal text-foreground-muted">
                    · optional
                  </span>
                </label>
                <Textarea
                  id={`${fieldId}-background`}
                  value={profile.background}
                  maxLength={BACKGROUND_MAX_LENGTH}
                  placeholder="What have you tried already?"
                  invalid={Boolean(validation.errors.background)}
                  errorMessage={validation.errors.background}
                  onChange={(e) => edit("background", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${fieldId}-reference`}
                  className="block text-sm font-medium"
                >
                  Reference URL{" "}
                  <span className="font-normal text-foreground-muted">
                    · optional
                  </span>
                </label>
                <Input
                  id={`${fieldId}-reference`}
                  type="url"
                  value={profile.referenceUrl}
                  placeholder="https://…"
                  invalid={Boolean(validation.errors.referenceUrl)}
                  errorMessage={validation.errors.referenceUrl}
                  onChange={(e) => edit("referenceUrl", e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor={`${fieldId}-hours`}
                    className="block text-sm font-medium"
                  >
                    Hours per week
                  </label>
                  <Input
                    id={`${fieldId}-hours`}
                    type="number"
                    min={HOURS_MIN}
                    max={HOURS_MAX}
                    step={0.5}
                    value={profile.hoursPerWeek}
                    invalid={Boolean(validation.errors.hoursPerWeek)}
                    errorMessage={validation.errors.hoursPerWeek}
                    onChange={(e) => edit("hoursPerWeek", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor={`${fieldId}-weeks`}
                    className="block text-sm font-medium"
                  >
                    Duration in weeks
                  </label>
                  <Input
                    id={`${fieldId}-weeks`}
                    type="number"
                    min={DURATION_WEEKS_MIN}
                    max={DURATION_WEEKS_MAX}
                    step={1}
                    value={profile.durationWeeks}
                    invalid={Boolean(validation.errors.durationWeeks)}
                    errorMessage={validation.errors.durationWeeks}
                    onChange={(e) => edit("durationWeeks", e.target.value)}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {mode === "sample" && (
            <div
              data-testid="studio-goal-form-samples"
              className="space-y-3 rounded-2xl border border-border-subtle bg-background-secondary p-4"
            >
              <div className="flex items-center gap-2">
                <Copy className="size-4 text-foreground-muted" />
                <h2 className="text-sm font-semibold">Copy an approved sample</h2>
              </div>
              <p className="text-xs text-foreground-muted">
                Sample copies reuse fixed lesson content. This is separate from real
                generation and never substitutes for your goal.
              </p>
              <div className="grid gap-2">
                {samples.map((sample) => {
                  const selected = profile.sampleTemplateRef === sample.ref;
                  return (
                    <Button
                      key={sample.ref}
                      type="button"
                      variant={selected ? "secondary" : "outline"}
                      aria-pressed={selected}
                      className="h-auto justify-start p-3 text-left"
                      onClick={() => edit("sampleTemplateRef", sample.ref)}
                    >
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-medium">
                          {sample.title}
                        </span>
                        <span className="mt-1 block whitespace-normal text-xs text-foreground-muted">
                          {sample.summary}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
              {!selectedSample && (
                <p className="text-xs text-foreground-muted">
                  Select a sample to continue.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end">
            <Button type="button" disabled={!canReview} onClick={review}>
              <Sparkles className="size-4" />
              Review details
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-background-secondary p-4 text-sm"
            >
              <strong className="text-destructive">Generation failed.</strong>
              <p className="mt-1 text-foreground-muted">{error}</p>
            </div>
          )}

          <div className={card} data-testid="studio-goal-form-review">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="break-words text-base font-semibold">
                {displayed.title}
              </h2>
              <Badge variant={mode === "sample" ? "info" : "default"}>
                {mode === "sample" ? "Sample copy" : "New generation"}
              </Badge>
            </div>
            <p className="mt-2 break-words text-sm leading-6 text-foreground-muted">
              {displayed.goal}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Summary label="Level" value={displayed.level} />
              <Summary
                label="Pace"
                value={
                  displayed.hoursPerWeek && displayed.durationWeeks
                    ? `${displayed.hoursPerWeek} hours/week for ${displayed.durationWeeks} weeks`
                    : "Not specified"
                }
              />
              <Summary label="Outcome" value={displayed.outcome} />
              <Summary
                label="Known skills"
                value={
                  displayed.knownSkills.length > 0
                    ? displayed.knownSkills.join(", ")
                    : "None added"
                }
              />
              <Summary
                label="Background"
                value={displayed.background || "No background added"}
              />
              {displayed.referenceUrl && (
                <Summary label="Reference URL" value={displayed.referenceUrl} />
              )}
            </dl>
          </div>

          <div className={card}>
            <h2 className="text-sm font-semibold">Content source</h2>
            {mode === "sample" ? (
              <p className="mt-2 text-sm text-foreground-muted">
                {selectedSample?.title ?? "Selected sample"} · fixed sample lessons.
              </p>
            ) : (
              <p className="mt-2 text-sm text-foreground-muted">
                A new curriculum researched from your goal. No fixed sample required.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-foreground-muted">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>Your edits are kept. Back and edit, or retry the submission.</span>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={backToEdit}
            >
              Back and edit
            </Button>
            <Button type="button" loading={submitting} onClick={() => void confirm()}>
              {mode === "sample" ? "Copy sample roadmap" : "Generate roadmap"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="mt-1 break-words text-foreground capitalize">{value}</dd>
    </div>
  );
}
