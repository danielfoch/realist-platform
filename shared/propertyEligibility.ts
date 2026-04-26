type PropertyEligibilityInput = {
  PropertySubType?: string | null;
  StructureType?: string | null;
  propertySubType?: string | null;
  structureType?: string | null;
  propertyType?: string | null;
  type?: string | null;
  class?: string | null;
  PublicRemarks?: string | null;
  publicRemarks?: string | null;
  details?: {
    propertyType?: string | null;
    description?: string | null;
  } | null;
};

const VACANT_LAND_EXACT_TYPES = new Set([
  "land",
  "lot",
  "lots acreage",
  "acreage",
  "vacant land",
  "vacant lot",
  "residential land",
  "residential lot",
  "commercial land",
  "commercial lot",
  "industrial land",
  "industrial lot",
  "development land",
  "building lot",
  "raw land",
  "unimproved land",
]);

const VACANT_LAND_PHRASES = [
  "vacant land",
  "vacant lot",
  "land only",
  "raw land",
  "unimproved land",
  "development land",
  "building lot",
  "residential lot",
  "commercial lot",
  "industrial lot",
  "no building",
  "no buildings",
  "no structure",
  "no structures",
  "without building",
  "without buildings",
];

function normalizeClassification(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/_-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldValues(property: PropertyEligibilityInput): string[] {
  return [
    property.PropertySubType,
    property.StructureType,
    property.propertySubType,
    property.structureType,
    property.propertyType,
    property.type,
    property.class,
    property.details?.propertyType,
  ]
    .map(normalizeClassification)
    .filter(Boolean);
}

export function isVacantLandLikeProperty(property: PropertyEligibilityInput | null | undefined): boolean {
  if (!property) return false;

  const classifications = fieldValues(property);
  if (classifications.some((value) => VACANT_LAND_EXACT_TYPES.has(value))) {
    return true;
  }

  const classificationText = classifications.join(" ");
  if (VACANT_LAND_PHRASES.some((phrase) => classificationText.includes(phrase))) {
    return true;
  }

  const remarks = normalizeClassification(
    property.PublicRemarks || property.publicRemarks || property.details?.description,
  );
  return VACANT_LAND_PHRASES.some((phrase) => remarks.includes(phrase));
}

export function hasRentableStructure(property: PropertyEligibilityInput | null | undefined): boolean {
  return !isVacantLandLikeProperty(property);
}
