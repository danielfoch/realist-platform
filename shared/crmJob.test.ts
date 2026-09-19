import { describe, expect, it } from "vitest";
import {
  buildCrmDiff,
  composeContactName,
  crmSnapshotsConflict,
  emptyCrmSnapshot,
} from "./crmJob";

describe("crm job diffs", () => {
  it("does not invent a name from an email", () => {
    expect(composeContactName({ email: "pat@example.com" } as any)).toBeUndefined();
    expect(composeContactName({ firstName: "Pat", lastName: "Lee" })).toBe("Pat Lee");
    expect(composeContactName({ name: "  Pat Lee  " })).toBe("Pat Lee");
  });

  it("lists only material field changes", () => {
    const before = { ...emptyCrmSnapshot(), id: "c1", name: "Pat", email: "pat@example.com", stage: "new" };
    const after = { ...before, stage: "contacted" };
    const diff = buildCrmDiff(before, after);
    expect(diff.changes).toEqual([{ field: "stage", from: "new", to: "contacted" }]);
  });

  it("detects create-vs-update drift as a conflict", () => {
    expect(crmSnapshotsConflict(null, null)).toBe(false);
    expect(crmSnapshotsConflict(null, { ...emptyCrmSnapshot(), id: "c1", email: "a@b.co" })).toBe(true);
    const snap = { ...emptyCrmSnapshot(), id: "c1", name: "Pat", email: "pat@example.com", stage: "new" };
    expect(crmSnapshotsConflict(snap, { ...snap, stage: "client" })).toBe(true);
    expect(crmSnapshotsConflict(snap, { ...snap })).toBe(false);
  });
});
