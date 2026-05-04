import { describe, expect, it } from "vitest";
import {
  calculateListingUnderwriting,
  exportFeedbackTrainingEvents,
  getFeedbackWeight,
  sampleListingFeedbackEvents,
  sampleListingIntelligence,
  summarizeFeedbackEvents,
} from "./listingIntelligence";

describe("listing intelligence underwriting", () => {
  it("calculates auditable metrics and scores from listing assumptions", () => {
    const result = calculateListingUnderwriting(sampleListingIntelligence, sampleListingFeedbackEvents);

    expect(result.loanAmount).toBeGreaterThan(0);
    expect(result.monthlyMortgagePayment).toBeGreaterThan(0);
    expect(result.noi).toBeGreaterThan(0);
    expect(result.capRate).toBeGreaterThan(0);
    expect(result.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunityScore).toBeLessThanOrEqual(100);
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(100);
    expect(result.analysisSummary.recommendedNextStep.length).toBeGreaterThan(10);
  });

  it("weights verified professional feedback above unverified investor feedback", () => {
    const investorWeight = getFeedbackWeight({
      id: "investor",
      listingId: sampleListingIntelligence.id,
      userRole: "investor",
      inputType: "comment",
      confidence: 80,
      createdAt: new Date().toISOString(),
    });
    const contractorWeight = getFeedbackWeight({
      id: "contractor",
      listingId: sampleListingIntelligence.id,
      userRole: "contractor",
      inputType: "repair_estimate",
      confidence: 80,
      verifiedProfessional: true,
      physicallyInspected: true,
      createdAt: new Date().toISOString(),
    });

    expect(contractorWeight).toBeGreaterThan(investorWeight);
  });

  it("exports normalized training-ready events without training a model", () => {
    const summary = summarizeFeedbackEvents(sampleListingFeedbackEvents);
    const trainingEvents = exportFeedbackTrainingEvents(sampleListingFeedbackEvents);

    expect(summary.totalEvents).toBe(sampleListingFeedbackEvents.length);
    expect(trainingEvents).toHaveLength(sampleListingFeedbackEvents.length);
    expect(trainingEvents[0]).toMatchObject({
      listingId: sampleListingIntelligence.id,
      normalizedConfidence: expect.any(Number),
      sourceWeight: expect.any(Number),
    });
  });
});
