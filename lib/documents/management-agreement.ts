// SIM REI's Property Management Agreement (Google Docs template, 6 pages) rebuilt as a structured template.
// Florida law it follows (ch. 475 and FREC rules are not in the saved ch. 83 file; checked against the
// statutes as published, verify on flsenate.gov before relying on a cite):
// - Fla. Stat. 475.01, 475.42(1)(a): managing rentals for others for a fee is brokerage; the agent must be a
//   licensed Florida real estate broker. 475.278 brokerage relationship notices don't apply to leasing.
// - Fla. Stat. 475.25(1)(k) and Fla. Admin. Code 61J2-14.008-.012: money held for others goes in a trust
//   (escrow) account at a Florida bank by the end of the third business day; records kept and open to the owner.
// - Fla. Stat. 83.49(1)-(3), (7): security deposits held in Florida, the tenant notice, the 30-day claim,
//   and moving deposits with an accounting when the agent changes or the property is sold.
// - Fla. Stat. 83.51: the landlord's maintenance duties stay the owner's; the agent performs them for the owner.
// - Fair housing: 42 U.S.C. 3604 and Fla. Stat. 760.23. Screening reports: FCRA, 15 U.S.C. 1681b, 1681m.
// - E-signatures: Fla. Stat. ch. 668 (incl. 668.50, UETA). Each side pays its own attorney's fees, which
//   57.105(7) doesn't change (it only makes one-sided fee clauses mutual).

import type { Block, Change, DocumentTemplate, TemplateField } from "./types";

const p = (text: string): Block => ({ kind: "p", text });
const list = (items: string[], ordered = false): Block => ({ kind: "list", items, ordered });
const ch = (finding: string, cite: string, severity: Change["severity"], summary: string, before?: string): Change =>
  before === undefined ? { finding, cite, severity, summary } : { finding, cite, severity, summary, before };
const f = (label: string, source: TemplateField["source"], example: string, fixedByLaw?: string): TemplateField =>
  fixedByLaw === undefined ? { label, source, example } : { label, source, example, fixedByLaw };

const sections: DocumentTemplate["sections"] = [
  {
    id: "parties",
    number: "1",
    title: "Parties and Properties",
    clauses: [
      {
        id: "parties",
        number: "1.1",
        title: "Parties",
        blocks: [
          p("This Property Management Agreement (the \"Agreement\") is made on {{agreement_date}} between **{{owner_name}}** (\"Owner\"), whose address is {{owner_address}}, and **{{agent_name}}** (\"Agent\"), {{agent_license}}, whose address is {{agent_address}}."),
        ],
        changes: [ch("M1", "Fla. Stat. 475.42(1)(a)", "must", "Names the Agent as a licensed Florida brokerage: managing rentals for someone else for a fee requires a broker's license. Removed the blank \"in consideration of ____\" line; the promises in the Agreement are the consideration.")],
      },
      {
        id: "properties",
        number: "1.2",
        title: "Properties",
        blocks: [
          p("Owner owns the following real property and hires Agent to manage it under this Agreement (each a \"Property\", together the \"Properties\"):"),
          p("{{property_list}}"),
          p("Owner may add a property by a signed addendum. If Owner sells a Property, this Agreement ends for that Property on the day the sale closes."),
        ],
        changes: [ch("M2", "n/a", "cleanup", "The property list fills in from Parcel Manage (every property of this owner, or the ones picked). Added what happens when a property is added or sold.")],
      },
    ],
  },
  {
    id: "term",
    number: "2",
    title: "Term and Termination",
    clauses: [
      {
        id: "term",
        number: "2.1",
        title: "Term",
        blocks: [p("This Agreement begins on {{start_date}} and ends on {{end_date}} ({{term_years}}).")],
      },
      {
        id: "renewal",
        number: "2.2",
        title: "Renewal",
        when: ["pma_auto_renew"],
        blocks: [p("This Agreement renews automatically for successive one-year terms on the same terms unless either party gives written notice of non-renewal at least {{notice_days}} days before the end of the then-current term.")],
        changes: [ch("M3", "n/a", "cleanup", "Added automatic yearly renewal so management doesn't lapse by accident. Either side can stop it with the same notice.", "The term of this contract shall be for three (3) years ... and will expire on ____")],
      },
      {
        id: "termination",
        number: "2.3",
        title: "Termination",
        blocks: [
          p("Either party may end this Agreement for any reason by giving the other at least {{notice_days}} days' written notice. Either party may end it sooner under Section 10 if the other defaults and does not cure."),
          p("When this Agreement ends: (a) Agent's fees earned through the end date remain due, including leasing and renewal fees for leases signed before the end date; (b) Agent may keep, for up to thirty (30) days, enough of Owner's funds to pay bills already approved or incurred, then accounts for them; (c) within thirty (30) days Agent delivers to Owner (or Owner's new agent) a final accounting, the remaining funds, the leases, tenant files, keys and records for the Properties; and (d) Agent transfers all security deposits and advance rents, with any interest earned and an accurate accounting, and notifies each tenant in writing who holds the deposit, as Fla. Stat. 83.49(7) requires."),
        ],
        changes: [ch("M4", "Fla. Stat. 83.49(7)", "must", "Spelled out the hand-off when management ends: what fees stay earned, the final accounting, and moving security deposits to the owner or new agent with notice to tenants, which Florida law requires.")],
      },
    ],
  },
  {
    id: "authority",
    number: "3",
    title: "Agent's Authority",
    clauses: [
      {
        id: "authority-intro",
        blocks: [p("Owner appoints Agent as Owner's exclusive agent to manage the Properties and gives Agent the authority below, to be exercised in Owner's name and for Owner's account:")],
      },
      {
        id: "leasing",
        number: "3.1",
        title: "Leasing",
        when: ["pma_leasing"],
        blocks: [p("To advertise the Properties, show them, place signs, screen applicants, and sign leases, renewals and amendments in Owner's name, using Agent's lease forms and at rents and terms within the market range for the Property. Owner may set a minimum rent or other leasing terms in writing.")],
        changes: [ch("M5", "n/a", "cleanup", "Replaced \"according to a rent schedule ... approved in advance by owner\" and the advertising budget with market-rate authority unless the owner sets a minimum, so vacancies aren't held up waiting for approval.")],
      },
      {
        id: "rents",
        number: "3.2",
        title: "Rents and Deposits",
        blocks: [p("To collect rents, fees, security deposits and other charges, to give receipts, and to hold and disburse those funds as this Agreement provides.")],
      },
      {
        id: "notices-evictions",
        number: "3.3",
        title: "Notices and Evictions",
        when: ["pma_evictions"],
        blocks: [p("To serve notices on tenants (including notices under Fla. Stat. 83.56 and 83.20), to end tenancies, and to hire an attorney to bring actions in Owner's name to collect money owed and recover possession. Eviction costs are Owner's; an uncontested eviction typically costs {{eviction_estimate}} in attorney's and court fees, billed by the attorney and paid by Owner directly or from Owner's funds.")],
      },
      {
        id: "contractors",
        number: "3.4",
        title: "Contractors, Service Contracts and Repairs",
        when: ["pma_contractors"],
        blocks: [p("To hire, supervise and replace contractors and vendors; to sign contracts for utilities, trash, pest control, lawn care and other services; and to order and pay for repairs, maintenance and supplies, within the spending limit in Section 4.2. Contractors work for Owner's account; Agent requires them to carry the license and insurance the work calls for.")],
        changes: [ch("M6", "n/a", "cleanup", "Removed the statement that all contractors are \"deemed to be working on behalf of the agent\", which could make the agent liable for every vendor. Agent now checks that vendors are licensed and insured (Parcel Manage tracks W-9s and insurance).")],
      },
      {
        id: "assignment",
        number: "3.5",
        title: "Assignment",
        blocks: [p("Agent may assign this Agreement only to another licensed Florida real estate brokerage, and only after giving Owner at least thirty (30) days' written notice. Owner may end this Agreement without penalty during that notice period. Owner may not assign this Agreement without Agent's written consent.")],
        changes: [ch("M7", "Fla. Stat. 475.42(1)(a)", "must", "The old clause let the agent assign the agreement to \"any third party without notice\". Only a licensed brokerage can manage for a fee, and the owner should know who holds their money, so assignment now needs a licensed broker, notice and a way out.", "The Agent may assign this agreement, in whole or in part, to any third party without notice to or consent from the owner.")],
      },
      {
        id: "disbursements",
        number: "3.6",
        title: "Paying Owner's Obligations",
        when: ["pma_disbursements"],
        blocks: [p("To pay from Owner's funds the mortgage payments, property taxes, insurance premiums, association dues and other recurring obligations Owner lists in writing, for the fee in Section 6.")],
      },
    ],
  },
  {
    id: "duties",
    number: "4",
    title: "Agent's Duties",
    clauses: [
      {
        id: "duties",
        number: "4.1",
        title: "Services",
        blocks: [
          p("Agent will use reasonable care and diligence to manage the Properties, including to:"),
          list([
            "Advertise, market and show vacancies, and screen every applicant with the same written criteria, including credit, eviction and criminal history checks, as fair housing and consumer reporting laws require.",
            "Inspect the exterior of each Property at least {{inspection_frequency}}, inspect units at move-in and move-out, and report needed repairs to Owner.",
            "Arrange routine and preventive maintenance and repairs, including roofs, gutters, paint, pavement, fences, windows, plumbing and sewer lines, so the Properties meet the landlord's duties under Fla. Stat. 83.51 and local codes.",
            "Require each residential tenant to carry renters liability insurance of at least {{residential_liability}} and each commercial tenant to carry general liability insurance of at least {{commercial_liability}}, naming Owner and Agent as required by the lease.",
            "Keep complete books and records for each Property, give Owner online access to statements, and let Owner inspect and audit the books during normal business hours.",
            "Check that vendors perform their contracts, and tell Owner when a vendor's work is inadequate.",
            "Tell Owner promptly about any notice, demand, summons, code violation or claim received about a Property.",
            "Issue Owner the IRS Form 1099 for each year's rents by January 31 of the next year.",
          ]),
        ],
        changes: [
          ch("M8", "42 U.S.C. 3604; Fla. Stat. 760.23; 15 U.S.C. 1681b", "must", "Screening now says the same written criteria apply to every applicant, as fair housing law and the FCRA require."),
          ch("M9", "n/a", "cleanup", "Combined the separate duty items (A-M) into one list; the quarterly exterior inspection, insurance minimums and 1099 stay. Added move-in and move-out inspections and online statements."),
        ],
      },
      {
        id: "spending",
        number: "4.2",
        title: "Spending Limit",
        blocks: [p("Agent will get Owner's approval before spending more than {{approval_limit}} on any one repair or purchase, except for (a) recurring operating expenses Owner has approved, (b) emergencies that threaten life, health, safety or the Property, or that must be fixed to meet the landlord's duties under Fla. Stat. 83.51 or a code order, and (c) urgent expenses when Owner cannot be reached after reasonable effort. Agent will tell Owner about any emergency spending as soon as practical.")],
      },
      {
        id: "fair-housing",
        number: "4.3",
        title: "Fair Housing",
        blocks: [p("Agent manages the Properties in compliance with federal, Florida and local fair housing laws. Agent will not follow any instruction to discriminate on the basis of race, color, religion, sex, national origin, disability, familial status or any other protected class, and will grant reasonable accommodations and modifications as the law requires, including assistance animals, which are not pets.")],
        changes: [ch("M10", "42 U.S.C. 3604(f); Fla. Stat. 760.23, 760.27", "must", "Added a clear fair housing clause: the agent can refuse a discriminatory instruction, and assistance animals are handled as the law requires.")],
      },
    ],
  },
  {
    id: "money",
    number: "5",
    title: "Owner's Funds and Statements",
    clauses: [
      {
        id: "trust",
        number: "5.1",
        title: "Trust Accounts",
        blocks: [p("Agent deposits rents and other money received for Owner in a trust (escrow) account at a bank in Florida, separate from Agent's own money, no later than the end of the third business day after receipt, as Florida's real estate license law requires (Fla. Stat. 475.25(1)(k); Fla. Admin. Code 61J2-14). Security deposits and advance rent are held as Fla. Stat. 83.49 requires, and Agent gives tenants the deposit notice that section requires.")],
        changes: [ch("M11", "Fla. Stat. 475.25(1)(k), 83.49(1)-(2); Fla. Admin. Code 61J2-14.008", "must", "Added how the owner's money and the tenants' deposits are held: in a Florida trust account, deposited within three business days, and deposits handled under 83.49. The old agreement didn't say.")],
      },
      {
        id: "statements",
        number: "5.2",
        title: "Monthly Statements and Distributions",
        blocks: [p("By the {{distribution_day}} day of each month, Agent provides Owner a statement for the prior month itemizing all money received and paid out, and pays Owner the balance after expenses, Agent's fees and the reserve in Section 5.3. If expenses for a month exceed the money received, Owner pays Agent the difference within ten (10) days after Agent's request.")],
        changes: [ch("M12", "n/a", "cleanup", "Kept payment by the 1st for the prior month, now with the statement on the same date, and the date can be changed per agreement. Added a deadline for the owner to cover a month when expenses exceed rent (the old agreement had none).", "To deposit all collected funds for the owner by the 1st of each month, for the previous month")],
      },
      {
        id: "reserve",
        number: "5.3",
        title: "Reserve",
        blocks: [p("Agent keeps a reserve of {{reserve_amount}} of Owner's funds in the trust account for repairs and expenses. Owner may change the reserve in writing.")],
        changes: [ch("M13", "n/a", "cleanup", "The old agreement said the agent keeps no reserve and all repairs come out of the month's rent. The reserve is now a set amount per owner (it can be $0), which Parcel Manage already uses when it pays owners.", "The agent does not keep a reserve account for such expenses")],
      },
      {
        id: "deposit-claims",
        number: "5.4",
        title: "Security Deposit Claims",
        blocks: [p("After a tenant moves out, Agent returns the deposit or sends the written notice of claim within the time limits of Fla. Stat. 83.49(3) and handles any objection. Owner agrees Agent may make those decisions, and Owner pays any amount a court awards a tenant on a deposit claim unless Agent failed to follow the law.")],
      },
    ],
  },
  {
    id: "fees",
    number: "6",
    title: "Agent's Compensation",
    clauses: [
      {
        id: "fees",
        number: "6.1",
        title: "Fees",
        blocks: [
          p("Owner pays Agent the following, which Agent may deduct from Owner's funds when due:"),
          list([
            "**Management fee:** {{management_fee}}.",
            "**Leasing fee** (new lease with a tenant Agent procures): {{leasing_fee}}.",
            "**Renewal fee** (lease renewal or extension): {{renewal_fee}}.",
            "**Paying Owner's obligations** (Section 3.6, if chosen): {{disbursement_fee}}.",
            "**Late W-9:** {{w9_fee}} if Owner does not provide a valid IRS Form W-9 within thirty (30) days after Agent asks for it; Agent may also hold distributions until it is provided.",
          ]),
          p("Fees are earned when the rent is collected (management fee) or when the lease is signed (leasing and renewal fees). Agent will not change these fees without a signed amendment."),
        ],
        changes: [ch("M14", "n/a", "cleanup", "The fees fill in from what's set for this owner in Parcel Manage, so the agreement and the fees actually charged always match. The template's 10% / 50% / 25% are replaced by the owner's terms.", "Management Fee totaling 10.00% of gross monthly income. Lease Fee of 50% Of First Month's Rent. Lease Renewal Fee of 25% Of Renewal Rent")],
      },
      {
        id: "re-lease",
        number: "6.2",
        title: "Re-Leasing Guarantee",
        blocks: [p("If a tenant Agent procured, for whom Owner paid a leasing fee, moves out within {{release_months}} months after the lease starts, Agent will lease the unit again without another leasing fee.")],
      },
      {
        id: "tenant-fees",
        number: "6.3",
        title: "Fees Paid by Tenants",
        blocks: [
          p("Agent sets and collects the following tenant fees, within the limits of Florida law and the lease, and they belong to the party shown:"),
          {
            kind: "table",
            head: ["Fee", "Belongs to"],
            rows: [
              ["Application fees (cost of screening)", "Agent"],
              ["Administrative fees (processing and lease preparation)", "Agent"],
              ["Late fees", "Agent"],
              ["Returned payment (NSF) fees", "Agent"],
              ["Lockout fees", "Agent"],
              ["Renters insurance or deposit-alternative program administration fees, as allowed by law", "Agent"],
              ["Pet fees and pet rent", "Owner, less the management fee"],
              ["Rent, utility reimbursements and other charges", "Owner, less the management fee"],
            ],
          },
          p("Agent never charges a fee for an assistance animal."),
        ],
        changes: [ch("M15", "Fla. Stat. 626.112; 760.27", "attorney", "\"Insurance Services - 100% to Agent\" now says administration fees allowed by law: being paid a commission for selling insurance needs a Florida insurance license. Added that assistance animals never carry a fee. Ask your attorney if Agent receives any insurance commissions.", "Insurance Services - 100% to Agent")],
      },
    ],
  },
  {
    id: "owner",
    number: "7",
    title: "Owner's Duties",
    clauses: [
      {
        id: "owner-duties",
        number: "7.1",
        title: "Owner Agrees",
        blocks: [
          list([
            "To give Agent the information, records, keys, codes, warranties, leases and tenant files Agent needs, including the facts for the disclosures Florida and federal law require (flood history under Fla. Stat. 83.512, lead-based paint for homes built before 1978, and radon).",
            "To give Agent a valid IRS Form W-9 and tell Agent of any change in ownership, mortgage or insurance.",
            "To pay all Property expenses, including taxes, insurance, utilities Owner is responsible for, and association dues, when Agent is not paying them under Section 3.6.",
            "To keep the Properties in compliance with building, housing and health codes, and to fund repairs the law requires.",
            "Not to deal with tenants or applicants about the Properties except through Agent, and to refer all inquiries to Agent.",
          ]),
        ],
        changes: [ch("M16", "Fla. Stat. 83.512; 42 U.S.C. 4852d", "disclosure", "Added that the owner supplies the facts for the flood, lead paint and radon disclosures, which the lease can't be signed without.")],
      },
      {
        id: "insurance",
        number: "7.2",
        title: "Owner's Insurance",
        blocks: [p("Owner keeps, at Owner's expense, property insurance on each Property at replacement cost, and liability insurance of at least {{owner_liability}} per occurrence naming Agent as an additional insured. Owner decides on flood and windstorm coverage. Owner gives Agent a certificate of each policy on request. Agent does not choose or buy Owner's insurance and is not responsible for any gap in coverage.")],
        changes: [ch("M17", "n/a", "must", "Owner's liability policy now names the Agent as an additional insured with a minimum amount. The old agreement only said the owner carries liability and fire insurance, which leaves the agent uncovered when a tenant sues both.", "To carry at its own expense liability insurance ... To carry a fire insurance policy on the property.")],
      },
    ],
  },
  {
    id: "representations",
    number: "8",
    title: "Owner's Representations",
    clauses: [
      {
        id: "reps",
        blocks: [
          p("Owner represents that:"),
          list([
            "Owner owns the Properties and has the authority to sign this Agreement; the person signing for Owner is authorized to do so.",
            "Signing this Agreement does not break any mortgage, loan, lease or other agreement Owner is a party to.",
            "No lawsuit, foreclosure or code enforcement action about the Properties has been served on Owner or, to Owner's knowledge, threatened in writing, except as Owner has told Agent in writing.",
            "To Owner's knowledge, the Properties comply with applicable codes and there are no hazardous materials on them, except as Owner has told Agent in writing.",
          ]),
        ],
        changes: [ch("M18", "n/a", "cleanup", "The owner now promises code compliance \"to Owner's knowledge\". The old version promised the property complies with every code \"continuing forward\", which no owner can guarantee and which conflicts with the agent's job of finding and fixing problems.", "complies with all applicable building codes, laws and regulations")],
      },
    ],
  },
  {
    id: "liability",
    number: "9",
    title: "Indemnification and Liability",
    clauses: [
      {
        id: "indemnity",
        number: "9.1",
        title: "Indemnification",
        blocks: [
          p("Owner will defend, indemnify and hold harmless Agent and its brokers, employees and agents from all claims, losses, fines and expenses (including reasonable attorney's fees) arising from the Properties or Agent's work under this Agreement, including tenant claims, unpaid rent, repairs and work by contractors, except to the extent caused by Agent's gross negligence, willful misconduct, breach of this Agreement or violation of law."),
          p("Agent will defend, indemnify and hold harmless Owner from all claims, losses and expenses (including reasonable attorney's fees) to the extent caused by Agent's gross negligence, willful misconduct, breach of this Agreement or violation of law, including fair housing and trust account laws."),
        ],
        changes: [ch("M19", "n/a", "attorney", "The indemnity now runs both ways and excludes the agent's own gross negligence, misconduct or law violations. A clause covering the agent \"for any reason\" is the kind Florida courts read narrowly and may not enforce, so the balanced version is safer to rely on.", "Agent shall be indemnified against any loss or damages sustained to property for any reason.")],
      },
      {
        id: "limits",
        number: "9.2",
        title: "Limits",
        blocks: [p("Agent is not liable for: (a) a tenant's failure to pay rent or damage to a Property by a tenant or anyone else; (b) the failure of a bank holding Owner's funds or deposits, if Agent chose a federally insured Florida bank; or (c) delays or failures caused by events beyond Agent's reasonable control, such as hurricanes, floods, fire, epidemics, strikes, supply shortages or government orders. Agent does not guarantee rent or occupancy. Except for its own conduct, Agent is not responsible for a Property's compliance with laws, but will tell Owner promptly of any complaint or notice received.")],
      },
      {
        id: "survival",
        number: "9.3",
        title: "Survival",
        blocks: [p("This Section 9 continues after this Agreement ends.")],
      },
    ],
  },
  {
    id: "default",
    number: "10",
    title: "Default",
    clauses: [
      {
        id: "default",
        blocks: [
          p("If either party fails to perform this Agreement, the other may give written notice describing the failure. If it is not cured within thirty (30) days after the notice (or within five (5) business days for a failure to pay or account for money), the party giving notice may end this Agreement immediately by written notice and pursue any remedy the law allows. Each party pays its own attorney's fees in any dispute about this Agreement, unless a court orders otherwise."),
        ],
        changes: [ch("M20", "Fla. Stat. 57.105(7)", "cleanup", "Kept the 30-day cure and each side paying its own legal fees; added a shorter five-business-day cure for money, since trust funds can't wait a month.")],
      },
    ],
  },
  {
    id: "notices",
    number: "11",
    title: "Notices",
    clauses: [
      {
        id: "notices",
        blocks: [p("Notices under this Agreement must be in writing and delivered by hand, by certified mail or a national courier to the address in Section 1.1, or by e-mail to Owner at {{owner_email}} and to Agent at {{agent_email}}. A notice is given when delivered, or for e-mail when sent without a bounce-back.")],
        changes: [ch("M21", "Fla. Stat. 668.50", "cleanup", "Added the actual e-mail addresses so \"other electronic means\" is clear.", "Certified Mail or other electronic means")],
      },
    ],
  },
  {
    id: "general",
    number: "12",
    title: "General",
    clauses: [
      {
        id: "general",
        blocks: [
          list([
            "**Entire agreement.** This Agreement is the whole agreement about managing the Properties and replaces any earlier agreement. It can be changed only in a writing signed by both parties.",
            "**Florida law.** Florida law governs this Agreement. Any lawsuit about it is brought in the county where the Property is located.",
            "**Severability.** If a court finds part of this Agreement unenforceable, the rest stays in effect.",
            "**Electronic signatures.** The parties may sign this Agreement electronically and in counterparts; electronic signatures have the same effect as handwritten ones (Fla. Stat. ch. 668).",
            "**Records.** Agent keeps the records for the Properties for at least five (5) years, as Florida's broker rules require.",
          ]),
        ],
      },
    ],
  },
  {
    id: "signatures",
    title: "Signatures",
    clauses: [
      {
        id: "signatures",
        blocks: [
          p("The parties sign this Agreement to be effective on the start date in Section 2.1."),
          { kind: "signatures", parties: ["owner", "agent"] },
          p("Owner: {{owner_name}}, by {{owner_signer}}. Agent: {{agent_name}}, by its broker."),
        ],
        changes: [ch("M22", "Fla. Stat. 668.50", "cleanup", "Signing is through Parcel Manage's e-signature, which records each signer's consent, time, IP address and device on the signature certificate, so the IP address blanks are gone. Removed the stray \"Would you like me to export this...\" line at the end of the old file.")],
      },
    ],
  },
];

const fields: Record<string, TemplateField> = {
  agreement_date: f("Agreement date", "computed", "November 1, 2026"),
  owner_name: f("Owner (name on the deed)", "lease", "Sample Holdings LLC"),
  owner_address: f("Owner's address", "lease", "1 Sample Way, Eustis, FL 32726"),
  owner_email: f("Owner's e-mail", "lease", "owner@example.com"),
  owner_signer: f("Person signing for the owner, and title", "lease", "Jordan Sample, Manager"),
  agent_name: f("Agent (brokerage)", "company", "SIM REI Property Management"),
  agent_license: f("Agent's license", "company", "a licensed Florida real estate brokerage"),
  agent_address: f("Agent's address", "company", "432 N Eustis St, Eustis, FL 32726"),
  agent_email: f("Agent's e-mail", "company", "info@simrei.com"),
  property_list: f("Properties", "property", "Sample Building, 5 Oak Ln, Eustis, FL 32726"),
  start_date: f("Start date", "lease", "December 1, 2026"),
  end_date: f("End date", "computed", "November 30, 2029"),
  term_years: f("Term", "computed", "three years"),
  notice_days: f("Notice to end (days)", "setting", "60"),
  eviction_estimate: f("Uncontested eviction cost estimate", "setting", "$1,000 to $2,500"),
  inspection_frequency: f("Exterior inspection frequency", "setting", "once a quarter"),
  residential_liability: f("Residential tenant liability minimum", "setting", "$100,000"),
  commercial_liability: f("Commercial tenant liability minimum", "setting", "$1,000,000"),
  approval_limit: f("Spending limit without approval", "setting", "$500.00"),
  distribution_day: f("Statement and payment day", "setting", "1st"),
  reserve_amount: f("Reserve", "property", "$0.00"),
  management_fee: f("Management fee", "setting", "5% of gross income collected each month"),
  leasing_fee: f("Leasing fee", "setting", "none"),
  renewal_fee: f("Renewal fee", "setting", "none"),
  disbursement_fee: f("Fee for paying owner's obligations", "setting", "$130.00 per property per month"),
  w9_fee: f("Late W-9 fee", "setting", "$50.00"),
  release_months: f("Re-leasing guarantee (months)", "setting", "6"),
  owner_liability: f("Owner's liability insurance minimum", "setting", "$1,000,000"),
};

export const MANAGEMENT_AGREEMENT: DocumentTemplate = {
  id: "management-agreement",
  title: "Property Management Agreement",
  version: "2026-11",
  appliesTo: "Owner and managing broker (Fla. Stat. ch. 475; ch. 83 for tenant funds)",
  sections,
  fields,
};
