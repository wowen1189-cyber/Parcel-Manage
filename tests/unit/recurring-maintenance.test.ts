import { describe, expect, it } from "vitest";
import { nextMaintenanceDate } from "@/lib/recurring-maintenance-rules";

describe("recurring maintenance dates", () => {
  it("moves by the schedule, keeping the day of the month", () => {
    expect(nextMaintenanceDate("2026-11-15", "monthly")).toBe("2026-12-15");
    expect(nextMaintenanceDate("2026-11-15", "quarterly")).toBe("2027-02-15");
    expect(nextMaintenanceDate("2026-11-15", "twice_yearly")).toBe("2027-05-15");
    expect(nextMaintenanceDate("2026-11-15", "yearly")).toBe("2027-11-15");
  });
  it("uses the last day of shorter months", () => {
    expect(nextMaintenanceDate("2026-11-30", "quarterly")).toBe("2027-02-28");
    expect(nextMaintenanceDate("2027-01-31", "monthly")).toBe("2027-02-28");
  });
});
