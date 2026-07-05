import { describe, expect, it } from "vitest";
import {
  resolveEndorsement,
  buildFieldNoteLeadCrm,
  ENDORSEMENT_POINTS,
} from "./fieldNoteIncentives";

describe("resolveEndorsement", () => {
  it("adds a new agree endorsement and rewards the author", () => {
    expect(resolveEndorsement(null, "agree")).toEqual({
      action: "added",
      newStance: "agree",
      authorPointsDelta: ENDORSEMENT_POINTS,
    });
  });

  it("adds a disagree endorsement without reputation points", () => {
    expect(resolveEndorsement(null, "disagree")).toEqual({
      action: "added",
      newStance: "disagree",
      authorPointsDelta: 0,
    });
  });

  it("toggles the same agree stance off, reversing the reward", () => {
    expect(resolveEndorsement("agree", "agree")).toEqual({
      action: "removed",
      newStance: null,
      authorPointsDelta: -ENDORSEMENT_POINTS,
    });
  });

  it("switching agree -> disagree removes the reward", () => {
    expect(resolveEndorsement("agree", "disagree")).toEqual({
      action: "changed",
      newStance: "disagree",
      authorPointsDelta: -ENDORSEMENT_POINTS,
    });
  });

  it("switching disagree -> agree grants the reward", () => {
    expect(resolveEndorsement("disagree", "agree")).toEqual({
      action: "changed",
      newStance: "agree",
      authorPointsDelta: ENDORSEMENT_POINTS,
    });
  });

  it("toggling off a disagree is a no-op for reputation", () => {
    expect(resolveEndorsement("disagree", "disagree")).toEqual({
      action: "removed",
      newStance: null,
      authorPointsDelta: 0,
    });
  });
});

describe("buildFieldNoteLeadCrm", () => {
  it("attributes the lead to the note + listing with power-team tags", () => {
    const m = buildFieldNoteLeadCrm(
      { noteId: "note-1", listingMlsNumber: "C7891234", category: "urban_planning", message: "  interested in a rezoning read  " },
      "Urban Planner",
    );
    expect(m.source).toBe("field_note");
    expect(m.sourceDetail).toBe("Field-note lead — Urban Planner on listing C7891234");
    expect(m.tags).toEqual(["field-note-lead", "power-team"]);
    expect(m.data).toEqual({ fieldNoteId: "note-1", listingMlsNumber: "C7891234", category: "urban_planning" });
    expect(m.activityBody).toContain("work with this Urban Planner");
    expect(m.activityBody).toContain('Message: "interested in a rezoning read"'); // trimmed
  });

  it("omits the message clause when none is given", () => {
    const m = buildFieldNoteLeadCrm({ noteId: "n", listingMlsNumber: "X1", category: "architecture" }, "Architect");
    expect(m.activityBody).not.toContain("Message:");
  });
});
