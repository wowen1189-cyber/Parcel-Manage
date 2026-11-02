import { describe, expect, it } from "vitest";
import { builtinParts, partsToTemplate, textToParts, unknownFields, type Part } from "@/lib/agreement-templates";
import { MANAGEMENT_AGREEMENT } from "@/lib/documents/management-agreement";
import { documentToText } from "@/lib/documents/text";
import { DEFAULT_AGREEMENT_TERMS, fillAgreement, agreementEndDate } from "@/lib/management-agreement";
import { DEFAULT_MANAGEMENT_FEE } from "@/lib/management-fees";

// Made-up agreement text laid out like a PDF export: wrapped lines, numbered headings, bullets.
const UPLOADED = `Sample Realty Management
1. Sample Management Agreement
1.1 PREAMBLE
This agreement is made on _______________ by and between Sample Realty ("Agent") and
____________________ ("Owner").
1.2 AUTHORITY & POWER OF AGENT, WARRANTIES &
COVENANTS
Owner gives the agent the following powers:
● Leasing. To advertise the property and sign leases
approved by owner.
● Repairs. To order repairs up to the limit.
1.3 FEES
The management fee is ten percent of rent collected each month, paid from the rent.
`;

describe("agreement templates", () => {
  it("splits uploaded text into parts at its headings", () => {
    const parts = textToParts(UPLOADED);
    expect(parts.map((p) => p.heading)).toEqual(["", "1. Sample Management Agreement", "1.1 PREAMBLE", "1.2 AUTHORITY & POWER OF AGENT, WARRANTIES & COVENANTS", "1.3 FEES"]);
    expect(parts[2].body).toContain('("Agent") and ____________________ ("Owner").');
    expect(parts[3].body).toBe("Owner gives the agent the following powers:\n\n- Leasing. To advertise the property and sign leases approved by owner.\n- Repairs. To order repairs up to the limit.");
  });

  it("turns parts into a document with lists, optional parts and signatures at the end", () => {
    const parts: Part[] = [
      { id: "a", heading: "1. Parties", body: "Between {{owner_name}} and {{agent_name}}.\n\n- One\n- Two", when: null },
      { id: "b", heading: "2. Mortgage payments", body: "Agent pays the mortgage for {{disbursement_fee}}.", when: "pma_disbursements" },
    ];
    const t = partsToTemplate("Our agreement", parts);
    expect(t.sections.at(-1)?.clauses[0].blocks[0]).toEqual({ kind: "signatures", parties: ["owner", "agent"] });
    expect(t.sections[0].clauses[0].blocks).toEqual([{ kind: "p", text: "Between {{owner_name}} and {{agent_name}}." }, { kind: "list", items: ["One", "Two"] }]);
    const text = documentToText(t, { owner_name: "Sample Holdings LLC", agent_name: "Sample PM" }, new Set());
    expect(text.sections.map((s) => s.heading)).toEqual(["1. Parties", "Signatures"]);
    expect(text.sections[0].paragraphs[0]).toBe("Between Sample Holdings LLC and Sample PM.");
  });

  it("flags blanks Parcel Manage can't fill", () => {
    expect(unknownFields([{ id: "a", heading: "", body: "{{owner_name}} pays {{mgmt_fee}} and {{ agent_name }}", when: null }])).toEqual(["mgmt_fee"]);
  });

  it("copies the Florida agreement into editable parts that fill in the same", () => {
    const parts = builtinParts();
    expect(unknownFields(parts)).toEqual([]);
    expect(parts.filter((p) => p.when).map((p) => p.when)).toEqual(expect.arrayContaining(["pma_leasing", "pma_evictions", "pma_contractors", "pma_disbursements", "pma_auto_renew"]));
    const fee = { ...DEFAULT_MANAGEMENT_FEE, percent: 5 };
    const filled = fillAgreement({
      createdOn: "2026-11-01",
      startDate: "2026-12-01",
      endDate: agreementEndDate("2026-12-01", 3),
      terms: DEFAULT_AGREEMENT_TERMS,
      owner: { name: "Sample Holdings LLC", mailing_address: "1 Sample Way", email: "owner@example.com" },
      signer: { name: "Jordan Sample", title: "Manager" },
      company: { name: "Sample PM", legal_name: null, address: "2 Office St", office_email: "office@example.com" },
      properties: [{ name: "Oak House", address: "5 Oak Ln", fee }],
    });
    const copy = documentToText(partsToTemplate("Copy", parts), filled.values, filled.conditions);
    const original = documentToText(MANAGEMENT_AGREEMENT, filled.values, filled.conditions);
    const words = (d: typeof copy) => d.sections.flatMap((s) => s.paragraphs).join(" ").replace(/[^a-z0-9$%]+/gi, " ").trim();
    expect(words(copy)).toContain("Sample Holdings LLC");
    expect(words(copy).length).toBeGreaterThan(words(original).length * 0.9);
    // The disbursement clause is optional and DEFAULT terms leave it off.
    expect(words(copy)).not.toContain("per property per month");
  });
});
