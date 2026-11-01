import { describe, expect, it } from "vitest";
import { aging, toCsv } from "@/lib/report-math";

describe("aged receivables", () => {
  const charges = [
    { amount_cents: 100000, due_date: "2026-08-01" },
    { amount_cents: 100000, due_date: "2026-09-01" },
    { amount_cents: 100000, due_date: "2026-10-01" },
    { amount_cents: 100000, due_date: "2026-11-01" },
    { amount_cents: 100000, due_date: "2026-12-01" },
  ];
  it("applies payments to the oldest charges and buckets the rest", () => {
    expect(aging(charges, 150000, "2026-11-01")).toEqual({ current: 100000, d30: 100000, d60: 50000, d90: 0, total: 250000 });
  });
  it("ignores charges not yet due and shows over-90 balances", () => {
    expect(aging(charges, 0, "2026-11-15").d90).toBe(100000);
    expect(aging(charges, 0, "2026-11-15").total).toBe(400000);
  });
});

describe("CSV", () => {
  it("writes money as dollars and quotes commas", () => {
    expect(toCsv([{ key: "n", label: "Name" }, { key: "a", label: "Amount", kind: "money" }], [{ n: "Smith, Pat", a: 123456 }])).toBe('Name,Amount\n"Smith, Pat",1234.56');
  });
});

import { formatMetric, metricStatus } from "@/lib/metrics-defs";

describe("metric status", () => {
  it("higher is better: on, watch within 10%, off", () => {
    expect(metricStatus(0.96, 0.95, "higher")).toBe("on");
    expect(metricStatus(0.9, 0.95, "higher")).toBe("watch");
    expect(metricStatus(0.8, 0.95, "higher")).toBe("off");
  });
  it("lower is better", () => {
    expect(metricStatus(3, 3, "lower")).toBe("on");
    expect(metricStatus(3.2, 3, "lower")).toBe("watch");
    expect(metricStatus(4, 3, "lower")).toBe("off");
    expect(metricStatus(null, 3, "lower")).toBe("none");
  });
  it("formats", () => {
    expect(formatMetric(0.953, "percent")).toBe("95%");
    expect(formatMetric(5_000_000, "money")).toBe("$50,000");
  });
});
