import { keyprEstimateNote, keyprOfferText, keyprServiceText } from "@shared/keypr";

export function KeyprPartnership() {
  return <p className="text-xs text-muted-foreground">Cashback offered in partnership with <a href="https://keypr.ca" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Keypr</a>.</p>;
}
export function KeyprCashbackDetails() {
  return <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Realist.ca Cashback</p>
    <p className="text-sm">{keyprOfferText}</p>
    <p className="text-sm text-muted-foreground">{keyprServiceText}</p>
    <KeyprPartnership />
    <p className="text-xs text-muted-foreground">{keyprEstimateNote}</p>
  </div>;
}
