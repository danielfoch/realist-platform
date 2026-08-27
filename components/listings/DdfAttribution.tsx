/**
 * CREA DDF® compliance stamp. Required in the footer area of every surface
 * that renders MLS® listing content — the search explorer and each listing
 * detail page. Keep the wording intact; it is part of the DDF® display rules.
 */
export function DdfAttribution({ lastUpdated }: { lastUpdated?: string | null }) {
  let updatedLine: string | null = null;
  if (lastUpdated) {
    const date = new Date(lastUpdated);
    if (!isNaN(date.getTime())) {
      // Deterministic across server and client renders: fixed locale + UTC.
      updatedLine = date.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
    }
  }

  return (
    <div className="border-t border-hairline pt-4 text-xs leading-relaxed text-ink-faint">
      <p>
        MLS® Listing content powered by the REALTOR.ca Data Distribution
        Facility (DDF®).{updatedLine ? ` Last updated ${updatedLine}.` : ""} MLS®,
        REALTOR®, and associated logos are trademarks of CREA.
      </p>
    </div>
  );
}
