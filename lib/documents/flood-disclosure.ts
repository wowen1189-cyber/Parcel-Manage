// Flood disclosure, Fla. Stat. 83.512 (separate document, given at or before signing a lease of 1 year or longer).
// Statutory text quoted word for word from docs/reference/florida-chapter-83-landlord-tenant-2025.html.
// Suggested changes from docs/reference/lease-review-2026-11.md (D1); attorney to approve before use.

import type { Block, DocumentTemplate, TemplateField } from "./types";

const p = (text: string): Block => ({ kind: "p", text });
const law = (text: string): Block => ({ kind: "statutory", text, cite: "Fla. Stat. 83.512(1)" });
const f = (label: string, source: TemplateField["source"], example: string): TemplateField => ({ label, source, example });

export const FLOOD_DISCLOSURE: DocumentTemplate = {
  id: "flood-disclosure",
  title: "Flood Disclosure",
  version: "2026-11 draft 1 (attorney review pending)",
  appliesTo: "Residential (Fla. Stat. ch. 83 Part II), s. 83.512",
  sections: [
    {
      id: "flood",
      number: "1",
      title: "Flood Disclosure",
      standalone: true,
      clauses: [
        {
          id: "flood-header",
          number: "1.1",
          title: "Section 83.512, Florida Statutes",
          blocks: [
            p("Property: {{property_address}}, Unit {{unit_name}}"),
            p("Landlord: {{landlord_name}}, by {{agent_name}}, its authorized agent"),
            p("Tenant(s): {{tenant_names}}"),
            p("Lease Term: {{lease_start_date}} to {{lease_end_date}}"),
          ],
          changes: [
            {
              finding: "D1",
              cite: "Fla. Stat. 83.512(1), 83.43",
              severity: "disclosure",
              summary: "\"Landlord\" now prints the owning LLC by SIM REI as agent, so the owner (whose \"ownership\" items 1-3 ask about) is the one disclosing.",
              before: "Landlord:[Company Name]",
            },
          ],
        },
        {
          id: "flood-form",
          blocks: [
            law("FLOOD DISCLOSURE"),
            law("Flood Insurance: Renters’ insurance policies do not include coverage for damage resulting from floods. Tenant is encouraged to discuss the need to purchase separate flood insurance coverage with Tenant’s insurance agent."),
            {
              kind: "choice",
              id: "flood_knowledge",
              prompt: "1.",
              setBy: "landlord",
              field: "flood_knowledge",
              options: [
                { id: "has", text: "Landlord has knowledge of any flooding that has damaged the dwelling unit during Landlord’s ownership of the dwelling unit." },
                { id: "has_no", text: "Landlord has no knowledge of any flooding that has damaged the dwelling unit during Landlord’s ownership of the dwelling unit." },
              ],
            },
            {
              kind: "choice",
              id: "flood_claim",
              prompt: "2.",
              setBy: "landlord",
              field: "flood_claim",
              options: [
                { id: "has", text: "Landlord has filed a claim with an insurance provider relating to flood damage in the dwelling unit, including, but not limited to, a claim with the National Flood Insurance Program." },
                { id: "has_not", text: "Landlord has not filed a claim with an insurance provider relating to flood damage in the dwelling unit, including, but not limited to, a claim with the National Flood Insurance Program." },
              ],
            },
            {
              kind: "choice",
              id: "flood_assistance",
              prompt: "3.",
              setBy: "landlord",
              field: "flood_assistance",
              options: [
                { id: "has", text: "Landlord has received assistance for flood damage to the dwelling unit, including, but not limited to, assistance from the Federal Emergency Management Agency." },
                { id: "has_not", text: "Landlord has not received assistance for flood damage to the dwelling unit, including, but not limited to, assistance from the Federal Emergency Management Agency." },
              ],
            },
            law("4. For the purposes of this disclosure, the term “flooding” means a general or temporary condition of partial or complete inundation of the dwelling unit caused by any of the following:"),
            law("a. The overflow of inland or tidal waters."),
            law("b. The unusual and rapid accumulation of runoff or surface waters from any established water source, such as a river, stream, or drainage ditch."),
            law("c. Sustained periods of standing water resulting from rainfall."),
          ],
          changes: [
            {
              finding: "D1",
              cite: "Fla. Stat. 83.512(1)",
              severity: "disclosure",
              summary: "Form text checked against the statute and kept word for word. Items 1-3 are now required has/has-not answers set per property by the owner, so the form cannot go out with no box checked. The app should not generate it until all three are answered.",
              before: "1.Landlord [ ] has/ [ ] hasnoknowledge",
            },
          ],
        },
        {
          id: "flood-ack",
          title: "Acknowledgment",
          blocks: [
            p("By signing below, Tenant acknowledges receiving this Flood Disclosure at or before execution of the rental agreement for the property identified above."),
            { kind: "signatures", parties: ["tenants"], label: "Tenant(s)" },
            { kind: "signatures", parties: ["agent"], label: "Landlord: {{landlord_name}}, by {{agent_name}}, its authorized agent (completed the answers above)" },
          ],
          changes: [
            {
              finding: "D1",
              cite: "Fla. Stat. 83.512(1)",
              severity: "disclosure",
              summary: "Added a landlord/agent signature and date so the record shows who completed the answers (recommended by the review; not required by the statute text). Tenant signature now has a printed name and date.",
              before: "X Date Signed",
            },
          ],
        },
      ],
    },
  ],
  fields: {
    property_address: f("Property address", "property", "123 Sample St, Eustis, FL 32726"),
    unit_name: f("Unit name or number", "unit", "A"),
    landlord_name: f("Landlord: owner's legal name (owning LLC)", "property", "Sample Holdings LLC"),
    agent_name: f("Agent (management company) legal name", "company", "SIM REI Property Management LLC"),
    tenant_names: f("Tenants (financially responsible)", "lease", "Jordan Sample and Casey Sample"),
    lease_start_date: f("Lease start date", "lease", "January 1, 2027"),
    lease_end_date: f("Lease end date", "lease", "December 31, 2027"),
    flood_knowledge: f("Item 1: owner has / has no knowledge of flooding (has / has_no), per property", "property", "has_no"),
    flood_claim: f("Item 2: owner has / has not filed a flood claim (has / has_not), per property", "property", "has_not"),
    flood_assistance: f("Item 3: owner has / has not received flood assistance (has / has_not), per property", "property", "has_not"),
  },
};
