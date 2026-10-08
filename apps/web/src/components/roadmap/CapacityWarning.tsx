import { Button } from "@/components/ui/button";
import type { ValidationReport } from "@/lib/roadmapTypes";
export function CapacityWarning({
  validation,
  onReview,
  onRefine,
}: {
  validation: ValidationReport;
  onReview?: () => void;
  onRefine?: () => void;
}) {
  const issues = validation.issues.filter((issue) =>
    ["CAPACITY_EXCEEDED", "WEEKLY_CAPACITY", "SESSION_DURATION"].includes(
      issue.code,
    ),
  );
  if (!issues.length) return null;
  return (
    <div
      role="alert"
      className="space-y-2 rounded-xl border border-warning/30 bg-warning/10 p-3"
    >
      <p className="text-sm text-foreground">
        This plan exceeds your study budget.
      </p>
      <p className="text-xs text-foreground-muted">{issues[0].message}</p>
      {onRefine && (
        <Button variant="secondary" size="sm" onClick={onRefine}>
          Refine plan
        </Button>
      )}
      {onReview && (
        <Button variant="secondary" size="sm" onClick={onReview}>
          Review topic effort
        </Button>
      )}
    </div>
  );
}
