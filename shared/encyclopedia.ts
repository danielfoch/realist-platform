import guidesJson from "../docs/content/realist-encyclopedia/guides.json";
import manifestJson from "../docs/content/realist-encyclopedia/manifest.json";
import toolSpecsJson from "../docs/content/realist-encyclopedia/tool-specs.json";

export type EncyclopediaGuide = {
  id: string;
  title: string;
  slug: string;
  canonicalPath: string;
  summary: string;
  definition: string;
  whyItMatters: string;
  formula?: string;
  example?: string;
  investorInterpretation?: string;
  commonMistakes?: string[];
  relatedTerms?: string[];
  realistTieIn?: string;
  sourceCaveatNotes?: string;
  category: string;
  tags?: string[];
  difficulty?: string;
  searchKeywords?: string[];
  toolSpecSlug?: string;
  status?: string;
};

export type EncyclopediaToolSpec = {
  id: string;
  slug: string;
  guideSlug: string;
  title: string;
  category: string;
  status: string;
  userProblem?: string;
  inputs: Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
    unit?: string;
    options?: string[];
    helpText?: string;
  }>;
  outputs: string[];
  formulaNotes?: string;
  uiCopy?: {
    headline?: string;
    primaryCta?: string;
    emptyState?: string;
    caveat?: string;
  };
  validationRules?: string[];
  relatedGuideSlugs?: string[];
};

type EncyclopediaManifest = {
  name: string;
  version: string;
  description: string;
  categories: string[];
  searchIndex: Array<{
    slug: string;
    title: string;
    summary: string;
    category: string;
    tags?: string[];
    relatedTerms?: string[];
    toolSpecSlug?: string;
  }>;
};

export const encyclopediaGuides = guidesJson as EncyclopediaGuide[];
export const encyclopediaToolSpecs = toolSpecsJson as EncyclopediaToolSpec[];
export const encyclopediaManifest = manifestJson as EncyclopediaManifest;

export function getEncyclopediaGuide(slug: string | undefined) {
  if (!slug) return undefined;
  return encyclopediaGuides.find((guide) => guide.slug === slug);
}

export function getEncyclopediaToolSpec(slug: string | undefined) {
  if (!slug) return undefined;
  return encyclopediaToolSpecs.find((tool) => tool.slug === slug);
}

export function searchEncyclopediaGuides(query: string, category = "all") {
  const normalized = query.trim().toLowerCase();
  return encyclopediaManifest.searchIndex
    .map((entry) => {
      const guide = getEncyclopediaGuide(entry.slug);
      return guide ? { ...entry, guide } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter(({ guide }) => category === "all" || guide.category === category)
    .filter(({ guide }) => {
      if (!normalized) return true;
      const fields = [
        guide.title,
        guide.slug,
        guide.summary,
        guide.definition,
        guide.category,
        ...(guide.tags ?? []),
        ...(guide.searchKeywords ?? []),
        ...(guide.relatedTerms ?? []),
      ];
      return fields.some((field) => field.toLowerCase().includes(normalized));
    })
    .map(({ guide }) => guide);
}
