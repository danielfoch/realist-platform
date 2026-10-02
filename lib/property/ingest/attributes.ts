import { number, publishedYear, text, type Row } from "../model";

/** Explicit public physical-property whitelist. Never copy a complete source row. */
export function physicalAttributes(source: string, r: Row): Row {
  if (source === "calgary") return {
    assessmentClassCode: text(r.assessment_class), assessmentClassDescription: text(r.assessment_class_description),
    residentialAssessedValue: number(r.re_assessed_value), nonResidentialAssessedValue: number(r.nr_assessed_value), farmlandAssessedValue: number(r.fl_assessed_value),
    communityCode: text(r.comm_code), communityName: text(r.comm_name), propertyType: text(r.property_type), subPropertyUse: text(r.sub_property_use), legalDescription: text(r.short_legal),
  };
  if (source === "winnipeg") return {
    buildingType: text(r.building_type), basement: text(r.basement), basementFinish: text(r.basement_finish), rooms: number(r.rooms),
    airConditioning: text(r.air_conditioning), firePlace: text(r.fire_place), attachedGarage: text(r.attached_garage), detachedGarage: text(r.detached_garage), pool: text(r.pool),
    proposedRollYear: number(r.proposed_assessment_year), proposedAssessedValue: number(r.total_proposed_assessment_value), proposedValuationReferenceDate: text(r.proposed_assessment_date),
    condoStoreys: number(r.number_floors_condo), propertyUseCode: text(r.property_use_code), propertyInfluences: text(r.property_influences), neighbourhood: text(r.neighbourhood_area),
    waterFrontageM: number(r.water_frontage_measurement) === null ? null : Number(r.water_frontage_measurement) * 0.3048,
    sewerFrontageM: number(r.sewer_frontage_measurement) === null ? null : Number(r.sewer_frontage_measurement) * 0.3048,
  };
  if (source === "ns") return { underConstruction: text(r.under_construction), constructionGrade: text(r.grade), finishedBasement: text(r.finished_basement), garage: text(r.garage) };
  if (source === "nb") return { propertyDescription: text(r.descript), publishedTaxLevy: number(r.tax_levy), taxPeriodNote: "Levy as published by Service New Brunswick; verify the applicable tax period with the source." };
  if (source === "vancouver-tax") return { reportYear: publishedYear(r.report_year), majorImprovementYear: publishedYear(r.big_improvement_year), propertyPostalCode: text(r.property_postal_code), propertyId: text(r.pid), legalType: text(r.legal_type), zoningClassification: text(r.zoning_classification), publishedTaxLevy: number(r.tax_levy), taxPeriodNote: "Levy as published in the property tax report; verify the applicable tax period with the source." };
  return {};
}
