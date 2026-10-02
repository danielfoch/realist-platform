import type { Layer, Row } from "./model";
export interface EvidenceQuestion { topic: string; question: string; evidenceLayers: string[]; }
export function preShowingBrief(layers: Record<string, Layer>, questions: EvidenceQuestion[]) {
  const findings = Object.entries(layers).filter(([name, value]) => name !== "location" && value.status === "available").map(([name, value]) => {
    const d = value.data as Row | null;
    const count = d && Array.isArray(d.records) ? d.records.length : d && Array.isArray(d.applications) ? d.applications.length : null;
    return { layer: name, summary: name === "development" ? `${count ?? 0} nearby applications returned within 800 m; read published stage and distance.` : name === "heritage" ? "Heritage register evidence matched; read the published status and applicable bylaw." : name === "trca" || name === "conservation" ? "Mapped conservation evidence intersects the screened point; confirm parcel-wide requirements." : name === "additionalUnits" ? "Additional-unit registration evidence matched; request the documents for the advertised unit." : name === "buildingEvaluations" ? "Dated building evaluation evidence is available; review the latest visit and history." : `${name} evidence is available${count !== null ? ` (${count} returned records)` : ""}.`, source: value.source, sourceUpdatedAt: value.sourceUpdatedAt, retrievedAt: value.retrievedAt, importedAt: value.importedAt ?? null, truncated: value.truncated ?? false };
  });
  const documents: { document: string; evidenceLayers: string[]; reason: string }[] = [
    { document: "Current listing and seller disclosures", evidenceLayers: [], reason: "Compare advertised features and disclosures with dated public records." },
    { document: "Survey and parcel identification", evidenceLayers: ["parcel"], reason: "Verify the property boundary; point screens cannot establish parcel-wide conditions." },
  ];
  if (layers.permits?.status === "available" || layers.additionalUnits?.status === "available") documents.push({ document: "Permit file, final inspections and occupancy or unit-registration documents", evidenceLayers: ["permits", "additionalUnits"], reason: "A published permit or registration entry does not prove all work received final approval." });
  if (layers.heritage?.status === "available") documents.push({ document: "Heritage designation/listing documents, district plan and applicable alteration approvals", evidenceLayers: ["heritage"], reason: "Confirm the exact status and requirements for the proposed work." });
  if (layers.conservation?.status === "available" || layers.trca?.status === "available") documents.push({ document: "Conservation authority confirmation and any related permits", evidenceLayers: ["conservation", "trca"], reason: "Confirm parcel-wide mapped and unmapped constraints with the authority." });
  if (layers.buildingEvaluations?.status === "available") documents.push({ document: "Latest building-condition reports and evidence of corrective work", evidenceLayers: ["buildingEvaluations"], reason: "Public evaluations are dated and concern building/common areas." });
  return {
    title: "Pre-showing property forensics briefing", findings,
    listingComparison: { status: "not_provided", discrepancies: [], instruction: "If a listing or seller documents are supplied, compare specific claims against the returned evidence. Report conflicts, date differences and unknowns separately; do not infer an inconsistency without both sides." },
    documentsToRequest: documents.map(d => ({ ...d, receiptStatus: "not_assessed" })),
    sellerQuestions: questions,
    coverageGaps: Object.entries(layers).filter(([, value]) => value.status !== "available").map(([name, value]) => ({ layer: name, status: value.status, note: value.note })),
    limitations: ["Research briefing, not an inspection, appraisal, title opinion or municipal approval.", "No-match is not proof of absence. Source/import/retrieval dates remain separate.", "Documents listed here are requests; the API has not checked what the seller already holds."],
  };
}
