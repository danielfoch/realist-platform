import { readFile } from "fs/promises";

type Guide = {
  slug: string;
  title: string;
  canonicalPath: string;
  category: string;
  toolSpecSlug?: string | null;
  relatedTerms?: string[];
};

type ToolSpec = {
  slug: string;
  guideSlug: string;
  relatedGuideSlugs?: string[];
};

type Manifest = {
  guideCount: number;
  toolSpecCount: number;
  categories: string[];
  searchIndex: Array<{ slug: string; toolSpecSlug?: string | null }>;
  toolIndex?: Array<{ slug: string; guideSlug: string }>;
};

const CONTENT_ROOT = "docs/content/realist-encyclopedia";

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(`${CONTENT_ROOT}/${file}`, "utf-8")) as T;
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

function requireNoErrors(errors: string[], warnings: string[]) {
  for (const warning of warnings) {
    console.warn(`Encyclopedia content warning: ${warning}`);
  }
  if (errors.length > 0) {
    throw new Error(`Encyclopedia content validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}

export async function validateEncyclopediaContent() {
  const [guides, toolSpecs, manifest] = await Promise.all([
    readJson<Guide[]>("guides.json"),
    readJson<ToolSpec[]>("tool-specs.json"),
    readJson<Manifest>("manifest.json"),
  ]);

  const errors: string[] = [];
  const warnings: string[] = [];
  const guideSlugs = new Set(guides.map((guide) => guide.slug));
  const toolSlugs = new Set(toolSpecs.map((tool) => tool.slug));
  const searchSlugs = new Set((manifest.searchIndex ?? []).map((entry) => entry.slug));

  for (const slug of duplicates(guides.map((guide) => guide.slug))) {
    errors.push(`Duplicate guide slug: ${slug}`);
  }
  for (const slug of duplicates(toolSpecs.map((tool) => tool.slug))) {
    errors.push(`Duplicate tool spec slug: ${slug}`);
  }

  if (manifest.guideCount !== guides.length) {
    errors.push(`Manifest guideCount ${manifest.guideCount} does not match guides.json length ${guides.length}`);
  }
  if (manifest.toolSpecCount !== toolSpecs.length) {
    errors.push(`Manifest toolSpecCount ${manifest.toolSpecCount} does not match tool-specs.json length ${toolSpecs.length}`);
  }
  if ((manifest.searchIndex ?? []).length !== guides.length) {
    errors.push(`Manifest searchIndex length ${(manifest.searchIndex ?? []).length} does not match guides.json length ${guides.length}`);
  }

  for (const guide of guides) {
    if (!guide.slug || !guide.title || !guide.canonicalPath) {
      errors.push(`Guide ${guide.slug || guide.title || "(unknown)"} is missing slug, title, or canonicalPath`);
    }
    if (guide.canonicalPath !== `/insights/encyclopedia/${guide.slug}`) {
      errors.push(`Guide ${guide.slug} canonicalPath should be /insights/encyclopedia/${guide.slug}, got ${guide.canonicalPath}`);
    }
    if (!searchSlugs.has(guide.slug)) {
      errors.push(`Guide ${guide.slug} is missing from manifest.searchIndex`);
    }
    if (guide.toolSpecSlug && !toolSlugs.has(guide.toolSpecSlug)) {
      errors.push(`Guide ${guide.slug} references missing toolSpecSlug ${guide.toolSpecSlug}`);
    }
    for (const related of guide.relatedTerms ?? []) {
      if (!guideSlugs.has(related) && !toolSlugs.has(related)) {
        warnings.push(`Guide ${guide.slug} references unresolved related term ${related}`);
      }
    }
  }

  for (const entry of manifest.searchIndex ?? []) {
    if (!guideSlugs.has(entry.slug)) {
      errors.push(`Manifest searchIndex references missing guide slug ${entry.slug}`);
    }
    if (entry.toolSpecSlug && !toolSlugs.has(entry.toolSpecSlug)) {
      errors.push(`Manifest searchIndex guide ${entry.slug} references missing toolSpecSlug ${entry.toolSpecSlug}`);
    }
  }

  for (const tool of toolSpecs) {
    if (!guideSlugs.has(tool.guideSlug)) {
      errors.push(`Tool spec ${tool.slug} references missing guideSlug ${tool.guideSlug}`);
    }
    for (const guideSlug of tool.relatedGuideSlugs ?? []) {
      if (!guideSlugs.has(guideSlug)) {
        warnings.push(`Tool spec ${tool.slug} references unresolved relatedGuideSlug ${guideSlug}`);
      }
    }
  }

  if (manifest.toolIndex) {
    if (manifest.toolIndex.length !== toolSpecs.length) {
      errors.push(`Manifest toolIndex length ${manifest.toolIndex.length} does not match tool-specs.json length ${toolSpecs.length}`);
    }
    for (const tool of manifest.toolIndex) {
      if (!toolSlugs.has(tool.slug)) {
        errors.push(`Manifest toolIndex references missing tool slug ${tool.slug}`);
      }
      if (!guideSlugs.has(tool.guideSlug)) {
        errors.push(`Manifest toolIndex tool ${tool.slug} references missing guideSlug ${tool.guideSlug}`);
      }
    }
  }

  requireNoErrors(errors, warnings);

  return {
    guideCount: guides.length,
    toolSpecCount: toolSpecs.length,
    categoryCount: manifest.categories.length,
    warningCount: warnings.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateEncyclopediaContent()
    .then((result) => {
      console.log(
        `Encyclopedia content valid: ${result.guideCount} guides, ${result.toolSpecCount} tool specs, ${result.categoryCount} categories, ${result.warningCount} warnings`,
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
