import { describe, expect, it } from "vitest";
import { CUTOVER_CREDIT_REFS, CUTOVER_DEPOSIT_REFS, oldSystemName, previousSoftware } from "@/lib/switch-over";

describe("switch-over from any software", () => {
  it("uses the name the company typed", () => {
    expect(previousSoftware({ switchOver: { from: " Buildium " } })).toBe("Buildium");
    expect(oldSystemName({ switchOver: { from: "Rent Manager" } })).toBe("Rent Manager");
  });
  it("falls back to a neutral phrase when nothing is set", () => {
    expect(previousSoftware({})).toBeNull();
    expect(previousSoftware({ switchOver: { from: "  " } })).toBeNull();
    expect(oldSystemName(null)).toBe("your old software");
  });
  it("still recognizes cutovers posted with the older AppFolio wording", () => {
    expect(CUTOVER_DEPOSIT_REFS).toContain("Held at AppFolio cutover");
    expect(CUTOVER_CREDIT_REFS).toContain("Credit from AppFolio");
  });
});
