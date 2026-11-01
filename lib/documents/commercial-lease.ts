// SIM REI commercial lease ("Updated Commercial Lease", 13 sections) rebuilt as a structured template,
// checked against Florida law for nonresidential tenancies: Fla. Stat. ch. 83 Part I (83.001-83.251),
// docs/reference/florida-chapter-83-landlord-tenant-2025.html. Also cited: 404.056(5) (radon notice),
// 713.10 (liens on the landlord's interest), 790.251 (firearms locked in vehicles), 687 (usury cap).
// Approved for use by Wesley Owen, Nov 1, 2026 (docs/02-business-rules.md).

import type { Block, Change, DocumentTemplate, TemplateField } from "./types";

const p = (text: string): Block => ({ kind: "p", text });
const list = (items: string[], ordered = false): Block => ({ kind: "list", items, ordered });
const law = (text: string, cite: string): Block => ({ kind: "statutory", text, cite });
const ch = (finding: string, cite: string, severity: Change["severity"], summary: string, before?: string): Change =>
  before === undefined ? { finding, cite, severity, summary } : { finding, cite, severity, summary, before };
const f = (label: string, source: TemplateField["source"], example: string, fixedByLaw?: string): TemplateField =>
  fixedByLaw === undefined ? { label, source, example } : { label, source, example, fixedByLaw };

const sections: DocumentTemplate["sections"] = [
  // ───────────────────────────── 1 Lease Summary ─────────────────────────────
  {
    id: "summary",
    number: "1",
    title: "Lease Summary",
    initials: true,
    clauses: [
      {
        id: "key-provisions",
        number: "1.1",
        title: "Key Provisions",
        blocks: [
          list([
            "**Lease prepared:** {{lease_prepared_date}}",
            "**Landlord:** {{landlord_name}}, by its agent {{agent_name}}",
            "**Tenant:** {{tenant_legal_name}}",
            "**Premises:** {{premises_address}}, approximately {{premises_sqft}} square feet",
            "**Landlord's notice address:** {{agent_name}}, {{agent_address}}; {{agent_phone}}; {{agent_email}}",
            "**Tenant's notice address:** {{tenant_notice_address}}; {{tenant_phone}}; {{tenant_email}}",
            "**Commencement Date:** {{lease_start_date}}",
            "**Initial Lease Term:** {{lease_term_months}} months",
            "**Expiration Date:** {{lease_end_date}}",
            "**Renewal option:** {{renewal_summary}}",
            "**Base Rent (monthly):** {{rent_schedule}}",
            "**Utilities:** {{utilities_summary}}",
            "**CAM fee:** {{cam_summary}}",
            "**Rent payment address:** {{agent_address}}, or online through the tenant portal",
            "**Permitted Use:** {{permitted_use}}, in compliance with all applicable laws, rules and regulations",
            "**Security Deposit:** {{security_deposit}}",
          ]),
        ],
        changes: [
          ch("C1", "n/a", "cleanup", "Every value in the summary now fills in from the lease, the property and the company, and the Base Rent line prints the full rent schedule. The landlord is named as the owning LLC acting through SIM REI as its agent."),
        ],
      },
    ],
  },

  // ───────────────────────────── 2 Lease Terms ─────────────────────────────
  {
    id: "terms",
    number: "2",
    title: "Lease Terms",
    initials: true,
    clauses: [
      {
        id: "summary-controls",
        number: "2.1",
        title: "Key Provisions Summary and Exhibits",
        blocks: [
          p("References in this Lease to a part of the Key Provisions Summary include all of the terms under that part, and references in the Key Provisions Summary to a Section of this Lease include all of the terms of that Section. If the Key Provisions Summary and another part of this Lease are inconsistent, the Key Provisions Summary controls. The Exhibits in Section 12 are part of this Lease, and each party shall perform its obligations under them. Unless this Lease expressly says otherwise, a consent or approval required under this Lease will not be unreasonably withheld, delayed or conditioned."),
        ],
      },
      {
        id: "definitions",
        number: "2.2",
        title: "Definitions",
        blocks: [
          list([
            "**\"Additional Rent\"** means all sums other than Base Rent that become due from Tenant under this Lease. Additional Rent is a charge for the use, possession and enjoyment of the Premises.",
            "**\"Building\"** means the building in which the Premises are located, and **\"Land\"** means the real property on which the Building sits, described in Exhibit A. **\"Property\"** means the Building, the Land and the Common Areas together.",
            "**\"Business Day\"** means any day other than a Saturday, Sunday or Normal Business Holiday.",
            "**\"Common Areas\"** means all areas, improvements, space and services within the Building or on the Land that Landlord provides from time to time for the common use of tenants, customers and invitees, including parking areas, drives, entrances and exits, landscaped areas, walkways, sidewalks, corridors, restrooms, signs, hallways, lobbies, stairs and trash areas.",
            "**\"Default Rate\"** means interest at the lesser of eighteen percent (18%) per year or the highest rate allowed by Florida law.",
            "**\"Governmental Regulations\"** means all federal, state, county and municipal laws, ordinances, rules, regulations, orders and requirements, and all recorded declarations, covenants and restrictions, now or later in force, affecting the Property.",
            "**\"Landlord Parties\"** means Landlord's affiliated entities and Landlord's and their agents (including {{agent_name}}), employees, officers, members, managers, contractors, successors and assigns.",
            "**\"Normal Business Holidays\"** means New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving and Christmas Day.",
            "**\"Normal Business Hours\"** means 8:00 a.m. to 6:00 p.m., Monday through Friday, and 8:00 a.m. to 1:00 p.m. on Saturday, excluding Normal Business Holidays.",
            "**\"Premises\"** means the space in the Building leased to Tenant and described in the Key Provisions Summary.",
            "**\"Rent\"** means Base Rent and Additional Rent.",
            "**\"Rules and Regulations\"** means the rules in Exhibit C and any other reasonable rules Landlord adopts for the Property or the Common Areas and gives Tenant in writing.",
            "**\"Taxes\"** means all real estate and ad valorem taxes, assessments and other governmental charges imposed on the Property.",
            "**\"Tenant Parties\"** means Tenant's employees, agents, contractors, representatives, customers, invitees, guests, licensees and visitors.",
            "**\"Waiver.\"** A party waives a provision of this Lease only in a writing signed by the party against whom the waiver is enforced. No failure or delay in exercising a right or remedy, and no course of dealing, is a waiver. A waiver given once does not apply to any later occasion.",
          ]),
        ],
        changes: [
          ch("C2", "n/a", "must", "\"Premises\" was defined as \"the Building and the Land\", which would have made the tenant responsible for the whole building, its roof and its land. It now means the leased space only, and Building, Land and Property are defined separately.", "\"Premises\" means the Building and the Land."),
          ch("C3", "Fla. Stat. 687.02, 687.03", "cleanup", "Added the missing definitions the lease relied on: Business Day and Default Rate (capped at 18% a year or the legal limit). \"Writ\" corrected to \"writing\" in Waiver. Rules and Regulations are Exhibit C (the old lease said both C and D).", "waive any provision of this Lease only by a writ executed"),
        ],
      },
      {
        id: "premises",
        number: "2.3",
        title: "Premises",
        blocks: [p("Landlord leases the Premises to Tenant, and Tenant leases the Premises from Landlord, on the terms of this Lease.")],
      },
      {
        id: "common-areas",
        number: "2.4",
        title: "Common Areas",
        blocks: [
          p("Tenant and the Tenant Parties may use the Common Areas in common with other tenants and occupants of the Property. Landlord may, without liability to Tenant, change the size, use, shape, location or nature of the Common Areas, or eliminate a Common Area, so long as Tenant continues to have reasonable access to the Premises and the change does not materially interfere with the Permitted Use. No easement for view, light or air is granted."),
        ],
      },
      {
        id: "term",
        number: "2.5",
        title: "Lease Term and Renewal",
        blocks: [
          p("This Lease begins on the Commencement Date and ends on the Expiration Date. {{renewal_clause}}"),
          p("Tenant may renew only if (i) this Lease is in full force when Tenant gives notice and when the renewal term begins, (ii) no Event of Default exists, and (iii) Tenant has not assigned this Lease or sublet any part of the Premises; the right to renew is personal to Tenant. If Tenant does not give timely written notice, Tenant has waived the renewal option, time being of the essence. Each renewal term is on the terms of this Lease, except that Base Rent for the renewal term will be agreed in writing before it begins; if the parties do not agree in writing at least thirty (30) days before the Expiration Date, this Lease ends on the Expiration Date. The initial term and any renewal terms are together the \"Lease Term\"."),
        ],
        changes: [
          ch("C4", "Fla. Stat. 83.04", "cleanup", "Renewal notice period and number of renewal terms are now per-lease terms printed in the summary. Added what happens if renewal rent is not agreed, so the option can't leave the lease in limbo."),
        ],
      },
      {
        id: "entire-agreement",
        number: "2.6",
        title: "Entire Agreement",
        blocks: [
          p("THIS LEASE IS THE FINAL, COMPLETE AND EXCLUSIVE AGREEMENT OF THE PARTIES ON ITS SUBJECT. ALL PRIOR AND CONTEMPORANEOUS NEGOTIATIONS AND AGREEMENTS ARE MERGED INTO IT. IN ENTERING INTO THIS LEASE, NEITHER PARTY HAS RELIED ON ANY STATEMENT, REPRESENTATION OR AGREEMENT OF THE OTHER EXCEPT THOSE EXPRESSLY IN THIS LEASE. THIS LEASE MAY BE CHANGED ONLY BY A WRITING SIGNED BY BOTH PARTIES."),
        ],
      },
    ],
  },

  // ───────────────────────────── 3 Delivery of the Premises ─────────────────────────────
  {
    id: "delivery",
    number: "3",
    title: "Delivery of the Premises",
    initials: true,
    clauses: [
      {
        id: "acceptance",
        number: "3.1",
        title: "Effectiveness",
        blocks: [p("Delivering this Lease to the other party is not an offer to lease. This Lease takes effect only when signed and delivered by both Landlord and Tenant.")],
      },
      {
        id: "counterparts",
        number: "3.2",
        title: "Counterparts and Electronic Signatures",
        blocks: [
          p("This Lease may be signed in counterparts, each of which is an original and all of which are one agreement. Signatures delivered electronically (including by e-signature or scanned PDF) are as effective as original signatures."),
        ],
        changes: [ch("C5", "Fla. Stat. 668.50", "cleanup", "Replaced the fax wording with electronic signatures, which Parcel Manage uses, and dropped the requirement to also deliver a paper copy.")],
      },
      {
        id: "authority",
        number: "3.3",
        title: "Authority",
        blocks: [
          p("Each party represents that this Lease has been duly authorized, signed and delivered by it and is its valid and binding agreement. Tenant represents that it has full authority to enter into this Lease without any third party's approval and that this Lease does not violate any agreement binding on Tenant."),
        ],
      },
      {
        id: "as-is",
        number: "3.4",
        title: "Condition of the Premises",
        blocks: [
          p("Except for Landlord's Work and the warranty below, Tenant has inspected the Premises and accepts them \"AS IS\" in their present condition as suitable for the Permitted Use. Taking possession is conclusive evidence that the Premises are in good and satisfactory condition when possession is taken. Neither Landlord nor any Landlord Party has made any representation or warranty about the Premises, or promised to alter or improve them, except as expressly set out in this Lease."),
          p("Landlord warrants that the existing heating, air-conditioning, plumbing and electrical systems serving the Premises will be in good working order on the Commencement Date. Landlord will repair, at its cost, any failure of those systems not caused by Tenant's misuse, neglect or alterations that Tenant reports in writing within {{warranty_days}} days after the Commencement Date (the \"Warranty Period\"). After the Warranty Period, Sections 6.2 and 6.3 govern."),
        ],
      },
      {
        id: "failure-to-open",
        number: "3.5",
        title: "Opening for Business",
        blocks: [
          p("If Tenant does not open for business in the Premises by the Commencement Date for reasons within Tenant's reasonable control, Tenant shall pay Landlord, in addition to Rent, liquidated damages of one one-hundred-eightieth (1/180th) of the first lease year's annual Base Rent for each day the failure continues. The parties agree Landlord's damages from such a failure are not reasonably ascertainable now and this amount is a reasonable estimate of them, not a penalty."),
          p("If the failure continues for ninety (90) days after the Commencement Date, it is an Event of Default, and Landlord may terminate this Lease by written notice to Tenant and recover possession of the Premises as allowed by Florida law (Section 8.3)."),
        ],
        changes: [
          ch("C6", "Fla. Stat. 83.05(2)", "must", "Removed the landlord's right to \"reenter ... and remove all persons ... with or without legal proceedings\" and the tenant's waiver of damages for being ousted. Florida lets a landlord recover commercial premises only through a court action, the tenant's surrender, or abandonment.", "remove all persons therefrom with or without legal proceedings"),
        ],
      },
      {
        id: "landlord-work",
        number: "3.6",
        title: "Landlord's Work",
        blocks: [
          p("Landlord, at its expense, shall complete the work listed in Exhibit B-1 (\"Landlord's Work\"). Otherwise Landlord delivers the Premises as they are. The day Landlord delivers the Premises to Tenant with Landlord's Work substantially complete is the \"Delivery Date\". Tenant's taking possession to install fixtures or equipment, perform Tenant's Work or for any other purpose is conclusive evidence that the Premises and Landlord's Work are satisfactory. Any other work Landlord does at Tenant's request is at Tenant's expense, payable as Landlord reasonably requires (including in advance)."),
        ],
      },
      {
        id: "tenant-work",
        number: "3.7",
        title: "Tenant's Work",
        blocks: [
          p("Any improvements Tenant needs to open for business and operate under applicable law (\"Tenant's Work\") are listed in Exhibit B-2 and are at Tenant's expense. Before starting, Tenant shall submit plans for Landlord's written approval. Tenant shall perform Tenant's Work in a good and workmanlike manner, in compliance with law and the approved plans, and shall pay all permit, impact and similar fees. From the Delivery Date, Tenant shall (i) take possession and assume responsibility for utilities furnished to the Premises, (ii) diligently perform Tenant's Work, (iii) open to the public as soon as practicable, and (iv) operate the Permitted Use in the Premises during hours approved by Landlord on regular business days throughout the Lease Term."),
        ],
      },
    ],
  },

  // ───────────────────────────── 4 Rents & Payments ─────────────────────────────
  {
    id: "rent",
    number: "4",
    title: "Rent and Payments",
    initials: true,
    clauses: [
      {
        id: "base-rent",
        number: "4.1",
        title: "Base Rent",
        blocks: [
          p("Beginning on the Commencement Date, Tenant shall pay monthly Base Rent as shown in the Key Provisions Summary, plus Additional Rent, in advance, on or before the first (1st) day of each calendar month, without notice, demand, deduction or set-off. Base Rent increases by {{annual_increase_percent}}% on each anniversary of the Commencement Date, as shown in the rent schedule. Rent for any partial month is prorated by the number of days in that month."),
          p("The first month's Base Rent, {{first_month_rent}}, and the Security Deposit are due when Tenant signs this Lease. If the Commencement Date is not the first day of a month, the prorated rent for the first partial month is due on or before the Delivery Date."),
          p("Florida does not currently tax commercial rent. If any city, county, state or federal tax on the rent or on the privilege of renting the Premises is imposed during the Lease Term, Tenant shall pay it with each installment of Rent."),
          p("Base Rent includes all other costs and charges for the Building and the Premises except those this Lease makes Tenant's responsibility (including utilities under Section 5.1 and the CAM fee under Section 5.3)."),
        ],
        changes: [
          ch("C7", "Fla. Stat. 212.031 (repealed Oct 1, 2024)", "must", "Florida's sales tax on commercial rent ended October 1, 2024, so the lease no longer adds a sales tax to rent. It still covers any rent tax imposed later."),
          ch("C8", "n/a", "cleanup", "\"Rent Commencement Date\" and \"Advance Rent\" were used but never defined; rent now starts on the Commencement Date and the first month's rent is a filled-in amount. The yearly increase is stated as a percent and printed as a schedule.", "Beginning on the Rent Commencement Date"),
        ],
      },
      {
        id: "late",
        number: "4.2",
        title: "Payment, Late Charges and Returned Payments",
        blocks: [
          p("Tenant shall pay Rent at the Rent payment address, through the tenant portal, or as Landlord otherwise directs in writing. Rent not received by the {{late_after_day}} day of the month is late. For each month any Rent is late, Tenant shall pay a late charge of {{late_fee_percent}}% of the late amount (not counting earlier late charges). Tenant shall pay {{returned_payment_fee}} for each returned check or reversed electronic payment."),
          p("The parties agree these charges are a reasonable estimate of Landlord's costs from late or returned payments. They are in addition to Landlord's other rights and remedies. Accepting late Rent does not excuse later late payments or waive any of Landlord's rights, except as provided by Fla. Stat. 83.202."),
        ],
        changes: [
          ch("C9", "Fla. Stat. 83.06(2), 687", "must", "The late charge sentence was cut off (\"ten percent (10%) of the amount of the monthly.\") and charged late fees on earlier late fees. It now charges a set percent of the late amount only, with no compounding.", "ten percent ( 10% ) of the amount of the monthly. ... including all accrued late charges then outstanding"),
        ],
      },
      {
        id: "legal-restrictions",
        number: "4.3",
        title: "Rent Restrictions",
        blocks: [
          p("If any legal requirement prevents Landlord from collecting the full Rent during the Lease Term, Tenant shall take the legally permissible steps Landlord requests so Landlord can collect the most Rent the law allows (but not more than the Rent in this Lease). When the restriction ends, Tenant shall pay, if legally permissible, the Rent that would have been paid but for the restriction, less what Tenant paid during it."),
        ],
      },
      {
        id: "deposit",
        number: "4.4",
        title: "Security Deposit",
        blocks: [
          p("When Tenant signs this Lease, Tenant shall deposit the Security Deposit with Landlord as security for Tenant's performance of this Lease, including payment of Rent. Landlord may apply all or part of it to cure any default, and Tenant shall restore the amount applied within ten (10) days after Landlord's demand. The Security Deposit is not advance rent or a limit on Landlord's damages, and Tenant may not assign or encumber it."),
          p("The Security Deposit is held in a non-interest-bearing account at {{deposit_bank_name}}, {{deposit_bank_address}}, and does not earn interest for Tenant. Landlord shall return the Security Deposit, less any amounts properly applied and with a written list of them, within sixty (60) days after this Lease ends and Tenant surrenders the Premises. If Landlord sells the Property, Landlord may transfer the Security Deposit to the buyer and is then released from liability for it."),
        ],
        changes: [
          ch("C10", "n/a", "cleanup", "The lease said the deposit \"may be commingled with other funds\" and also that it is held in a non-interest account at a named bank. It now says where it is held (from the property's lease settings) and adds a written list of deductions when it is returned. Florida's residential deposit rules (83.49) do not apply to commercial space.", "may be commingled with other funds of Landlord"),
        ],
      },
    ],
  },

  // ───────────────────────────── 5 Utilities, Taxes, CAM ─────────────────────────────
  {
    id: "charges",
    number: "5",
    title: "Utilities, Taxes and CAM",
    initials: true,
    clauses: [
      {
        id: "utilities",
        number: "5.1",
        title: "Utilities",
        blocks: [
          p("Tenant shall pay when due all charges for electricity, water, sewer, trash removal and any other utility separately metered or billed to the Premises, and all charges for Tenant's signage, telephone, internet and other communication services."),
          p("If a utility or service is not separately metered to the Premises, or Landlord is billed for it, Tenant shall pay Landlord, as Additional Rent with each monthly Base Rent payment, Tenant's Pro Rata Share of its cost. Tenant's Pro Rata Share is the rentable square footage of the Premises divided by the total rentable square footage of all space served by that utility, or another commercially reasonable method Landlord chooses. The current monthly amount is {{utilities_estimate}}. Landlord may adjust the amount or method, no more than once every ninety (90) days, by written notice to Tenant, to reflect changes in occupancy, usage or cost."),
          p("Landlord may choose the provider of any utility to the Building. Landlord is not liable for any interruption of a utility or service that Landlord did not cause, and an interruption is not an eviction and does not reduce Rent. Tenant shall not overload the utility facilities serving the Premises. Tenant shall provide, at its own cost, janitorial service, pest control and waste removal for the Premises."),
        ],
      },
      {
        id: "taxes",
        number: "5.2",
        title: "Taxes",
        blocks: [
          p("Landlord shall pay the Taxes on the Property during the Lease Term. Tenant shall pay before they are delinquent all taxes, assessments, license fees and other charges on its business and on its trade fixtures, furniture, equipment, leasehold improvements, inventory and other personal property at the Premises."),
        ],
      },
      {
        id: "cam",
        number: "5.3",
        title: "Common Area Maintenance (CAM)",
        blocks: [
          p("Tenant shall pay a CAM fee toward the cost of maintaining, repairing, cleaning, landscaping, lighting and securing the Common Areas. The CAM fee is {{cam_summary}}. It is Additional Rent, due with each monthly Base Rent payment."),
        ],
        changes: [
          ch("C11", "n/a", "cleanup", "\"A rate of CAM Rate per square foot\" was a leftover label. The CAM fee is now a filled-in monthly amount, with whether it is fixed or adjustable, matching the summary.", "The CAM fee shall be calculated at a rate of CAM Rate per square foot"),
        ],
      },
    ],
  },

  // ───────────────────────────── 6 Premises ─────────────────────────────
  {
    id: "premises-use",
    number: "6",
    title: "Use, Maintenance and Alterations",
    initials: true,
    clauses: [
      {
        id: "use",
        number: "6.1",
        title: "Use of Premises",
        blocks: [
          p("Tenant shall use the Premises only for the Permitted Use and shall continuously operate its business there during hours approved by Landlord. Tenant shall, at its own cost, comply with all Governmental Regulations that apply to its use of the Premises and with the Rules and Regulations, and shall cause the Tenant Parties to do the same. Landlord is not liable to Tenant for other tenants' failure to follow the Rules and Regulations. Tenant shall not use the Premises or the Property for any illegal purpose, in violation of any Rule or Governmental Regulation, or in a way that, in Landlord's reasonable opinion, creates a nuisance or disturbs other tenants."),
        ],
      },
      {
        id: "landlord-maintenance",
        number: "6.2",
        title: "Maintenance by Landlord",
        blocks: [
          p("Tenant shall promptly notify Landlord of any defective or dangerous condition at the Premises or the Property. Landlord shall maintain and repair, subject to normal wear and tear, casualty and condemnation, the Common Areas, roof, foundation, exterior walls and structural parts of the Property, and all electrical, plumbing, heating, air-conditioning and ventilation systems in the Building that do not exclusively serve the Premises."),
          p("For the electrical, plumbing, heating, air-conditioning and ventilation systems that exclusively serve the Premises (the \"Premises Systems\"), Landlord is responsible for (a) replacing a Premises System in its entirety (for example, an HVAC unit, water heater or electrical panel) when Landlord reasonably determines replacement, rather than repair, is needed; and (b) the part of the cost of any repair to a Premises System that exceeds {{repair_threshold}} per occurrence (the \"Repair Threshold\"). Tenant pays each repair up to the Repair Threshold. Repairs arising from the same failure are one occurrence and may not be split into separate repairs or invoices."),
          p("Tenant shall notify Landlord before authorizing any repair to a Premises System expected to exceed the Repair Threshold, and Landlord may elect to perform it with its own contractor. Landlord need not pay any amount above the Repair Threshold for a repair Tenant undertakes without Landlord's prior approval, except in an emergency threatening imminent injury or property damage, in which case Tenant shall notify Landlord as soon as practicable."),
          p("Landlord's obligations under (a) and (b) do not apply, and Tenant bears the full cost, if the replacement or repair is needed in whole or in part because of (i) any act, omission, negligence or misuse by Tenant or a Tenant Party, (ii) Tenant's failure to perform the maintenance required by Section 6.3, or (iii) any alteration, improvement or equipment installed by or for Tenant."),
          p("Landlord is not liable for interruption or inconvenience to Tenant's business caused by repairs, maintenance or replacement, provided Landlord uses reasonable efforts to limit interference. Landlord has no obligation to repair, maintain, improve or replace the Premises except as stated in this Section 6.2 and Section 3.4. Because this Lease sets out the parties' repair duties and procedure, Fla. Stat. 83.201 does not apply."),
        ],
        changes: [
          ch("C12", "Fla. Stat. 83.201", "cleanup", "Repair Threshold ($750) is now a per-lease term. Added that the lease's repair procedure replaces the 83.201 rent-withholding procedure, which applies only when a lease is silent."),
        ],
      },
      {
        id: "tenant-maintenance",
        number: "6.3",
        title: "Maintenance by Tenant",
        blocks: [
          p("Except for Landlord's obligations in Section 6.2, Tenant shall, at its own cost, clean, keep in good repair, maintain and replace all parts of the Premises, including:"),
          list([
            "floors and floor coverings;",
            "interior walls and ceilings;",
            "doors, locks and plate glass within the Premises;",
            "lighting fixtures and bulbs;",
            "electrical outlets and switches;",
            "plumbing fixtures and drain lines within the Premises;",
            "the Premises Systems, subject to the Repair Threshold and Landlord's replacement obligation in Section 6.2; and",
            "all alterations, improvements, equipment, fixtures and personal property belonging to Tenant or placed in the Premises by or for Tenant.",
          ]),
          p("Tenant shall have the heating, air-conditioning and ventilation system serving the Premises routinely maintained, including regular filter changes and periodic service by a licensed contractor, and shall give Landlord the maintenance records on request. Tenant's repairs shall be prompt, in a good and workmanlike manner, at least equal in quality to the original work, compliant with Governmental Regulations, and performed by contractors Landlord approves."),
          p("Tenant uses the Premises and the Property at its own risk. Landlord is not liable to Tenant or the Tenant Parties for loss, injury or damage to persons or property caused by theft, a Force Majeure event, another tenant or a third party, or any other cause beyond Landlord's reasonable control, except to the extent caused by the negligence or willful misconduct of Landlord or a Landlord Party. Property placed at the Premises by or for Tenant is at Tenant's sole risk."),
        ],
        changes: [
          ch("C13", "n/a", "cleanup", "The exculpatory paragraph now carves out the landlord's own negligence or willful misconduct; Florida courts don't enforce a release of a party's own negligence unless it says so clearly, so the broad wording invited a dispute."),
        ],
      },
      {
        id: "energy",
        number: "6.4",
        title: "Energy Conservation",
        blocks: [p("Tenant shall comply with any mandatory energy conservation measures imposed by a governmental authority, and with reasonable building programs Landlord adopts in writing.")],
      },
      {
        id: "alterations",
        number: "6.5",
        title: "Alterations",
        blocks: [
          p("Tenant shall make no alterations, additions or improvements to the Premises, inside or outside (each an \"Alteration\"), without Landlord's prior written consent. Landlord may require plans and specifications and other reasonable conditions. For any Alteration needing Landlord's consent, Tenant shall pay Landlord a review and supervision fee of five percent (5%) of the estimated cost of the Alteration, unless Tenant engages a third-party construction manager to supervise it, in which case the fee covers plan review only and is two percent (2%)."),
          p("Tenant shall, at its own cost, (i) perform each Alteration in a good and workmanlike manner using contractors Landlord reasonably approves, (ii) obtain all required permits, and (iii) comply with all Governmental Regulations. Tenant shall not use any contractor or deliver any materials in a way that interferes with other work or with other tenants, and on Landlord's request shall remove any contractor causing interference."),
          p("Alterations (other than Tenant's movable furniture, equipment and trade fixtures) become Landlord's property when this Lease ends unless Landlord requires their removal under Section 8.1."),
        ],
        changes: [
          ch("C14", "n/a", "cleanup", "Removed stray page numbers (\"inside 7 or outside\", \"written 12 consent\") and combined the two overlapping fees (5% review plus a separate supervision fee) into one stated fee.", "inside 7 or outside, without Landlord's prior written 12 consent"),
        ],
      },
      {
        id: "liens",
        number: "6.6",
        title: "Liens",
        blocks: [
          p("Tenant shall not permit any construction lien or other lien arising from work done for Tenant to attach to the Property. If such a lien is filed, Tenant shall have it discharged of record by payment, bond or court order within thirty (30) days after filing. If Tenant does not, Landlord may discharge it, and Tenant shall reimburse Landlord's costs, including reasonable attorneys' fees, with interest at the Default Rate, within ten (10) days after written demand. Nothing in this Lease is Landlord's consent to any work that would subject Landlord's interest to a lien. Tenant shall indemnify, defend and hold Landlord harmless from all lien claims arising from work done by or for Tenant."),
          law(
            "PURSUANT TO FLORIDA STATUTES SECTION 713.10, THE INTEREST OF LANDLORD IN THE PREMISES, THE BUILDING AND THE LAND SHALL NOT BE SUBJECT TO LIENS FOR IMPROVEMENTS MADE BY TENANT. ANY LIENS UNDER CHAPTER 713, FLORIDA STATUTES, EXTEND ONLY TO THE RIGHT, TITLE AND INTEREST OF THE PERSON WHO CONTRACTS FOR THE IMPROVEMENT.",
            "Fla. Stat. 713.10",
          ),
          p("Before contracting for any improvement, Tenant shall notify the contractor of this provision and shall require the contractor to name Landlord in any Notice of Commencement as a person to receive notices. On Landlord's request, Tenant shall sign a notice of this provision that Landlord may record in the public records of the county where the Property is located."),
        ],
        changes: [
          ch("C15", "Fla. Stat. 713.10", "cleanup", "Kept the 713.10 notice that protects the landlord's interest from tenant contractors' liens. \"Default Rate (as defined under Insurance)\" referred to a definition that didn't exist; it is now defined in 2.2.", "with interest at the Default Rate ( as defined under Insurance )"),
        ],
      },
      {
        id: "assignment",
        number: "6.7",
        title: "Assignment and Subletting",
        blocks: [
          p("Tenant shall not assign, transfer or encumber this Lease, sublet any part of the Premises, or let anyone else occupy them, without Landlord's prior written consent, which will not be unreasonably withheld, conditioned or delayed. Tenant shall request consent in writing at least thirty (30) and no more than ninety (90) days before the proposed date, with the proposed assignee's or subtenant's name and address, the terms, a copy of the proposed document and its financial statements. With the request, Tenant shall pay Landlord a processing fee equal to one month's Base Rent."),
          p("An assignee or subtenant must agree in writing to be bound by this Lease, and Tenant remains liable under this Lease after any assignment or sublease. A transfer by merger, consolidation or liquidation, or a change in control of more than half of Tenant's ownership interests, is an assignment. After a default, Landlord may collect rent directly from any subtenant and apply it to amounts Tenant owes, without releasing Tenant. Consent to one transfer is not consent to any later one, and a transfer that does not comply with this Section is void. Landlord may assign its interest at any time and is released from obligations arising after the assignee assumes them in writing."),
        ],
        changes: [
          ch("C16", "n/a", "cleanup", "Removed stray numbers from another form (\"16.3\", \"16.4\") and the clause letting Landlord endorse Tenant's name on checks.", "16.3 Landlord's consent to any sale"),
        ],
      },
      {
        id: "indemnification",
        number: "6.8",
        title: "Indemnification",
        blocks: [
          p("Tenant shall indemnify, defend and hold harmless Landlord and the Landlord Parties from all claims, losses, damages, liabilities and expenses (including reasonable attorneys' fees and costs) arising from (a) any occurrence in or at the Premises or Tenant's use of them, (b) any act or omission of Tenant or a Tenant Party, or (c) any breach of this Lease by Tenant, except to the extent caused by the negligence or willful misconduct of Landlord or a Landlord Party. This indemnity survives the end of this Lease."),
        ],
        changes: [ch("C17", "n/a", "cleanup", "Fixed the mixed numbering \"( i ) ... ( b ) ... ( c )\" and added the same carve-out as 6.3 for the landlord's own negligence.")],
      },
      {
        id: "casualty",
        number: "6.9",
        title: "Fire or Other Casualty",
        blocks: [
          p("If the Building or the Premises are damaged by fire or other casualty and (i) Landlord reasonably estimates the damage cannot be substantially restored within two hundred seventy (270) days, (ii) Landlord reasonably determines restoration is not feasible, (iii) Landlord's insurance proceeds will not be enough to restore, or (iv) Landlord's mortgagee requires the insurance proceeds to be applied to its debt, Landlord may terminate this Lease by written notice within sixty (60) days after the casualty. Landlord may also elect not to restore if the damage occurs in the last eighteen (18) months of the Lease Term and Tenant has not renewed."),
          p("If this Lease is not terminated, Landlord shall restore the Building and the Premises (other than Tenant's property and Alterations) with reasonable diligence. If Landlord does not substantially complete restoration within three hundred thirty (330) days after the casualty (extended for Force Majeure), Tenant may terminate this Lease by written notice as its sole remedy. Rent abates in proportion to the part of the Premises that is untenantable, from the casualty until that part is restored, unless the casualty was caused by Tenant or a Tenant Party. Tenant shall keep operating to the extent practicable and shall remove its property as Landlord reasonably requests to allow restoration. Each party's insurance is for its own benefit."),
        ],
        changes: [
          ch("C18", "n/a", "cleanup", "The lease kept full rent due on space that couldn't be used (\"Rent does not abate\") while the landlord controls repair timing and keeps the insurance. Rent now abates for the untenantable part unless the tenant caused the casualty, which is the usual commercial term and avoids a dispute over the business-interruption gap.", "Rent does not abate during the period from the date of the damage"),
        ],
      },
      {
        id: "eminent-domain",
        number: "6.10",
        title: "Eminent Domain",
        blocks: [
          p("If all or a substantial part of the Property or the Premises is taken by eminent domain or sold under threat of it (a \"Taking\") and the Taking prevents or materially interferes with the Permitted Use, this Lease ends when the physical Taking occurs. Otherwise this Lease continues, Rent is reduced as is fair and reasonable, and Landlord shall restore the Property or Premises as nearly as feasible to their prior condition. Landlord receives the entire award, except that Tenant may separately claim from the condemning authority its relocation costs and business damages if that does not reduce Landlord's award. A temporary Taking does not end this Lease or reduce Rent, but Tenant receives the part of any award for its use of the Premises during the Lease Term."),
        ],
      },
    ],
  },

  // ───────────────────────────── 7 Insurance ─────────────────────────────
  {
    id: "insurance",
    number: "7",
    title: "Insurance",
    initials: true,
    clauses: [
      {
        id: "landlord-insurance",
        number: "7.1",
        title: "Landlord's Insurance",
        blocks: [p("During the Lease Term, Landlord shall carry commercial property insurance on the Building in amounts Landlord determines. Losses under Landlord's policies are payable only to Landlord or its mortgagee.")],
      },
      {
        id: "tenant-insurance",
        number: "7.2",
        title: "Tenant's Insurance",
        blocks: [
          p("During the Lease Term, Tenant shall carry, at its own cost:"),
          list(
            [
              "Commercial general liability insurance of at least $1,000,000 per occurrence and $1,000,000 general aggregate, covering the Premises and Tenant's operations, independent contractors, products and completed operations, personal and advertising injury, and contractual liability for Tenant's obligations under this Lease;",
              "Commercial auto liability insurance of at least $1,000,000 combined single limit for owned, non-owned and hired vehicles, if Tenant or its employees use vehicles for Tenant's business;",
              "Workers' compensation insurance as Florida law requires, and employer's liability insurance of at least $1,000,000 per accident and $1,000,000 per employee and aggregate for disease, if Tenant has employees; and",
              "Property insurance on Tenant's personal property, trade fixtures and Alterations for their full replacement cost.",
            ],
            true,
          ),
          p("Tenant's liability policies shall name Landlord and {{agent_name}} as additional insureds on a primary and non-contributory basis. Policies shall be issued by insurers rated A- or better by A.M. Best (or A or better by Standard & Poor's) and may be met with primary and umbrella policies. Tenant shall give Landlord certificates of insurance before taking possession and at each renewal, and shall notify Landlord within five (5) Business Days after receiving notice of cancellation, reduction or non-renewal. These are minimums and do not limit Tenant's liability."),
          p("If Tenant fails to carry the required insurance, Landlord may obtain it and Tenant shall reimburse the cost as Additional Rent within ten (10) days after demand."),
        ],
        changes: [
          ch("C19", "Fla. Stat. 440.02, 440.10", "cleanup", "Auto and workers' compensation coverage now apply only when the tenant actually uses vehicles or has employees (many small tenants have neither, and Florida doesn't require workers' compensation for every business). Added property insurance on the tenant's own property, which the lease relied on but never required. The cross-liability and anti-stacking endorsement wording was dropped as more than a small tenant's insurer will write."),
        ],
      },
      {
        id: "waiver-subrogation",
        number: "7.3",
        title: "Waiver of Subrogation",
        blocks: [
          p("Landlord and Tenant each waive all claims against the other for loss or damage to their property to the extent it is covered (or required by this Lease to be covered) by property insurance, and each shall have its property insurer waive subrogation against the other."),
        ],
        changes: [ch("C20", "n/a", "cleanup", "The old lease required only the landlord to get a waiver of subrogation; it is now mutual, so neither side's insurer can sue the other for a covered loss.")],
      },
    ],
  },

  // ───────────────────────────── 8 Lease Disposition ─────────────────────────────
  {
    id: "disposition",
    number: "8",
    title: "Surrender, Holding Over and Default",
    initials: true,
    clauses: [
      {
        id: "surrender",
        number: "8.1",
        title: "Surrender",
        blocks: [
          p("When this Lease ends, Tenant shall surrender the Premises broom-clean and in as good condition as at the Commencement Date, except ordinary wear and tear and casualty Tenant is not required to restore, and shall return all keys and access devices. Tenant shall remove its trade fixtures, equipment and personal property, and any Alterations or signs Landlord directs it to remove, and shall repair any damage caused by removal."),
        ],
      },
      {
        id: "holdover",
        number: "8.2",
        title: "Holding Over",
        blocks: [
          p("If Tenant stays in possession after this Lease ends without Landlord's written consent, Tenant is a tenant at sufferance (Fla. Stat. 83.04), and Landlord may demand double the monthly Base Rent for each month or part of a month Tenant holds over (Fla. Stat. 83.06(1)), plus all other charges under this Lease. Accepting Rent does not renew this Lease. If Landlord consents in writing, the holdover is a month-to-month tenancy that either party may end by at least thirty (30) days' written notice before the end of a monthly period. Tenant shall indemnify Landlord from all losses caused by a holdover, including claims of a successor tenant."),
        ],
        changes: [
          ch("C21", "Fla. Stat. 83.04, 83.06(1), 83.03(3)", "must", "The lease said any holdover \"constitutes the creation of a month-to-month tenancy\". Under 83.04 a holdover without written consent is a tenancy at sufferance, and 83.06(1) gives double rent; month-to-month applies only with written consent, ended by notice of at least the 15 days 83.03(3) requires (30 days used here).", "constitutes the creation of a month-to-month tenancy which may be terminated by either Landlord or Tenant upon thirty ( 30 ) days' prior written notice"),
        ],
      },
      {
        id: "default",
        number: "8.3",
        title: "Default and Remedies",
        blocks: [
          p("Each of the following is an \"Event of Default\":"),
          list(
            [
              "Tenant fails to pay any Rent when due and does not pay it within three (3) days after Landlord's written notice demanding payment of the Rent or possession of the Premises (Fla. Stat. 83.20(2));",
              "Tenant abandons the Premises. Without actual knowledge, Tenant is presumed to have abandoned the Premises if Landlord reasonably believes Tenant has been absent for thirty (30) consecutive days, the Rent is not current, and ten (10) days have passed since service of a notice under Fla. Stat. 83.20(2), unless Tenant has told Landlord in writing of an intended absence (Fla. Stat. 83.05(3));",
              "Tenant makes a general assignment for the benefit of creditors, or Tenant's interest in this Lease is taken by legal process;",
              "Tenant files, or has filed against it and not dismissed within sixty (60) days, a bankruptcy or insolvency petition, or a receiver or trustee is appointed for substantially all of Tenant's assets;",
              "Tenant fails to keep the insurance this Lease requires, or fails to sign an estoppel certificate or subordination agreement within ten (10) Business Days after Landlord's written request; or",
              "Tenant fails to perform any other obligation under this Lease within thirty (30) days after Landlord's written notice, or, if it cannot reasonably be cured in thirty (30) days, Tenant fails to start the cure within that time and diligently complete it.",
            ],
            true,
          ),
          p("After an Event of Default, Landlord may, in addition to its other rights under this Lease and Florida law, and without electing one remedy over another:"),
          list(
            [
              "Terminate this Lease by written notice, or terminate Tenant's right of possession without terminating this Lease;",
              "Recover possession of the Premises through an action for possession under Fla. Stat. 83.20 and 83.21, or when Tenant has surrendered or abandoned them (Fla. Stat. 83.05(2)). Landlord shall not use force, change the locks, cut off utilities or remove Tenant's property to recover possession except as permitted by court order or after surrender or abandonment;",
              "Sue for Rent and other sums due and for damages, including the Rent for the rest of the Lease Term, either as it comes due or accelerated to the present, less the net rent Landlord actually receives from reletting (after reasonable costs of repossession, reletting, brokerage and repairs). Landlord shall use reasonable efforts to relet the Premises;",
              "Enforce its statutory landlord's lien (Fla. Stat. 83.08) and distress for rent (Fla. Stat. 83.11) and its security interest under Section 9.9; and",
              "Cure the default for Tenant's account. In an emergency threatening injury or property damage, Landlord may cure immediately. Tenant shall reimburse Landlord's reasonable costs, with interest at the Default Rate, within ten (10) Business Days after invoice.",
            ],
            true,
          ),
          p("Rights and remedies are cumulative. Landlord's acceptance of Rent with knowledge of a breach is not a waiver of the breach, except that Landlord's acceptance of the full past-due Rent waives an eviction for nonpayment of that Rent (Fla. Stat. 83.202). Each party may seek injunctive relief or specific performance."),
        ],
        changes: [
          ch("C22", "Fla. Stat. 83.05(2)", "must", "Removed the landlord's right to \"expel or remove Tenant ... by force, if necessary, without being liable for prosecution\". Florida allows a landlord to recover commercial premises only by court action, surrender or abandonment; self-help eviction exposes the landlord to wrongful-eviction damages.", "expel or remove Tenant and any other person who may be occupying said Premises or any part thereof, by force, if necessary, without being liable for prosecution"),
          ch("C23", "Fla. Stat. 83.20(2)", "must", "Nonpayment is a default only after the 3-day written notice demanding rent or possession that 83.20(2) requires before an eviction for unpaid rent. The lease made any late payment an immediate default."),
          ch("C24", "Fla. Stat. 83.05(3)", "must", "\"Vacation or abandonment\" now uses Florida's abandonment presumption (30 days absent, rent not current, 10 days after a 3-day notice). Moving out early while paying rent is not a default."),
          ch("C25", "Fla. Stat. 83.202", "must", "Added that accepting the full past-due rent waives an eviction for that rent, as 83.202 provides; the old wording said accepting rent never waives anything."),
          ch("C26", "n/a", "cleanup", "Accelerated rent is now reduced by what the landlord actually receives from reletting, and the landlord must try to relet. Without that, a court is likely to treat acceleration as a penalty."),
        ],
      },
      {
        id: "subordination",
        number: "8.4",
        title: "Subordination, Attornment and Transfer by Landlord",
        blocks: [
          p("This Lease is subordinate to every present and future mortgage and ground lease on the Property and all renewals and advances under them, provided the holder agrees not to disturb Tenant's possession while no Event of Default exists. Tenant shall sign any document reasonably requested to confirm this within ten (10) Business Days after request. If the Property is sold or transferred, including by foreclosure, Tenant shall attorn to the new owner as landlord, and Landlord is released from obligations arising after the transfer."),
        ],
        changes: [
          ch("C27", "n/a", "cleanup", "Removed the power of attorney letting the landlord sign subordination documents for the tenant and the rule that silence means approval, and added the usual non-disturbance condition. The scrambled sentence order (\"Landlord as Tenant's attorney-in-fact ... If such Event of Default occurs, Tenant hereby appoints\") is fixed.", "Landlord as Tenant's attorney-in-fact to execute such documentation."),
        ],
      },
      {
        id: "force-majeure",
        number: "8.5",
        title: "Force Majeure",
        blocks: [
          p("A party's time to perform (other than paying money) is extended for delays caused by acts of God, hurricanes and severe weather, fire or casualty, strikes, labor or material shortages, governmental action, war, terrorism, utility failures or other causes beyond that party's reasonable control (\"Force Majeure\")."),
        ],
        changes: [ch("C28", "n/a", "cleanup", "Force Majeure now applies to both parties and never excuses paying rent; it applied only to the landlord and included \"repairs\" and \"mechanical breakdowns\", which would have excused the landlord's own repair duties.")],
      },
      {
        id: "reserved",
        number: "8.6",
        title: "Rights Reserved to Landlord",
        blocks: [
          p("Landlord may, without liability and without it being an eviction or reducing Rent, provided it does not unreasonably interfere with Tenant's use of the Premises: (1) change the name or street address of the Building; (2) install and maintain signs on the exterior and interior of the Building; (3) keep pass keys to the Premises; (4) grant others exclusive rights to conduct a business in the Building, if that does not exclude the Permitted Use; and (5) close the Building outside Normal Business Hours and on Normal Business Holidays, subject to Tenant's access to the Premises."),
        ],
      },
      {
        id: "keys",
        number: "8.7",
        title: "Acceptance of Keys",
        blocks: [p("Landlord's acceptance of keys to the Premises does not end this Lease unless Landlord agrees in writing.")],
      },
    ],
  },

  // ───────────────────────────── 9 Property ─────────────────────────────
  {
    id: "property",
    number: "9",
    title: "Property Matters",
    initials: true,
    clauses: [
      {
        id: "hazardous",
        number: "9.1",
        title: "Hazardous Substances",
        blocks: [
          p("Tenant and the Tenant Parties shall not bring to, use, store, release or dispose of at the Property any substance regulated by environmental, health or safety laws (\"Hazardous Substances\"), except ordinary cleaning and office supplies and products normally used in the Permitted Use, in small quantities and in compliance with those laws. Tenant shall notify Landlord within five (5) Business Days after learning of any release by Tenant or a Tenant Party, and shall promptly clean it up at its own cost as the law requires. When this Lease ends, Tenant shall remove all Hazardous Substances Tenant or a Tenant Party brought to the Property. Tenant shall indemnify Landlord and the Landlord Parties from all losses, cleanup costs, fines and expenses arising from Hazardous Substances brought to or released at the Property by Tenant or a Tenant Party. This Section survives the end of this Lease."),
        ],
        changes: [ch("C29", "n/a", "cleanup", "Allowed the ordinary products a business uses (for a salon, hair color and cleaning products), which the old wording technically banned.")],
      },
      {
        id: "radon",
        number: "9.2",
        title: "Radon Gas",
        blocks: [
          law(
            "RADON GAS: Radon is a naturally occurring radioactive gas that, when it has accumulated in a building in sufficient quantities, may present health risks to persons who are exposed to it over time. Levels of radon that exceed federal and state guidelines have been found in buildings in Florida. Additional information regarding radon and radon testing may be obtained from your county health department.",
            "Fla. Stat. 404.056(5)",
          ),
        ],
        changes: [ch("C30", "Fla. Stat. 404.056(5)", "disclosure", "The radon notice must appear in the lease word for word; added the required \"RADON GAS:\" heading.")],
      },
      {
        id: "limitation",
        number: "9.3",
        title: "Limitation of Landlord's Liability",
        blocks: [p("Any judgment against Landlord under this Lease may be satisfied only from Landlord's interest in the Property, including its rents and insurance proceeds. No Landlord Party has personal liability under this Lease.")],
      },
      {
        id: "parking",
        number: "9.4",
        title: "Parking",
        blocks: [p("Tenant and the Tenant Parties may use the non-reserved parking areas in the Common Areas in common with others, as Landlord designates from time to time.")],
      },
      {
        id: "entry",
        number: "9.5",
        title: "Entry",
        blocks: [
          p("Landlord, the Landlord Parties and Landlord's lenders may enter the Premises at reasonable times, with reasonable advance notice when practical (and at any time in an emergency), to inspect, make repairs or improvements, show the Premises to buyers, lenders or, during the last six (6) months of the Lease Term, prospective tenants, or for any other reasonable purpose. Landlord shall use reasonable efforts to limit interference with Tenant's business. Entry under this Section is not an eviction and does not reduce Rent."),
        ],
        changes: [ch("C31", "n/a", "cleanup", "Entry now comes with reasonable advance notice when practical, and showings to new tenants are limited to the last six months of the term. Florida's 24-hour entry rule (83.53) applies only to residential leases.")],
      },
      {
        id: "signage",
        number: "9.6",
        title: "Signage",
        blocks: [
          p("Subject to Landlord's prior written approval and governmental approvals, Tenant may, at its own cost, install one identification sign on the Building in the designated space above its entrance and one panel on the monument sign, if any. Signs must comply with Governmental Regulations and Landlord's sign criteria, and Tenant shall maintain them in good condition and remove them when this Lease ends."),
        ],
      },
      {
        id: "estoppel",
        number: "9.7",
        title: "Estoppel Certificate",
        blocks: [
          p("Within ten (10) Business Days after Landlord's written request, Tenant shall sign and deliver to Landlord, or to a buyer or lender Landlord names, a statement certifying (i) that this Lease is unmodified and in full force (or describing any changes), (ii) the Rent and the date to which it is paid, (iii) whether Tenant knows of any default by either party, (iv) that Tenant is in possession, and (v) other facts reasonably requested."),
        ],
      },
      {
        id: "lien",
        number: "9.8",
        title: "Landlord's Lien and Security Interest",
        blocks: [
          p("Landlord has the statutory lien for rent on Tenant's property usually kept at the Premises (Fla. Stat. 83.08). In addition, to secure Tenant's obligations under this Lease, Tenant grants Landlord a security interest in Tenant's goods, equipment, fixtures, furniture, inventory and other personal property at the Premises, and their proceeds, subordinate to any purchase-money or bank financing Tenant obtains for them. Tenant shall not remove that property from the Premises, other than in the ordinary course of business, while Rent is past due. Landlord may file a financing statement, and after an Event of Default has the rights of a secured party under Florida's Uniform Commercial Code (ch. 679)."),
        ],
        changes: [ch("C32", "Fla. Stat. 83.08, ch. 679", "cleanup", "Referenced Florida's statutory lien and UCC chapter instead of \"the state, commonwealth, or jurisdiction\" form wording, allowed normal sales of inventory, and subordinated the lien to equipment financing so the tenant can still finance equipment.")],
      },
      {
        id: "brokers",
        number: "9.9",
        title: "Brokers",
        blocks: [
          p("{{agent_name}} is Landlord's licensed real estate broker and property manager for this Lease, and Landlord pays its compensation under a separate agreement. Each party represents that it has dealt with no other broker in connection with this Lease and shall indemnify the other from claims for commissions by any other broker it dealt with."),
        ],
        changes: [ch("C33", "Fla. Stat. 475", "cleanup", "The old clause said each party had a broker \"entitled to a commission\" without naming one. It now discloses SIM REI as the landlord's broker and manager.")],
      },
    ],
  },

  // ───────────────────────────── 10 Notices ─────────────────────────────
  {
    id: "notices",
    number: "10",
    title: "Notices",
    initials: true,
    clauses: [
      {
        id: "notice-delivery",
        number: "10.1",
        title: "Delivery",
        blocks: [
          p("Every notice, demand, consent or approval under this Lease (\"Notice\") must be in writing and delivered to the other party's notice address in the Key Provisions Summary (or a new address given by Notice) by (1) hand delivery, (2) certified mail, return receipt requested, (3) nationally recognized overnight courier, or (4) e-mail to the address in the Key Provisions Summary. A Notice is received when delivered or when delivery is refused; an e-mail is received when sent, if sent before 5:00 p.m. on a Business Day, otherwise at 9:00 a.m. on the next Business Day. A notice under Fla. Stat. 83.20 may also be served as that section allows, including by leaving a copy at the Premises if Tenant is absent."),
        ],
        changes: [
          ch("C34", "Fla. Stat. 83.20(2)", "cleanup", "Simplified four clauses into one, dropped fax, and removed the rule that an e-mail notice is void unless a paper copy is also sent. Added that statutory 3-day notices may be served as 83.20 allows."),
        ],
      },
    ],
  },

  // ───────────────────────────── 11 General Provisions ─────────────────────────────
  {
    id: "general",
    number: "11",
    title: "General Provisions",
    initials: true,
    clauses: [
      {
        id: "accord",
        number: "11.1",
        title: "No Accord and Satisfaction",
        blocks: [p("Payment of less than the amount due is credited on account only. No endorsement or statement on a payment is an accord and satisfaction.")],
      },
      {
        id: "relationship",
        number: "11.2",
        title: "Relationship of the Parties",
        blocks: [p("Nothing in this Lease creates a partnership or joint venture between Landlord and Tenant. If Tenant is more than one person or entity, each is jointly and severally liable under this Lease.")],
      },
      {
        id: "construction",
        number: "11.3",
        title: "Interpretation",
        blocks: [p("Each party has had the opportunity to review this Lease with counsel, and it will not be construed against either party as drafter. Headings are for convenience only. If any provision is unenforceable, the rest of this Lease remains in effect.")],
      },
      {
        id: "confidentiality",
        number: "11.4",
        title: "Confidentiality",
        blocks: [p("Tenant shall keep the economic terms of this Lease confidential, except for disclosure to its owners, employees, lenders, advisers and prospective assignees who need to know them, or as required by law.")],
      },
      {
        id: "third-parties",
        number: "11.5",
        title: "No Third-Party Beneficiaries",
        blocks: [p("This Lease gives no rights to anyone other than the parties and their permitted successors and assigns.")],
      },
      {
        id: "survival",
        number: "11.6",
        title: "Survival",
        blocks: [p("Obligations that by their nature continue after this Lease ends, including payment, indemnity and surrender obligations, survive.")],
      },
      {
        id: "damages",
        number: "11.7",
        title: "No Consequential Damages",
        blocks: [p("Neither party is liable to the other for special, indirect, punitive or consequential damages, except for Tenant's liability for holding over and under Section 9.1.")],
      },
      {
        id: "law",
        number: "11.8",
        title: "Governing Law and Venue",
        blocks: [p("Florida law governs this Lease. Any action arising from this Lease shall be brought in the county where the Property is located.")],
        changes: [ch("C35", "n/a", "cleanup", "Names Florida law and the county court where the property is, replacing the \"state, commonwealth, or jurisdiction\" form wording.")],
      },
      {
        id: "fees",
        number: "11.9",
        title: "Attorneys' Fees",
        blocks: [
          p("In any action arising from this Lease, the prevailing party may recover its reasonable attorneys' fees and costs, including on appeal and in establishing the right to fees. Tenant shall also reimburse Landlord's reasonable attorneys' fees for reviewing any document Tenant requests Landlord sign, such as a lender's landlord waiver."),
        ],
      },
      {
        id: "waivers",
        number: "11.10",
        title: "Waiver of Redemption and Exemptions",
        blocks: [
          p("TO THE EXTENT ALLOWED BY LAW, TENANT WAIVES ANY RIGHT TO REDEEM THE PREMISES AFTER TENANT'S RIGHT OF POSSESSION ENDS BY COURT ORDER, AND ANY EXEMPTION OF PROPERTY FROM DISTRESS FOR RENT BEYOND THOSE IN FLA. STAT. 83.09."),
        ],
        changes: [
          ch("C36", "Fla. Stat. 83.20(2), 83.12, 83.135", "must", "Removed the tenant's waiver of notice to quit before an eviction is filed and of any hearing before a prejudgment remedy. Florida requires the 3-day written notice before an eviction for unpaid rent, and distress for rent is a court process with the tenant's right to a hearing; a lease waiver of them invites dismissal of the landlord's case.", "WHICH ENTITLES TENANT TO RECEIVE ANY PRIOR NOTICE TO QUIT AS A CONDITION PRECEDENT TO LANDLORD'S FILING"),
        ],
      },
      {
        id: "jury",
        number: "11.11",
        title: "Waiver of Jury Trial",
        blocks: [
          p("EACH PARTY KNOWINGLY, VOLUNTARILY AND INTENTIONALLY WAIVES ITS RIGHT TO A TRIAL BY JURY IN ANY ACTION ARISING OUT OF OR RELATING TO THIS LEASE, WHETHER IN CONTRACT, TORT OR OTHERWISE."),
        ],
        changes: [ch("C37", "n/a", "cleanup", "Removed \"each party acknowledges that it has received the advice of competent counsel\", which is often untrue for a small tenant and can be used to attack the waiver.")],
      },
    ],
  },

  // ───────────────────────────── 12 Exhibits ─────────────────────────────
  {
    id: "exhibits",
    number: "12",
    title: "Exhibits",
    initials: true,
    clauses: [
      { id: "exhibit-a", number: "A", title: "Legal Description of the Land", blocks: [p("{{legal_description}}")] },
      { id: "exhibit-b1", number: "B-1", title: "Landlord's Work", blocks: [p("{{landlord_work}}")] },
      { id: "exhibit-b2", number: "B-2", title: "Tenant's Work", blocks: [p("{{tenant_work}}")] },
      {
        id: "exhibit-c",
        number: "C",
        title: "Rules and Regulations",
        blocks: [
          list(
            [
              "**Smoking.** Smoking and vaping are prohibited everywhere in the Building and on the Land.",
              "**Access areas.** Sidewalks, hallways and other access areas are for coming and going only and may not be blocked. No roof access without Landlord's permission.",
              "**Signs.** No signs visible from outside the Premises or the Building without Landlord's written consent; Landlord may remove unapproved signs at Tenant's cost.",
              "**Windows and doors.** No window coverings, decorations or items against the glass visible from outside without Landlord's written consent.",
              "**Exclusion.** Landlord may exclude from the Common Areas anyone who is intoxicated or disruptive.",
              "**Security.** Keep doors locked and faucets and equipment off when the Premises are closed.",
              "**Energy.** Don't waste electricity, water or air conditioning.",
              "**Locks.** No new or changed locks without Landlord's consent. Return all keys and access devices when the Lease ends; Tenant pays for lost ones.",
              "**Restrooms.** Use plumbing only for its intended purpose; no grease, coffee grounds or chemicals down drains or toilets.",
              "**Heating.** No space heaters using kerosene, gasoline or open flame.",
              "**Animals.** No animals except service animals and, where the law allows, other animals Landlord approves in writing.",
              "**Cooking.** No cooking except with microwaves, coffee makers and similar small appliances, or as the Permitted Use requires and Landlord approves. No residential use of the Premises.",
              "**Wiring.** Get Landlord's written consent before installing telecommunications wiring or equipment, and follow Landlord's instructions.",
              "**Nuisance.** No noise, odors or vibrations that disturb other tenants. No antennas or loudspeakers on the exterior or roof.",
              "**Floors.** Don't exceed floor load limits or glue down floor coverings without Landlord's approval.",
              "**Moving.** Move furniture and heavy equipment only at times Landlord approves; Tenant pays for any damage.",
              "**Trash.** Keep trash inside the Premises until disposal in the designated containers. No hazardous materials in the trash.",
              "**Solicitation.** No canvassing, soliciting or distributing materials on the Property.",
              "**Building name.** Don't use the Building's name or picture in advertising except as part of Tenant's address.",
              "**Safety.** Follow all fire, safety and evacuation procedures of Landlord and government authorities.",
              "**Weapons.** No weapons in the Building, except as allowed by Florida law, including a firearm lawfully kept locked inside a private vehicle in the parking area (Fla. Stat. 790.251).",
              "**Contractors.** All contractors and vendors working in the Premises must be approved by Landlord and follow these rules.",
              "**Repairs.** Report plumbing, electrical, heating and air-conditioning problems to Landlord promptly.",
              "**Adhesives.** Use only strippable adhesives for wallpaper or vinyl; Tenant pays to remove anything else.",
              "**Changes.** Landlord may waive a rule for one tenant without waiving it for others, and may adopt other reasonable rules by written notice. If a rule conflicts with the Lease, the Lease controls.",
            ],
            true,
          ),
        ],
        changes: [
          ch("C38", "Fla. Stat. 790.251", "must", "The weapons rule banned weapons \"on the Property\", which includes the parking lot. Florida protects keeping a lawfully owned firearm locked in a private vehicle in a parking lot, so the rule now excepts that.", "Weapons ( concealed or otherwise ) are strictly prohibited in the Building or on the Property"),
          ch("C39", "n/a", "cleanup", "Exhibit renamed C (the lease called it both C and D), stray numbers removed (\"20\"), and the rules shortened to plain sentences. Cooking is allowed when the Permitted Use needs it.", "12.4 D | RULES & REGULATIONS"),
        ],
      },
    ],
  },

  // ───────────────────────────── 13 Signatures ─────────────────────────────
  {
    id: "signatures",
    number: "13",
    title: "Signatures",
    clauses: [
      {
        id: "sign",
        number: "13.1",
        title: "Signatures",
        blocks: [
          p("Landlord and Tenant have signed this Lease on the dates below. No witnesses are required (Fla. Stat. 689.01(1))."),
          { kind: "signatures", parties: ["tenants"], label: "Tenant: {{tenant_legal_name}}" },
          { kind: "signatures", parties: ["agent"], label: "Landlord: {{landlord_name}}, by {{agent_name}}, its authorized agent" },
        ],
        changes: [ch("C40", "Fla. Stat. 689.01(1)", "cleanup", "Landlord signs through SIM REI as its agent; witnesses are not required for a lease.")],
      },
      {
        id: "guaranty",
        number: "13.2",
        title: "Personal Guaranty",
        when: ["has_guarantor"],
        blocks: [
          p("To induce Landlord to enter into this Lease, each Guarantor below personally, jointly and severally, and unconditionally guarantees to Landlord the full and prompt payment of all Rent and the performance of all of Tenant's obligations under this Lease, including during any renewal or holdover. Landlord need not first proceed against Tenant or the Security Deposit. This guaranty is not affected by any amendment, extension, assignment or forbearance, or by Tenant's bankruptcy."),
          { kind: "signatures", parties: ["guarantors"], label: "Guarantor(s)" },
        ],
        changes: [ch("C41", "n/a", "cleanup", "Added a personal guaranty, printed only when the lease has a guarantor (common for a new small business).")],
      },
    ],
  },
];

const fields: Record<string, TemplateField> = {
  lease_prepared_date: f("Date the lease was prepared", "computed", "October 15, 2026"),
  landlord_name: f("Landlord: owner's legal name (owning LLC)", "property", "Sample Holdings LLC"),
  agent_name: f("Agent (management company) legal name", "company", "SIM REI Property Management LLC"),
  agent_address: f("Agent address for notices and rent", "company", "432 N Eustis St, Eustis, FL 32726"),
  agent_phone: f("Agent phone", "company", "(352) 555-0100"),
  agent_email: f("Agent e-mail for notices", "company", "info@example.com"),
  tenant_legal_name: f("Tenant legal name (person, and business or dba)", "lease", "Jordan Sample, dba Sample Studio LLC"),
  tenant_notice_address: f("Tenant notice address", "lease", "127 Sample St, Suite B, Eustis, FL 32726"),
  tenant_phone: f("Tenant phone", "lease", "(352) 555-0123"),
  tenant_email: f("Tenant e-mail for notices", "lease", "tenant@example.com"),
  premises_address: f("Premises address and suite", "unit", "127 Sample St, Suite B, Eustis, FL 32726"),
  premises_sqft: f("Premises square feet (approximate)", "unit", "1,000"),
  lease_start_date: f("Commencement Date", "lease", "November 1, 2026"),
  lease_end_date: f("Expiration Date", "lease", "October 31, 2029"),
  lease_term_months: f("Initial term (months)", "lease", "36"),
  renewal_summary: f("Renewal option summary", "lease", "One renewal term of 36 months; written notice at least 90 days before the Expiration Date"),
  renewal_clause: f("Renewal option clause", "lease", "Tenant has the option to renew this Lease for one (1) renewal term of 36 months by giving Landlord written notice at least 90 days before the Expiration Date."),
  rent_schedule: f("Rent schedule", "computed", "Nov 1, 2026 – Oct 31, 2027: $1,000.00; Nov 1, 2027 – Oct 31, 2028: $1,050.00; Nov 1, 2028 – Oct 31, 2029: $1,102.50"),
  first_month_rent: f("First month's Base Rent", "lease", "$1,000.00"),
  annual_increase_percent: f("Yearly Base Rent increase (%)", "lease", "5"),
  utilities_summary: f("Utilities summary", "lease", "Tenant pays its pro rata share monthly with rent (Section 5.1); currently $110.00 a month"),
  utilities_estimate: f("Current monthly pro rata utility charge", "lease", "$110.00"),
  cam_summary: f("CAM fee", "lease", "$0.00 a month, fixed through October 31, 2029"),
  permitted_use: f("Permitted Use", "lease", "Hair and nail salon"),
  security_deposit: f("Security Deposit", "lease", "$800.00"),
  deposit_bank_name: f("Bank holding the deposit", "property", "Sample Bank"),
  deposit_bank_address: f("Bank street address", "property", "100 Sample Ave, Eustis, FL 32726"),
  late_after_day: f("Rent is late after this day of the month", "lease", "6th"),
  late_fee_percent: f("Late charge (% of the late amount)", "lease", "10"),
  returned_payment_fee: f("Returned payment fee", "lease", "$50.00"),
  repair_threshold: f("Repair Threshold per occurrence", "lease", "$750.00"),
  warranty_days: f("HVAC/plumbing/electrical warranty period (days)", "lease", "90"),
  legal_description: f("Legal description of the land (Exhibit A)", "property", "Sample Subdivision PB 1 PG 1, Lot 1, Block 1"),
  landlord_work: f("Landlord's Work (Exhibit B-1)", "lease", "None."),
  tenant_work: f("Tenant's Work (Exhibit B-2)", "lease", "None."),
};

export const COMMERCIAL_LEASE: DocumentTemplate = {
  id: "commercial-lease",
  title: "Commercial Lease",
  version: "2026-11-01",
  appliesTo: "Nonresidential (Fla. Stat. ch. 83 Part I)",
  sections,
  fields,
};
