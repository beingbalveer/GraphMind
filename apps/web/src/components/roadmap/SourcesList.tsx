import type { SourceData } from "@/lib/roadmapTypes";
export function SourcesList({ sources }: { sources: SourceData[] }) {
  const attributions = new Set<string>();
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Sources reviewed</h3>
      {sources.map((source) => {
        const html = source.provenance.attributionHtml;
        const attribution =
          typeof html === "string" && !attributions.has(html) ? html : null;
        if (attribution) attributions.add(attribution);
        return (
          <div
            key={source.id}
            className="space-y-2 rounded-xl border border-border-subtle bg-surface p-3 text-xs"
          >
            <p className="font-medium">
              {source.url && /^https?:\/\//.test(source.url) ? (
                <a
                  className="underline underline-offset-2"
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.title}
                </a>
              ) : (
                source.title
              )}
            </p>
            <p className="text-foreground-muted">
              {source.access === "free"
                ? "Free"
                : source.access === "paid"
                  ? "Paid"
                  : "Access unconfirmed"}{" "}
              ·{" "}
              {source.status === "unavailable"
                ? "Unavailable"
                : source.status === "grounded"
                  ? "Search verified"
                  : "Reviewed"}{" "}
              · {new Date(source.verifiedAt).toLocaleDateString()}
            </p>
            {source.locator && (
              <p className="text-foreground-muted">{source.locator}</p>
            )}
            {attribution && (
              <iframe
                title={`Search attribution: ${source.title}`}
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={attribution}
                className="h-24 w-full rounded-lg border border-border"
              />
            )}
          </div>
        );
      })}
      {!sources.length && (
        <p className="text-xs text-foreground-muted">
          No external sources in this revision.
        </p>
      )}
    </div>
  );
}
