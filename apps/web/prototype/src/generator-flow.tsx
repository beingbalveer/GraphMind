import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  allAvailableRoadmaps,
  getRoadmap,
  isHttpUrl,
  validGeneratorProfile,
  type GeneratorProfile,
  type DemoScenario,
} from "./state";

type Flow =
  | "form"
  | "review"
  | "clarification"
  | "generating"
  | "error"
  | "result";
export function GeneratorFlow({
  profile,
  selectedTemplate,
  onProfile,
  onTemplate,
  onCreate,
  scenario,
  onScenarioConsumed,
  onStartLearning,
  onShowCollection,
}: {
  profile: GeneratorProfile;
  selectedTemplate: string;
  onProfile: (field: keyof GeneratorProfile, value: string | number) => void;
  onTemplate: (id: string) => void;
  onCreate: (
    profile: GeneratorProfile,
    templateId: string,
    runId: string,
  ) => void;
  scenario: DemoScenario;
  onScenarioConsumed: () => void;
  onStartLearning: () => void;
  onShowCollection: () => void;
}) {
  const [flow, setFlow] = useState<Flow>("form");
  const [expanded, setExpanded] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState(0);
  const [submitted, setSubmitted] = useState<GeneratorProfile | null>(null);
  const [submittedTemplate, setSubmittedTemplate] = useState<string | null>(
    null,
  );
  const runRef = useRef<string | null>(null);
  const calledRef = useRef(false);
  const scenarioConsumedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const normalize = (value: GeneratorProfile): GeneratorProfile => {
    const goal = value.prompt.trim().replace(/[.!?]+$/, "");
    const action = goal.replace(/^i want to /i, "");
    const subject = action.replace(/^(?:learn to|learn|understand)\s+/i, "");
    const capability = subject
      ? `${subject[0].toLowerCase()}${subject.slice(1)}`
      : goal;
    const title =
      value.title.trim() ||
      `${action[0]?.toUpperCase() ?? ""}${action.slice(1)}`.slice(0, 120);
    const outcome =
      value.outcome.trim() || `Be able to ${capability}`.slice(0, 240);
    return { ...value, title, outcome };
  };
  const displayed = flow === "form" ? profile : (submitted ?? profile);
  const valid = validGeneratorProfile(normalize(profile));
  const validUrl = !profile.referenceUrl || isHttpUrl(profile.referenceUrl);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const edit = (field: keyof GeneratorProfile, value: string | number) => {
    if (field === "prompt" && typeof value === "string") {
      const previousDefaults = normalize({
        ...profile,
        title: "",
        outcome: "",
      });
      const nextDefaults = normalize({
        ...profile,
        prompt: value,
        title: "",
        outcome: "",
      });
      if (!profile.title.trim() || profile.title === previousDefaults.title)
        onProfile("title", nextDefaults.title);
      if (
        !profile.outcome.trim() ||
        profile.outcome === previousDefaults.outcome
      )
        onProfile("outcome", nextDefaults.outcome);
    }
    onProfile(field, value);
  };
  const start = (retry = false, overrideProfile?: GeneratorProfile) => {
    const launchProfile = overrideProfile ?? submitted ?? profile;
    const launchTemplate = retry
      ? selectedTemplate
      : (submittedTemplate ?? selectedTemplate);
    if (
      !validGeneratorProfile(launchProfile) ||
      (launchProfile.referenceUrl && !isHttpUrl(launchProfile.referenceUrl)) ||
      flow === "generating" ||
      flow === "result"
    )
      return;
    if (timer.current) clearTimeout(timer.current);
    runRef.current = `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    calledRef.current = false;
    setError("");
    setPhase(0);
    const hasMatchedScenario =
      scenario === "generation-clarification" ||
      scenario === "generation-error";
    const selectedScenario =
      retry || scenarioConsumedRef.current || !hasMatchedScenario
        ? "normal"
        : scenario;
    if (hasMatchedScenario && !retry && !scenarioConsumedRef.current) {
      onScenarioConsumed();
      scenarioConsumedRef.current = true;
    }
    if (selectedScenario === "generation-clarification") {
      setFlow("clarification");
      return;
    }
    if (selectedScenario === "generation-error") {
      setFlow("generating");
      timer.current = setTimeout(() => {
        setError(
          "The local demo could not prepare this copy. Your profile is still here; retry to start a new run.",
        );
        setFlow("error");
      }, 1900);
      return;
    }
    scenarioConsumedRef.current = false;
    setFlow("generating");
    const advance = (next: number) => {
      setPhase(next);
      if (next < 3) timer.current = setTimeout(() => advance(next + 1), 600);
      else if (!calledRef.current && runRef.current) {
        calledRef.current = true;
        onCreate({ ...launchProfile }, launchTemplate, runRef.current);
        setFlow("result");
      }
    };
    timer.current = setTimeout(() => advance(1), 600);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
    runRef.current = null;
    calledRef.current = false;
    setFlow("review");
    setAnswer("");
  };
  const resume = () => {
    if (answer.trim().length < 3) return;
    const clarified = {
      ...(submitted ?? profile),
      background: [
        submitted?.background ?? profile.background,
        `Clarification: ${answer.trim()}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
    onProfile("background", clarified.background);
    setSubmitted(clarified);
    setFlow("review");
    setAnswer("");
  };
  const review = () => {
    const snapshot = normalize(profile);
    setSubmitted(snapshot);
    setSubmittedTemplate(selectedTemplate);
    if (snapshot.title !== profile.title) onProfile("title", snapshot.title);
    if (snapshot.outcome !== profile.outcome)
      onProfile("outcome", snapshot.outcome);
    setFlow("review");
  };
  const fieldId = useId();
  const card = "rounded-2xl border border-border-subtle bg-surface p-5";
  const field = (label: string, control: React.ReactNode) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor={fieldId + label}>
        {label}
      </label>
      {control}
    </div>
  );
  const templates = allAvailableRoadmaps();
  return (
    <section
      className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10"
      aria-labelledby="generator-title"
    >
      <Badge variant="secondary">DEMO GENERATOR</Badge>
      <h1
        id="generator-title"
        className="mt-4 break-words text-xl font-semibold"
      >
        Create a focused roadmap
      </h1>
      <p className="mt-2 text-sm leading-6 text-foreground-muted">
        Share a goal and pace. This preview makes a personal copy of one fixed
        sample curriculum; it does not generate arbitrary lessons.
      </p>
      {(flow === "form" || flow === "review" || flow === "error") && (
        <div className="mt-7 space-y-5">
          {flow === "error" && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-background-secondary p-4 text-sm"
            >
              <strong>Generation failed.</strong>
              <p className="mt-1 text-foreground-muted">{error}</p>
            </div>
          )}
          {flow === "error" && (
            <Button
              onClick={() => {
                const snapshot = normalize(profile);
                setSubmitted(snapshot);
                setSubmittedTemplate(selectedTemplate);
                start(true, snapshot);
              }}
            >
              Retry generation
            </Button>
          )}
          {flow !== "review" ? (
            <>
              {field(
                "Optional roadmap title",
                <Input
                  id={fieldId + "Optional roadmap title"}
                  value={profile.title}
                  maxLength={120}
                  placeholder="e.g. Build my first API"
                  onChange={(e) => edit("title", e.target.value)}
                />,
              )}
              {field(
                "Learning goal",
                <Textarea
                  id={fieldId + "Learning goal"}
                  value={profile.prompt}
                  maxLength={1200}
                  placeholder="What do you want to learn and why?"
                  onChange={(e) => edit("prompt", e.target.value)}
                />,
              )}
              {field(
                "Current level",
                <SegmentedTabs
                  ariaLabel="Current level"
                  value={profile.level}
                  items={["Beginner", "Intermediate", "Advanced"].map((id) => ({
                    id,
                    label: id,
                  }))}
                  onChange={(v) => edit("level", v)}
                  size="sm"
                />,
              )}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded
                  ? "Hide optional details"
                  : "Add background and planning details"}
              </Button>
              {expanded && (
                <div className="space-y-5 rounded-xl border border-border-subtle bg-background-secondary p-4">
                  {field(
                    "Prior background and known skills",
                    <Textarea
                      id={fieldId + "Prior background and known skills"}
                      value={profile.background}
                      maxLength={1000}
                      placeholder="What have you tried already?"
                      onChange={(e) => edit("background", e.target.value)}
                    />,
                  )}
                  {field(
                    "Optional desired outcome",
                    <Input
                      id={fieldId + "Optional desired outcome"}
                      value={profile.outcome}
                      maxLength={240}
                      placeholder="What should you be able to do?"
                      onChange={(e) => edit("outcome", e.target.value)}
                    />,
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field(
                      "Hours per week (1–40)",
                      <Input
                        id={fieldId + "Hours per week (1–40)"}
                        type="number"
                        min={1}
                        max={40}
                        step={1}
                        value={profile.hoursPerWeek}
                        onChange={(e) =>
                          edit("hoursPerWeek", Number(e.target.value))
                        }
                      />,
                    )}
                    {field(
                      "Duration in weeks (1–52)",
                      <Input
                        id={fieldId + "Duration in weeks (1–52)"}
                        type="number"
                        min={1}
                        max={52}
                        step={1}
                        value={profile.duration}
                        onChange={(e) =>
                          edit("duration", Number(e.target.value))
                        }
                      />,
                    )}
                  </div>
                  {field(
                    "Optional reference URL",
                    <>
                      <Input
                        id={fieldId + "Optional reference URL"}
                        type="url"
                        value={profile.referenceUrl}
                        placeholder="https://…"
                        onChange={(e) => edit("referenceUrl", e.target.value)}
                      />
                      {!validUrl && (
                        <span className="text-xs text-destructive">
                          Use a complete http:// or https:// URL.
                        </span>
                      )}
                    </>,
                  )}
                </div>
              )}
              {field(
                "Choose a fixed sample curriculum",
                <div className="grid gap-2">
                  {templates.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant={
                        selectedTemplate === item.id ? "secondary" : "outline"
                      }
                      className="h-auto justify-start p-3 text-left"
                      onClick={() => onTemplate(item.id)}
                    >
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="mt-1 block whitespace-normal text-xs text-foreground-muted">
                          {item.summary}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>,
              )}
              {!valid && (
                <p className="text-xs text-foreground-muted">
                  Add a learning goal of at least 10 characters. Pace must be a
                  whole number from 1–40 hours/week for 1–52 weeks.
                </p>
              )}
              <Button disabled={!valid || !validUrl} onClick={review}>
                Review roadmap details
              </Button>
            </>
          ) : (
            <>
              <div className={card}>
                <h2 className="break-words text-base font-semibold">
                  {displayed.title}
                </h2>
                <p className="mt-2 break-words text-sm leading-6 text-foreground-muted">
                  {displayed.prompt}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <Summary label="Level" value={displayed.level} />
                  <Summary
                    label="Pace"
                    value={`${displayed.hoursPerWeek} hours/week for ${displayed.duration} weeks`}
                  />
                  <Summary label="Outcome" value={displayed.outcome} />
                  <Summary
                    label="Background"
                    value={displayed.background || "No background added"}
                  />
                  {displayed.referenceUrl && (
                    <Summary
                      label="Submitted reference URL"
                      value={displayed.referenceUrl}
                    />
                  )}
                </dl>
              </div>
              <div className={card}>
                <h2 className="text-sm font-semibold">Selected local sample</h2>
                <p className="mt-2 text-sm text-foreground-muted">
                  {getRoadmap(submittedTemplate ?? selectedTemplate)?.title} ·
                  lessons remain the fixed sample content.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setFlow("form")}>
                  Back and edit
                </Button>
                <Button onClick={() => start()}>Start demo generation</Button>
              </div>
            </>
          )}
        </div>
      )}
      {flow === "clarification" && (
        <section className={`${card} mt-7 space-y-4`}>
          <Badge variant="outline">One follow-up needed</Badge>
          <h2 className="text-base font-semibold">
            What would make this outcome useful in practice?
          </h2>
          <p className="text-sm text-foreground-muted">
            This is a scripted demo clarification. Your answer is kept with this
            form only.
          </p>
          <Textarea
            aria-label="Clarification answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Describe a practical result…"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={cancel}>
              Cancel run
            </Button>
            <Button
              disabled={answer.trim().length < 3}
              onClick={() => resume()}
            >
              Continue to review
            </Button>
          </div>
        </section>
      )}
      {flow === "generating" && (
        <section className={`${card} mt-7`} aria-live="polite">
          <h2 className="text-base font-semibold">Preparing your demo copy</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Local preview steps: validate the profile, copy the selected sample,
            then prepare your result.
          </p>
          <ol className="mt-5 space-y-3 text-sm">
            {[
              "Profile checked",
              "Fixed sample selected",
              "Personal copy prepared",
            ].map((label, i) => (
              <li
                key={label}
                className={
                  phase >= i + 1 ? "text-foreground" : "text-foreground-muted"
                }
              >
                {phase >= i + 1 ? "✓" : "○"} {label}
              </li>
            ))}
          </ol>
          <Button className="mt-5" variant="outline" onClick={cancel}>
            Cancel demo generation
          </Button>
        </section>
      )}
      {flow === "result" && (
        <section className={`${card} mt-7`}>
          <Badge variant="success">Added to My learning</Badge>
          <h2 className="mt-4 break-words text-lg font-semibold">
            {displayed.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-foreground-muted">
            Your personal roadmap uses the selected sample lessons with your
            goal and pace attached.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Summary label="Learning goal" value={displayed.prompt} />
            <Summary label="Outcome" value={displayed.outcome} />
            <Summary
              label="Level and pace"
              value={`${displayed.level} · ${displayed.hoursPerWeek} hours/week for ${displayed.duration} weeks`}
            />
            <Summary
              label="Background"
              value={displayed.background || "Not provided"}
            />
            <Summary
              label="Content source"
              value={
                getRoadmap(submittedTemplate ?? selectedTemplate)?.title ??
                "Selected sample"
              }
            />
            {displayed.referenceUrl && (
              <Summary
                label="Submitted reference URL"
                value={displayed.referenceUrl}
              />
            )}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={onStartLearning}>Start learning</Button>
            <Button variant="outline" onClick={onShowCollection}>
              Show collection
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setFlow("form");
                setExpanded(false);
                setSubmitted(null);
                setSubmittedTemplate(null);
                setAnswer("");
                onProfile("title", "");
                onProfile("prompt", "");
                onProfile("outcome", "");
                onProfile("background", "");
                onProfile("referenceUrl", "");
              }}
            >
              Create another
            </Button>
          </div>
        </section>
      )}
    </section>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
