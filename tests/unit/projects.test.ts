import { describe, expect, it } from "vitest";
import { poBilled, projectTotals } from "@/lib/projects";

describe("project budgets", () => {
  const pos = [
    { id: "po1", amount_cents: 500_000, status: "approved" },
    { id: "po2", amount_cents: 200_000, status: "draft" },
    { id: "po3", amount_cents: 100_000, status: "void" },
  ];
  const bills = [
    { amount_cents: 300_000, status: "approved", purchase_order_id: "po1" },
    { amount_cents: 50_000, status: "paid", purchase_order_id: null },
    { amount_cents: 99_000, status: "received", purchase_order_id: "po1" },
    { amount_cents: 20_000, status: "void", purchase_order_id: null },
  ];
  it("counts approved and paid bills as spent and the rest of approved POs as committed", () => {
    expect(projectTotals(1_000_000, pos, bills)).toEqual({ spent: 350_000, committed: 200_000, left: 450_000, over: false });
  });
  it("flags going over budget", () => {
    expect(projectTotals(400_000, pos, bills).over).toBe(true);
    expect(projectTotals(0, pos, bills).over).toBe(false);
  });
  it("shows what's billed and left on a PO", () => {
    expect(poBilled(pos[0], bills)).toEqual({ billed: 300_000, left: 200_000 });
  });
});
