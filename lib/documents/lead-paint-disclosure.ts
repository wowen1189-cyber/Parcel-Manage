// Lead-based paint disclosure for housing built before 1978 (federal rule: 42 U.S.C. 4852d; 40 CFR part 745
// subpart F / 24 CFR part 35). The federal rule is NOT in the saved statute file, so every element here is
// "federal, verify": check it against the EPA/HUD lessor sample form with the attorney before use.
// Wording kept from SIM REI's form; additions follow docs/reference/lease-review-2026-11.md (D6).

import type { Block, Change, DocumentTemplate, TemplateField } from "./types";

const p = (text: string): Block => ({ kind: "p", text });
const FED = "42 U.S.C. 4852d; 40 CFR part 745 subpart F (federal, verify; not in the saved statute file)";
const ch = (summary: string, before?: string): Change =>
  before === undefined
    ? { finding: "D6", cite: FED, severity: "disclosure", summary }
    : { finding: "D6", cite: FED, severity: "disclosure", summary, before };
const f = (label: string, source: TemplateField["source"], example: string): TemplateField => ({ label, source, example });

export const LEAD_PAINT_DISCLOSURE: DocumentTemplate = {
  id: "lead-paint-disclosure",
  title: "Lead-Based Paint Disclosure",
  version: "2026-11 draft 1 (attorney review pending)",
  appliesTo: "Residential housing built before 1978 (federal rule, verify)",
  sections: [
    {
      id: "lead-paint",
      number: "1",
      title: "Lead Based Paint Disclosure",
      when: ["pre_1978"],
      standalone: true,
      clauses: [
        {
          id: "lead-header",
          number: "1.1",
          title: "Disclosure of Information on Lead-Based Paint and/or Lead-Based Paint Hazards",
          blocks: [
            p("Property: {{property_address}}, Unit {{unit_name}}"),
            p("Lessor: {{landlord_name}}, by {{agent_name}}, its authorized agent"),
            p("Lessee(s): {{tenant_names}}"),
          ],
          changes: [
            ch("Federal, verify. Unit now prints the unit name/number instead of the unit address (merge error). Lessor is the owning LLC by SIM REI as agent. Shown only for properties built before 1978; the app should attach the EPA pamphlet and keep the signed copy (commonly 3 years, federal, verify).", "Property: [Property Address], Unit [Unit Address] / Lessor: [Company Name]"),
          ],
        },
        {
          id: "lead-warning",
          title: "Lead Warning Statement",
          blocks: [
            p("Housing built before 1978 may contain lead-based paint. Lead from paint, paint chips, and dust can pose health hazards if not managed properly. Lead exposure is especially harmful to young children and pregnant women. Before renting pre-1978 housing, lessors must disclose the presence of known lead-based paint and/or lead-based paint hazards in the dwelling. Lessees must also receive a federally approved pamphlet on lead poisoning prevention."),
          ],
          changes: [ch("Federal, verify. Wording kept exactly as in SIM REI's form; it appears to match the standard EPA lessor warning statement but must be checked word for word against the federal form.")],
        },
        {
          id: "lessor-disclosure",
          title: "Lessor's Disclosure",
          blocks: [
            {
              kind: "choice",
              id: "lbp_known",
              prompt: "(a) Presence of lead-based paint and/or lead-based paint hazards (mark one):",
              setBy: "landlord",
              field: "lbp_known",
              options: [
                { id: "known", text: "(i) Known lead-based paint and/or lead-based paint hazards are present in the housing (explain below)." },
                { id: "no_knowledge", text: "(ii) Lessor has no knowledge of lead-based paint and/or lead-based paint hazards in the housing." },
              ],
            },
            { kind: "blank", id: "lbp_description", label: "Describe what is known (required if (i) is checked)", lines: 3 },
            {
              kind: "choice",
              id: "lbp_records",
              prompt: "(b) Records and reports available to the lessor (mark one):",
              setBy: "landlord",
              field: "lbp_records",
              options: [
                { id: "provided", text: "(i) Lessor has provided the lessee with all available records and reports pertaining to lead-based paint and/or lead-based paint hazards in the housing (list documents below)." },
                { id: "none", text: "(ii) Lessor has no reports or records pertaining to lead-based paint and/or lead-based paint hazards in the housing." },
              ],
            },
            { kind: "blank", id: "lbp_documents", label: "List documents (required if (i) is checked)", lines: 3 },
          ],
          changes: [ch("Federal, verify. (a) and (b) are now answers the office sets per property, with a required description and document list when (i) is checked.", "Describe what is known: / List documents:")],
        },
        {
          id: "lessee-ack",
          title: "Lessee's Acknowledgment",
          blocks: [
            {
              kind: "choice",
              id: "lessee_records",
              prompt: "(c) Lessee has (mark one):",
              setBy: "tenant",
              field: "lessee_records",
              options: [
                { id: "received", text: "(i) received copies of all records and reports pertaining to lead-based paint and/or lead-based paint hazards in the housing listed above." },
                { id: "not_received", text: "(ii) not received any records and reports regarding lead-based paint and/or lead-based paint hazards in the housing." },
              ],
            },
            { kind: "initials", parties: ["tenants"], label: "Lessee's initials for (c)" },
            p("(d) Lessee has received the pamphlet, Protect Your Family From Lead in Your Home."),
            { kind: "initials", parties: ["tenants"], label: "Lessee's initials for (d)" },
          ],
          changes: [
            ch("Federal, verify. (c) is now the lessee's own choice with initials (was a loose [Initials: Tenant] tag). Added the missing initials for (d).", "Lessee's Initials: [Initials: Tenant] ... (d) Lessee acknowledges they have received the pamphlet"),
          ],
        },
        {
          id: "agent-ack",
          title: "Agent's Acknowledgment",
          blocks: [
            p("(e) Agent has informed the lessor of the lessor's obligations under 42 U.S.C. 4852d and is aware of his/her responsibility to ensure compliance."),
            { kind: "initials", parties: ["agent"], label: "Agent's initials for (e) ({{agent_name}})" },
          ],
          changes: [ch("Federal, verify. Added the agent's acknowledgment (e), which was missing; SIM REI acts as agent, so it applies.")],
        },
        {
          id: "certification",
          title: "Certification of Accuracy",
          blocks: [
            p("The following parties have reviewed the information above and certify, to the best of their knowledge, that the information they have provided is true and accurate."),
            { kind: "signatures", parties: ["landlord"], label: "Lessor ({{landlord_name}})" },
            { kind: "signatures", parties: ["tenants"], label: "Lessee(s)" },
            { kind: "signatures", parties: ["agent"], label: "Agent ({{agent_name}})" },
          ],
          changes: [
            ch("Federal, verify. Certification moved to the end (it printed above the disclosure) and now has signature, printed name and date lines for the lessor, each lessee and the agent, instead of a single unlabeled line.", "X Date Signed"),
          ],
        },
      ],
    },
  ],
  fields: {
    property_address: f("Property address", "property", "123 Sample St, Eustis, FL 32726"),
    unit_name: f("Unit name or number", "unit", "A"),
    landlord_name: f("Lessor: owner's legal name (owning LLC)", "property", "Sample Holdings LLC"),
    agent_name: f("Agent (management company) legal name", "company", "SIM REI Property Management LLC"),
    tenant_names: f("Lessees (financially responsible tenants)", "lease", "Jordan Sample and Casey Sample"),
    lbp_known: f("(a) Known lead-based paint (known / no_knowledge), per property", "property", "no_knowledge"),
    lbp_records: f("(b) Records and reports (provided / none), per property", "property", "none"),
    lessee_records: f("(c) Lessee received records (received / not_received)", "lease", "not_received"),
  },
};
