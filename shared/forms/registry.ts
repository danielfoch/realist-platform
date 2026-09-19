import { FORM_MAP_BY_ID, FORM_MAPS } from "./maps";
import type { FormMap, FormSummary } from "./types";

export function listFormMaps(): FormSummary[] {
  return FORM_MAPS.map((map) => ({
    formId: map.formId,
    title: map.title,
    board: map.board,
    jurisdiction: map.jurisdiction,
    mapVersion: map.mapVersion,
    mapConfidence: map.mapConfidence,
    fieldCount: map.fields.length,
    copyrightNote: map.copyrightNote,
  }));
}

export function getFormMap(formId: string): FormMap | null {
  return FORM_MAP_BY_ID.get(formId) ?? null;
}

export function isRegisteredFormId(formId: string): boolean {
  return FORM_MAP_BY_ID.has(formId);
}
