/**
 * Curated visual-context library for the public multiplex feasibility report.
 *
 * These are pre-generated drawing boards, not report-time AI output. The
 * submitted lot is mapped to the nearest frontage/depth/access band and the UI
 * clearly labels the selected board as a sample for a similar lot.
 */

export type MultiplexConceptWidthBand = "25_ft" | "30_ft" | "40_ft" | "50_ft";
export type MultiplexConceptDepthBand = "shallow" | "standard" | "deep" | "extra_deep";
export type MultiplexConceptLibraryDepthBand = Exclude<MultiplexConceptDepthBand, "extra_deep">;

export interface MultiplexConceptSample {
  id: string;
  imagePath: string;
  widthBand: MultiplexConceptWidthBand;
  depthBand: MultiplexConceptLibraryDepthBand;
  laneAccess: boolean;
  representativeFrontageFt: 25 | 30 | 40 | 50;
  representativeDepthFt: 95 | 115 | 140;
  representativeStoreys: 3 | 4;
  representativePrincipalUnits: 4 | 6;
  representativeRearSuite: "two-storey laneway suite" | null;
  form: string;
  similarLotLabel: string;
  alt: string;
}

const WIDTH_PROFILES = [
  {
    widthBand: "25_ft",
    frontageFt: 25,
    storeys: 3,
    principalUnits: 4,
    form: "narrow stacked multiplex",
  },
  {
    widthBand: "30_ft",
    frontageFt: 30,
    storeys: 3,
    principalUnits: 4,
    form: "central-stair multiplex",
  },
  {
    widthBand: "40_ft",
    frontageFt: 40,
    storeys: 4,
    principalUnits: 6,
    form: "side-by-side sixplex",
  },
  {
    widthBand: "50_ft",
    frontageFt: 50,
    storeys: 4,
    principalUnits: 6,
    form: "two-wing sixplex",
  },
] as const;

const DEPTH_PROFILES = [
  { depthBand: "shallow", depthFt: 95 },
  { depthBand: "standard", depthFt: 115 },
  { depthBand: "deep", depthFt: 140 },
] as const;

export const MULTIPLEX_CONCEPT_LIBRARY: readonly MultiplexConceptSample[] =
  WIDTH_PROFILES.flatMap((width) =>
    DEPTH_PROFILES.flatMap((depth) =>
      ([false, true] as const).map((laneAccess) => {
        const accessSlug = laneAccess ? "lane" : "no-lane";
        const accessLabel = laneAccess ? "with a rear lane" : "without a rear lane";
        const id = `${width.frontageFt}ft-${depth.depthBand}-${accessSlug}`;
        return {
          id,
          imagePath: `/assets/multiplex-concepts/${id}.webp`,
          widthBand: width.widthBand,
          depthBand: depth.depthBand,
          laneAccess,
          representativeFrontageFt: width.frontageFt,
          representativeDepthFt: depth.depthFt,
          representativeStoreys: width.storeys,
          representativePrincipalUnits: width.principalUnits,
          representativeRearSuite: laneAccess ? "two-storey laneway suite" : null,
          form: width.form,
          similarLotLabel: `${width.frontageFt} × ${depth.depthFt} ft ${accessLabel}`,
          alt: `Sample architectural drawing board for a ${width.frontageFt} by ${depth.depthFt} foot Toronto ${width.form} ${accessLabel}`,
        } satisfies MultiplexConceptSample;
      }),
    ),
  );

function libraryDepthBand(depthBand: MultiplexConceptDepthBand): MultiplexConceptLibraryDepthBand {
  return depthBand === "extra_deep" ? "deep" : depthBand;
}

export function selectMultiplexConceptSample(input: {
  widthBand: MultiplexConceptWidthBand;
  depthBand: MultiplexConceptDepthBand;
  laneAccess: boolean;
}): MultiplexConceptSample {
  const depthBand = libraryDepthBand(input.depthBand);
  const match = MULTIPLEX_CONCEPT_LIBRARY.find(
    (sample) =>
      sample.widthBand === input.widthBand
      && sample.depthBand === depthBand
      && sample.laneAccess === input.laneAccess,
  );

  // The cross-product above is exhaustive; keeping an explicit guard makes a
  // future partial catalog fail during development instead of silently showing
  // an unrelated lot.
  if (!match) {
    throw new Error(
      `No multiplex concept sample for ${input.widthBand}/${depthBand}/${input.laneAccess ? "lane" : "no-lane"}`,
    );
  }
  return match;
}
