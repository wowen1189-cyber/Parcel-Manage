import { describe, expect, it } from "vitest";
import { finishSchema, hoursSince, jobPhotoPaths, officeTasks, parseInvoiceTotal, parseWriteUp, photosForAi, writeUpPrompt } from "@/lib/job-finish-rules";

const base = { resolution: "Replaced the flapper.", fixed: "yes" };

describe("finishing a job", () => {
  it("reads the AI's write-up, even in a code block, and treats 'none' as nothing", () => {
    const r = parseWriteUp('```json\n{"write_up":"Replaced the fill valve. No leaks.","fixed":true,"follow_up":"none","tenant_damage":null,"parts":"Fill valve","photo_check":""}\n```');
    expect(r).toEqual({ writeUp: "Replaced the fill valve. No leaks.", fixed: true, followUp: null, tenantDamage: null, parts: "Fill valve", photoCheck: null });
    expect(parseWriteUp("Sorry, I can't")).toBeNull();
    expect(parseWriteUp('{"write_up":""}')).toBeNull();
  });

  it("sends the AI up to 2 before photos and fills the rest with after photos", () => {
    const p = (stage: "before" | "after", n: number) => Array.from({ length: n }, (_, i) => ({ stage, i }));
    expect(photosForAi([...p("before", 4), ...p("after", 8)]).map((x) => x.stage)).toEqual(["before", "before", "after", "after", "after", "after"]);
    expect(photosForAi([...p("before", 5), ...p("after", 1)]).map((x) => x.stage)).toEqual(["before", "before", "before", "before", "before", "after"]);
    expect(photosForAi(p("after", 9))).toHaveLength(6);
  });

  it("labels the photos for the AI in order", () => {
    expect(writeUpPrompt({ title: "Toilet running", problem: null, notes: "replaced flapper", parts: "", photos: ["before", "after"] })).toContain("PHOTOS (in order): 1 before, 2 after");
  });

  it("works out time on site from the check-in, to the half hour", () => {
    const now = new Date("2026-11-02T15:00:00Z");
    expect(hoursSince("2026-11-02T13:40:00Z", now)).toBe(1.5);
    expect(hoursSince("2026-11-02T14:55:00Z", now)).toBe(0.5);
    expect(hoursSince("2026-11-01T01:00:00Z", now)).toBeNull();
    expect(hoursSince(null, now)).toBeNull();
  });

  it("needs a note when the job isn't fixed or may be tenant damage", () => {
    expect(finishSchema.safeParse(base).success).toBe(true);
    expect(finishSchema.safeParse({ ...base, fixed: "no" }).error?.issues[0].message).toBe("Say what's still needed for the next visit.");
    expect(finishSchema.safeParse({ ...base, damage: "yes" }).error?.issues[0].message).toBe("Describe the damage that may be tenant-caused.");
    expect(finishSchema.safeParse({ resolution: "Done it" }).success).toBe(false);
  });

  it("turns the amount into cents and rejects anything else", () => {
    expect(finishSchema.parse({ ...base, amount: "$1,245.5" }).amount).toBe(124550);
    expect(finishSchema.parse(base).amount).toBeNull();
    expect(finishSchema.safeParse({ ...base, amount: "about 50" }).success).toBe(false);
  });

  it("only accepts photos from this job's folder, for that person and stage", () => {
    const ok = "c1/work-orders/w1/vendor-after-1.jpg";
    expect(jobPhotoPaths([ok, ok, "c1/work-orders/w1/vendor-before-1.jpg", "c2/work-orders/w1/vendor-after-2.jpg", "c1/work-orders/w2/vendor-after-3.jpg", "c1/work-orders/w1/vendor-after-../../x.jpg"], "c1", "w1", "vendor", "after")).toEqual([ok]);
  });

  it("makes to-dos for a follow-up and possible tenant damage, never a charge", () => {
    const t = officeTasks({ workOrderId: "w1", number: 12, title: "Toilet running", followUpNote: "Part on order", damageNote: "Toy in the trap.", today: "2026-11-02" });
    expect(t.map((x) => x.kind)).toEqual(["work_order_follow_up", "work_order_tenant_damage"]);
    expect(t[1].detail).toContain("Decide whether to charge the tenant");
    expect(officeTasks({ workOrderId: "w1", number: 12, title: "x", followUpNote: null, damageNote: null, today: "2026-11-02" })).toEqual([]);
  });

  it("reads an invoice total from the AI", () => {
    expect(parseInvoiceTotal('{"amount_cents": 24500, "invoice_number": " A-77 "}')).toEqual({ amountCents: 24500, invoiceNumber: "A-77" });
    expect(parseInvoiceTotal("no")).toBeNull();
  });
});
