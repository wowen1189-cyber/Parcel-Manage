// SIM REI residential lease (AppFolio template, 12 sections) rebuilt as a structured template,
// with the Florida law fixes from docs/reference/lease-review-2026-11.md applied.
// Statute source: docs/reference/florida-chapter-83-landlord-tenant-2025.html (2025 Fla. Stat. ch. 83, Part II).
// Statutory forms below are quoted word for word from that file. Every suggested wording is
// "suggested, attorney to approve": the company's attorney must approve this template before use.

import type { Block, Change, DocumentTemplate, TemplateField } from "./types";

const p = (text: string): Block => ({ kind: "p", text });
const list = (items: string[], ordered = false): Block => ({ kind: "list", items, ordered });
const law = (text: string, cite: string): Block => ({ kind: "statutory", text, cite });
const ch = (finding: string, cite: string, severity: Change["severity"], summary: string, before?: string): Change =>
  before === undefined ? { finding, cite, severity, summary } : { finding, cite, severity, summary, before };
const f = (label: string, source: TemplateField["source"], example: string, fixedByLaw?: string): TemplateField =>
  fixedByLaw === undefined ? { label, source, example } : { label, source, example, fixedByLaw };

/** Questions the owner (and attorney) must answer before this template is used. */
export const OPEN_QUESTIONS: string[] = [
  "Landlord name: confirm each lease names the owning LLC as Landlord ({{landlord_name}}) with SIM REI Property Management LLC as its agent for notices (83.50). Which LLC owns each property?",
  "Deposit accounts (83.49(1)-(2)): for each owner LLC, which Florida bank holds deposits (name and street address)? Interest-bearing, non-interest-bearing, or surety bond? Does each owner rent five or more units (the 83.49(2) notice threshold)?",
  "Electronic notices (83.505): do you want to send 3-day notices, deposit claims and other ch. 83 notices by e-mail? If so, which e-mail address does SIM REI designate, and who signs the landlord election?",
  "End-of-term notice (83.575): keep 60 days (allowed range 30-60)? Keep the one-month liquidated-damages charge? If so, the office must send the 83.575(2) pre-notice within 15 days before the notice period starts, and must give tenants the same notice of non-renewal.",
  "Early termination (83.595(4)): keep Choice 1 at 2x rent? What early-termination notice period (60 days or less)?",
  "Obligo: what exactly does the tenant sign (fee, insurance, surety bond, installment plan)? The attorney must decide whether 83.491 applies. If it does not, remove clause 10.6 (fee-in-lieu notice and disclosure). Is the option offered to every new tenant at a property (required by 83.491(7) if it is a fee in lieu)?",
  "Insurance model: §1.6 requires a renter's policy naming the landlord as additional insured; §9 and the welcome letter use the LLIP / interested-party model. Pick one (review F17); the template keeps both wordings until you decide.",
  "Property mix: which properties are not single-family homes or duplexes? The repair deductible (§3.2) and other duty shifts are allowed only for single-family homes and duplexes under 83.51(1). Should the app block the deductible on other units?",
  "Personal property after move-out: add the 83.67(5) legend (no landlord liability for storage or disposition), or keep following ch. 715? Not added in this draft.",
  "Decided Nov 1, 2026: keep the jury waiver (§4.3) and the $150 repair deductible (§3.2) on all single-family homes. Attorney to confirm both are enforceable.",
  "Guarantors: the original lease has no guaranty terms. The template only adds a guarantor signature block when a lease has a guarantor; attorney to supply the guaranty wording.",
  "Items outside the saved statute for the attorney: NSF fee cap and returned-check wording (ss. 68.065 / 832.08); assistance and service animal wording (FHA, ss. 413.08 / 760.27); LLIP placement 'without notice'; credit reporting; e-signature consent (ch. 668); radon notice (s. 404.056(5)); the 'Administrative Fee' move-out charge; removed 'rental discounts' and returned-check prosecution sentences.",
  "Welcome letter says 'Application fees are non-refundable', but company settings refund the admin fee if an application is denied. Confirm the wording.",
  "Flood disclosure: use it on every lease, or only terms of 1 year or longer (83.512(1))? Who at each owner LLC answers items 1-3?",
  "Lead-based paint (federal, verify): which properties were built before 1978? Who signs the agent's acknowledgment for SIM REI? Confirm the warning statement and items against the EPA/HUD lessor sample form.",
];

const sections: DocumentTemplate["sections"] = [
  // ───────────────────────────── 1 Lease Terms ─────────────────────────────
  {
    id: "lease-terms",
    number: "1",
    title: "Lease Terms",
    initials: true,
    clauses: [
      {
        id: "parties",
        number: "1.1",
        title: "Parties and Occupants",
        blocks: [
          p("This Lease Contract is between you, the undersigned resident(s): {{tenant_names}}, and us, the Landlord: {{landlord_name}}, acting through its agent {{agent_name}}."),
          p("You've agreed to rent the property located at {{unit_address}} for use as a private residence only. The terms \"you\" and \"your\" refer to all residents listed above. The terms \"we,\" \"us,\" and \"our\" refer to the Landlord and its agent."),
          p("**Landlord and notice address.** The owner of the Premises is {{landlord_name}}. {{agent_name}}, {{agent_address}}, is the owner's agent and is authorized to receive notices and demands on the owner's behalf. This authority continues until Landlord notifies you otherwise in writing."),
          p("The home will be occupied exclusively by the resident(s) listed above. The Landlord must approve any unlisted occupant living in the Premises for longer than {{guest_stay_days}} consecutive days."),
          p("Non-adult occupants: {{other_occupants}}"),
        ],
        changes: [
          ch("F1", "Fla. Stat. 83.50", "disclosure", "Names the owning LLC as Landlord and SIM REI as its agent, with the address for notices and demands, as 83.50 requires at or before the start of the tenancy.", "and us, the owner/agent: [Company Name]"),
          ch("4d", "n/a", "cleanup", "Guest-stay limit (7 days) is now a company setting. \"Unauthorized occupants\" reworded to \"unlisted occupant\" so the sentence makes sense.", "approve unauthorized occupants living in the premises for longer than 7 consecutive days"),
        ],
      },
      {
        id: "duration",
        number: "1.2",
        title: "Lease Duration",
        blocks: [
          p("The term of this tenancy begins on {{lease_start_date}} and ends on {{lease_end_date}}."),
          p("If the Resident remains in possession of the Premises after the initial lease term ends without signing a renewal, the tenancy automatically converts to a month-to-month tenancy. During this period:"),
          list(
            [
              "Continuation of Terms: All terms and conditions of the original Lease remain in full force and effect except as modified here.",
              "Rental Rate Adjustment: The monthly rent increases by ${{mtm_rent_increase}} per month, effective on the first day after the lease term ends, and is due on the same payment schedule as during the fixed term.",
              "Termination Notice: Either party may end the month-to-month tenancy by giving the other written notice at least {{mtm_notice_days}} days before the end of a monthly rental period. The tenancy then ends on the last day of that period. Notice must be delivered by mail, by hand delivery, by e-mail if the parties have signed the Electronic Notice Addendum (s. 83.505, Florida Statutes), or, if the Resident is absent, by leaving a copy at the residence (s. 83.56(4), Florida Statutes).",
              "Changes to Terms: During a month-to-month tenancy, Landlord may change the rent or other terms only by giving written notice at least {{mtm_notice_days}} days before the end of a monthly rental period. The change takes effect on the first day of the next period. If Resident does not accept the change, Resident may end the tenancy under the notice terms above.",
              "Legal Compliance: All changes and conditions under this month-to-month tenancy must comply with current state and local landlord-tenant laws. Any provision found to conflict with those laws will be modified or severed as needed to remain enforceable.",
            ],
            true,
          ),
        ],
        changes: [
          ch("F3", "Fla. Stat. 83.57(3), 83.56(4)", "must", "Month-to-month notice now runs to the end of a monthly rental period and lists the delivery methods the statute allows, instead of any \"desired move-out date\".", "Notice must be received no later than 30 days prior to the desired move-out date."),
          ch("F5", "Fla. Stat. 83.44, 83.57", "attorney", "Landlord may change month-to-month terms only with notice before the end of a rental period, and the tenant may leave instead of accepting. Narrows a one-sided change right.", "Landlord reserves the right to modify the terms of this Lease with at least 30 days' written notice"),
          ch("F4", "n/a", "cleanup", "The $150 month-to-month increase is now a company setting (amount unchanged)."),
        ],
      },
      {
        id: "long-term-rent",
        number: "1.2.1",
        title: "Rent After the First 12 Months",
        when: ["long_term"],
        blocks: [
          p("This Lease runs longer than 12 months. The monthly rent in Section 1.3 applies for the first 12 months. On each anniversary of the start date, the monthly rent increases by {{long_term_increase_percent}}%, to {{year_two_rent}} for months 13 through 24."),
        ],
        changes: [ch("N/A", "Contract term (no specific ch. 83 section)", "attorney", "New, for leases over 12 months. A fixed-term lease can't be changed mid-term without both parties agreeing, so any yearly rent step must be written into the lease up front. The percent is a company setting (Settings › Lease terms).")],
      },
      {
        id: "rent",
        number: "1.3",
        title: "Rents and Charges",
        blocks: [
          p("You shall pay a total monthly rent amount of: {{monthly_charges}}"),
          p("If your move-in date is after the {{prorate_after_day}} of the month, the first month's rent for the following month and prorated rent of {{prorated_rent}} are due before move-in."),
          p("Every month after that, you must pay your rent on or before the {{rent_due_day}} day of each month. Your rent is late after the {{rent_late_after_day}} of each month. The following late fees apply to payments made after the {{rent_late_after_day}} of each month."),
          p("Late fee rule: {{late_fee_rule}}"),
          p("Daily late fee beginning after the {{daily_late_fee_start_day}}: {{daily_late_fee}}"),
          p("Payments are deemed received when actually delivered to and received by Landlord. Dishonored checks or online payments will be treated as late payments. A returned-payment fee of ${{nsf_fee}} (not more than the amount allowed by Florida law) applies to any dishonored check or electronic payment, and is deemed Additional Rent. Any additional bank and handling charges assessed for a dishonored payment are also deemed Additional Rent. Landlord may require Resident to replace any dishonored check or online payment with a money order, cashier's check, or bank check. Landlord may further require that all later payments after a dishonored payment be made by money order, cashier's check, or bank check."),
          p("The rent and terms of this Lease are fixed for the Lease Term and may be changed only by a written amendment signed by Resident and Landlord."),
        ],
        changes: [
          ch("F6", "Fla. Stat. 83.44, 83.45", "attorney", "Removed the landlord's one-sided right to change the lease (including rent) during the fixed term. Changes now need a written amendment signed by both sides.", "We may change the terms of this lease in accordance with applicable law, including rent increases"),
          ch("F9", "Outside the saved statute (ss. 68.065 / 832.08 not in file)", "attorney", "NSF fee is now a setting, capped at what Florida law allows, and covers electronic payments. Attorney to confirm the allowed amount.", "A fee of $50.00 shall be applied by Landlord to any dishonored check"),
          ch("F7", "Fla. Stat. 83.46(1)", "cleanup", "Due day, late day, daily-fee start day and proration cutoff are now settings so the dates in this clause stay in line with each other.", "Your rent is late after the 3rd ... Daily late fee beginning after the 4th"),
        ],
      },
      {
        id: "rent-insurance-waiver",
        when: ["llip_offered"],
        blocks: [
          p("You may provide proof of renter's insurance coverage. If the policy meets the Landlord's minimum requirements in the attached Required Insurance Addendum, the monthly insurance charge will be waived and removed from your rental obligations."),
        ],
        changes: [ch("4d", "n/a", "cleanup", "Shown only when the property offers the LLIP program.")],
      },
      {
        id: "deposit",
        number: "1.4",
        title: "Security Deposit",
        blocks: [
          p("The total security deposit at the time this Lease Contract is signed, for all residents of the Premises, is {{security_deposit}}, due before move-in. The security deposit secures the return of the Premises at the end of the term in as good condition as when Resident took possession, normal wear and tear excepted, and the faithful, timely and complete performance of all other terms, conditions, and covenants of the Lease. Landlord may make a claim on the Security Deposit for nonpayment of Rent or Additional Rent, damage to the Premises, replacement of damaged or missing items on the Premises, cleaning of the Premises beyond normal wear and tear, any obligation Resident fails to perform under this Lease, or in connection with Landlord's remedies under this Lease. Resident may not use the Security Deposit as payment for any rent Resident owes under this Lease."),
          p("**Return of deposit.** If Landlord does not intend to make a claim on the deposit, Landlord will return the full deposit (with any interest due) within {{deposit_return_days}} days after the Lease ends and you vacate. If Landlord intends to make a claim, Landlord will send you written notice of the claim and the reason for it within {{deposit_claim_notice_days}} days after the Lease ends. Landlord will send it by certified mail to your last known mailing address, or by e-mail if you have signed the Electronic Notice Addendum. You have {{deposit_objection_days}} days after you receive that notice to object in writing at the Landlord's notice address in Section 1.1. Landlord will send any remaining balance within 30 days after the date of the notice. Please give Landlord your forwarding address in writing when you move out."),
          p("If Resident consists of more than one person, Resident agrees that Landlord may, at Landlord's discretion, send the return or notice to one representative of Resident or send pro-rata refunds to each person."),
          p("**Where the deposit is held.** Your security deposit and any advance rent are held as follows:"),
          {
            kind: "choice",
            id: "deposit_account_type",
            setBy: "landlord",
            field: "deposit_account_type",
            options: [
              { id: "non_interest", text: "In a separate non-interest-bearing account at {{deposit_bank_name}}, {{deposit_bank_address}}, a Florida financial institution." },
              { id: "interest", text: "In a separate interest-bearing account at {{deposit_bank_name}}, {{deposit_bank_address}}, a Florida financial institution." },
              { id: "surety_bond", text: "Landlord has posted a surety bond as provided by law (s. 83.49(1)(c), Florida Statutes)." },
            ],
          },
          {
            kind: "choice",
            id: "deposit_interest",
            setBy: "landlord",
            field: "deposit_interest",
            options: [
              { id: "not_entitled", text: "You are not entitled to interest on the deposit." },
              { id: "entitled", text: "You are entitled to interest on the deposit of {{deposit_interest_terms}}, paid or credited at least once a year." },
            ],
          },
          p("If Landlord changes where or how the deposit is held, Landlord will notify you in writing within 30 days of the change."),
          law("YOUR RENTAL AGREEMENT REQUIRES PAYMENT OF CERTAIN DEPOSITS. THE LANDLORD MAY TRANSFER ADVANCE RENTS TO THE LANDLORD’S ACCOUNT AS THEY ARE DUE AND WITHOUT NOTICE. WHEN YOU MOVE OUT, YOU MUST GIVE THE LANDLORD YOUR NEW ADDRESS SO THAT THE LANDLORD CAN SEND YOU NOTICES REGARDING YOUR DEPOSIT. THE LANDLORD MUST PROVIDE YOU WRITTEN NOTICE IN PERSON, BY MAIL, OR BY E-MAIL IN ACCORDANCE WITH SECTION 83.505, FLORIDA STATUTES, WITHIN 30 DAYS AFTER YOU MOVE OUT, OF THE LANDLORD’S INTENT TO IMPOSE A CLAIM AGAINST THE DEPOSIT. IF YOU DO NOT REPLY TO THE LANDLORD STATING YOUR OBJECTION TO THE CLAIM WITHIN 15 DAYS AFTER RECEIPT OF THE LANDLORD’S WRITTEN NOTICE, THE LANDLORD WILL COLLECT THE CLAIM AND MUST MAIL YOU THE REMAINING DEPOSIT, IF ANY.", "Fla. Stat. 83.49(2)(d)"),
          law("IF THE LANDLORD FAILS TO TIMELY PROVIDE YOU NOTICE, THE LANDLORD MUST RETURN THE DEPOSIT BUT MAY LATER FILE A LAWSUIT AGAINST YOU FOR DAMAGES. IF YOU FAIL TO TIMELY OBJECT TO A CLAIM, THE LANDLORD MAY COLLECT FROM THE DEPOSIT, BUT YOU MAY LATER FILE A LAWSUIT CLAIMING A REFUND.", "Fla. Stat. 83.49(2)(d)"),
          law("YOU SHOULD ATTEMPT TO INFORMALLY RESOLVE ANY DISPUTE BEFORE FILING A LAWSUIT. GENERALLY, THE PARTY IN WHOSE FAVOR A JUDGMENT IS RENDERED WILL BE AWARDED COSTS AND ATTORNEY FEES PAYABLE BY THE LOSING PARTY.", "Fla. Stat. 83.49(2)(d)"),
          law("THIS DISCLOSURE IS BASIC. PLEASE REFER TO PART II OF CHAPTER 83, FLORIDA STATUTES, TO DETERMINE YOUR LEGAL RIGHTS AND OBLIGATIONS.", "Fla. Stat. 83.49(2)(d)"),
        ],
        changes: [
          ch("F10", "Fla. Stat. 83.49(3)(a)-(b)", "must", "Deposit goes back within 15 days if there is no claim; a claim needs written notice within 30 days by certified mail (or e-mail under 83.505), with 15 days to object. Replaces the single 30-day plain-mail rule.", "will be returned by mail to Resident not more than thirty (30) days after expiration of the Term"),
          ch("F12", "Fla. Stat. 83.49(2)(d)", "must", "Capital-letter deposit disclosure replaced with the current statutory text word for word (\"PROVIDE YOU WRITTEN NOTICE IN PERSON, BY MAIL, OR BY E-MAIL\"; \"YOU/YOUR\" restored).", "THE LANDLORD MUST MAIL RESIDENT NOTICE, WITHIN 30 DAYS AFTER RESIDENT MOVE OUT"),
          ch("F13", "Fla. Stat. 83.49(1), 83.49(2)(b)-(c)", "disclosure", "Depository notice now states the bank's name and address (or surety bond), the account type, and whether the tenant gets interest. These are set by the office per owner instead of two bank checkboxes.", "held in an account at: [ ] Chase bank [ ] United Southern Bank"),
          ch("F69", "n/a", "cleanup", "\"Apartment\" changed to \"Premises\"; \"retain\" changed to \"make a claim on\" to match the 83.49(3) process.", "for all residents in the apartment"),
        ],
      },
      {
        id: "utilities",
        number: "1.5",
        title: "Utilities",
        blocks: [
          p("We'll pay for the following utilities: {{utilities_included}}"),
          p("You'll pay for all other utilities, related deposits, and any charges, fees, or services on those utilities. We do not guarantee that there will be no interruption of utility service by the provider. You should contact the utility service provider if service is interrupted. If your electricity is ever interrupted, you must use only battery-operated lighting."),
          p("If a condominium or homeowners association stops providing a service it currently provides (such as cable, internet, alarm monitoring, or a guarded gate), Landlord is not required to replace that service. Landlord will not cause any utility service to be terminated or interrupted, as provided in s. 83.67, Florida Statutes. If an essential utility (water, sewer, or trash) must be moved into Resident's name, Landlord will give Resident reasonable written notice before the change. Your failure to set up and pay for an essential service after that notice is a material breach of the Lease."),
          p("If the Premises is on well water and the city or county connects the Premises to municipal water, you will be responsible for paying the monthly water bill (and the monthly sewer bill if no longer on septic) and will place the water/sewer utility in your name unless the provider does not allow it, to avoid any interruption in service."),
          p("If you surrender the Premises early, abandon the Premises, or are evicted, you remain responsible for all accruing utility charges that are your responsibility under the Lease. You are responsible for any cost to install or maintain phone lines, cable lines, outlets or jacks if you choose landline or cable service. Placement of that equipment is subject to Landlord's approval."),
        ],
        changes: [
          ch("F15", "Fla. Stat. 83.67(1), 83.47(1)(a)", "attorney", "Removed \"shall not be construed as a prohibited practice\" and the landlord's right to drop services; added that Landlord will not cause utilities to be cut off and will give notice before moving an essential utility to the tenant.", "The discontinuation of any such services by the condominium association, homeowners association, or landlord shall not be construed as a prohibited practice"),
        ],
      },
      {
        id: "insurance",
        number: "1.6",
        title: "Insurance",
        blocks: [
          p("Landlord's insurance does not cover your personal property or your liability. We strongly encourage you to carry renter's insurance for losses to your personal property or injuries due to theft, fire, water damage, pipe leaks and the like. This section does not limit any liability Landlord has to you under law."),
          p("Resident shall, at Resident's sole cost and expense, obtain renter's insurance covering the full value of all personal property of Resident in the Premises, and providing liability coverage to Resident in an amount not less than ${{required_liability_limit}}, which policy shall name Landlord as an additional insured. Resident shall maintain such renter's insurance at all times during the Term of the Lease. Resident shall provide a certificate of insurance to Landlord demonstrating that Resident has procured the required insurance coverage. If Resident fails to procure the required insurance, allows such insurance to be cancelled or to lapse, or fails to timely provide the required certificates of insurance, the same shall be a Default of this Lease."),
        ],
        changes: [
          ch("F16", "Fla. Stat. 83.47(1)(b)", "attorney", "Removed \"You assume all liability for personal injury, property damage or loss\"; the clause now says it does not limit the landlord's legal liability.", "You assume all liability for personal injury, property damage or loss, and insurable risk."),
          ch("F17", "Outside the saved statute (insurance)", "attorney", "Kept as written for now: this paragraph (additional insured, lapse is a default) conflicts with §9 and the welcome letter (LLIP, interested party). Owner to pick one model. Liability minimum is now a setting.", "which policy shall name Landlord as an additional insured"),
        ],
      },
      {
        id: "keys",
        number: "1.7",
        title: "Keys and Locks",
        blocks: [
          p("You will be provided the following keys: {{keys_list}}"),
          p("All deadlocks, keys, window latches, doorknobs and any additional device required by local government ordinance will be in working order when you move in."),
          p("If Resident changes the locks without giving Landlord a key, and Landlord is prevented from entering the Premises or any interior door because of the lock change, Resident is responsible for all of Landlord's costs to enter the Premises by force, including any damage to the Premises. If Resident is locked out of the Premises and Landlord must unlock the door for Resident, Resident will be charged a ${{lockout_fee}} service charge."),
          p("All keys must be returned to us when you vacate. You will be charged for the cost of new locks and keys that are not returned."),
        ],
        changes: [ch("F18", "n/a", "cleanup", "Key list and $125 lockout charge are now settings (values unchanged).")],
      },
    ],
  },

  // ───────────────────────────── 2 Policies and Procedures ─────────────────────────────
  {
    id: "policies",
    number: "2",
    title: "Policies and Procedures",
    initials: true,
    clauses: [
      {
        id: "rules",
        number: "2.1",
        title: "Resident Policies or Rules",
        blocks: [
          p("You and all guests and occupants must comply with any written community rules and policies, including instructions for care of our property. Any rules are considered part of this Lease Contract. We may make reasonable changes to written rules, effective immediately, if distributed and applicable to all units in your community or your home."),
        ],
      },
      {
        id: "safety",
        number: "2.2",
        title: "Resident Safety and Property Loss",
        blocks: [
          p("You and all occupants and guests must exercise due care for your own and others' safety and security, especially in the use of smoke detectors, keyed deadbolt locks, keyless deadbolts, window latches, and other security or safety devices. You agree to make every effort to abide by the rules and guidelines in this Lease Contract."),
          p("**Casualty Loss.** Landlord is not responsible for loss of or damage to Resident's personal property caused by fire, flood, storms, utility interruption, theft, or vandalism, except where caused by Landlord's negligence or failure to perform a duty under law, including s. 83.51, Florida Statutes. If the Premises are damaged by casualty, Resident has the rights stated in s. 83.63, Florida Statutes."),
          p("**Smoke Detectors.** The Unit is equipped with smoke and carbon monoxide detectors in accordance with state or local government regulations. You must immediately report smoke-detector malfunctions to us. Neither you nor others may disable smoke detectors. You will be liable to others and us for any loss, damage, or fines from fire, smoke, or water if that condition arises from disabling or damaging the smoke detector or from your failure to replace a dead battery or report malfunctions to us."),
          p("**Crime & Drug Free.** You or any guest or resident under your control should not engage in any criminal, illegal or illicit activity in your home or community. No alcoholic beverages shall be possessed or consumed by Resident, or Resident's licensees or invitees, unless the person possessing or consuming alcohol is of legal age. No illegal drugs or controlled substances (unless specifically prescribed by a physician for a specific person residing or present on the Premises) are permitted on the Premises."),
          p("In case of emergency, fire, accident, smoke or suspected criminal activity, dial 911 or call emergency personnel. You should then contact our representative. Landlord does not guarantee security and is not responsible for crimes committed by others, except to the extent Landlord is liable under law."),
          p("**Smoke Free.** You or any guest or resident under your control are not permitted to smoke or vape any substance inside your home. This is a smoke-free home. A smoke-free home includes no smoke odor inside the home. You will be held financially liable for any damages related to smoke smell, including but not limited to the cost to repaint, odor removal, and any other additional costs to remove or repair smoke smell or damage."),
          p("**Additional Use of Premises.** Resident agrees not to use the Premises in any way that may increase the rate or cost of insurance on the Premises (for example, no trampolines). No hazardous or dangerous activities are permitted on the Premises. Resident shall not use the Premises in a manner that may endanger the person or property of Landlord, co-residents, or any person living on or near the Premises. Resident agrees to limit use of the Premises to uses consistent with the Premises' clean, safe, sanitary, and habitable condition. Neither Resident nor Resident's invitees shall be a nuisance or act in any manner that would interfere with the quiet enjoyment by adjacent property owners or residents. This includes, but is not limited to, loud noises, loud music, noxious or unpleasant odors, and disruptive behavior or actions."),
        ],
        changes: [
          ch("F20", "Fla. Stat. 83.47(1)(b), 83.63", "attorney", "Casualty clause no longer excuses the landlord \"from any cause\"; it keeps the landlord's duties under 83.51 and the tenant's casualty rights under 83.63.", "We're not liable to any resident, guest, or occupant for personal injury or damage or loss of personal property from any cause"),
          ch("F21", "Fla. Stat. 83.47(1)(b)", "attorney", "Crime clause narrowed to \"except to the extent Landlord is liable under law\".", "Unless otherwise provided by law, we're not liable to you or any guests or occupants for injury, damage, or loss"),
          ch("F69", "n/a", "cleanup", "Typo fixed.", "this Lease Contact"),
        ],
      },
      {
        id: "parking",
        number: "2.3",
        title: "Parking, Stored and Abandoned Vehicles",
        blocks: [
          p("(a) Permitted Parking. You will park on the property at your own risk. {{vehicles_per_leaseholder}} vehicle(s) are allowed on the property per leaseholder. Each vehicle must be registered with us in writing (year, make, model, color, license plate number, and state). We may assign, reassign, or regulate the time, manner, and place of parking for cars, trucks, motorcycles, bicycles, boats, trailers, campers, and recreational vehicles by you, your occupants, or your guests. Guests must park only in areas we designate for guest parking."),
          p("(b) Operable and Registered. Every vehicle on the property must at all times be (i) operable under its own power, (ii) currently registered with a valid, unexpired license plate and registration decal, and (iii) insured as required by Florida law. Vehicles are prohibited from parking on the premises if they take up more than one parking space, are parked in a marked handicap space without proper handicap insignia, block other vehicles or dumpsters, obstruct a fire lane, or are parked anywhere not dedicated to parking, including grass, sidewalks, patios, and landscaped areas."),
          p("(c) Stored Vehicle Defined. A vehicle is considered a \"Stored Vehicle\" if any one or more of the following applies:"),
          list(
            [
              "The vehicle has not been moved under its own power for {{stored_vehicle_days}} consecutive days;",
              "The vehicle is supported by jacks, blocks, ramps, or stands, or has one or more wheels or tires removed;",
              "The vehicle has one or more flat or deflated tires, a broken or missing window or windshield, or missing body panels, hood, doors, or trunk lid;",
              "The vehicle is being used to store personal property, refuse, or materials rather than for transportation;",
              "The vehicle is covered by a tarp or car cover for more than {{vehicle_cover_days}} consecutive days;",
              "The vehicle is undergoing repair, restoration, or disassembly on the premises for more than {{vehicle_repair_hours}} hours; or",
              "The vehicle has visibly accumulated dirt, debris, leaves, mildew, or vegetation growth indicating it has not been in regular use.",
            ],
            true,
          ),
          p("(d) Abandoned Vehicle Defined. A vehicle is considered an \"Abandoned Vehicle\" if it meets the definition of a Stored Vehicle above and any one or more of the following also applies:"),
          list(
            [
              "The registration or license plate has been expired for more than {{expired_registration_days}} days, or the vehicle bears no license plate;",
              "The vehicle has not been moved within {{vehicle_notice_days}} days after we deliver written notice to you regarding the vehicle;",
              "The vehicle remains on the property after your right of possession ends by expiration, surrender, abandonment of the premises, or eviction;",
              "No resident or occupant claims ownership or lawful possession of the vehicle within {{vehicle_notice_days}} days after our written notice; or",
              "The vehicle otherwise meets the definition of an abandoned or derelict motor vehicle under Florida law.",
            ],
            true,
          ),
          p("(e) Prohibited Activity. No vehicle repair, maintenance, fluid changing, body work, or painting may be performed on the property, except for minor emergency work necessary to move a vehicle off the property (for example, changing a flat tire or jump-starting a battery). You are responsible for the cost of cleaning or remediating any oil, fuel, coolant, or other fluid stains or spills caused by your vehicle or the vehicle of your occupant or guest."),
          p("(f) Notice, Removal, and Charges. Stored Vehicles and Abandoned Vehicles are not permitted on the property and are a violation of this Lease Contract. We may give you written notice to remove the vehicle. If the vehicle is not removed within {{vehicle_notice_days}} days of the notice, or immediately in the case of a vehicle creating a hazard, blocking access, or obstructing a fire lane, we may have the vehicle towed and stored at the vehicle owner's expense in accordance with Section 715.07, Florida Statutes, and applicable local ordinance. We are not liable to you or to any vehicle owner for loss or damage arising from a lawful tow."),
          p("(g) Extended Absence Exception. If you will be away from the premises for an extended period due to travel, military deployment, hospitalization, or similar circumstance, you may request in writing that a vehicle remain parked and unmoved. We will not unreasonably withhold approval. Any approval must be in writing from us, must state an expiration date, and applies only to the specific vehicle and time period identified."),
        ],
        changes: [ch("4d", "n/a", "cleanup", "Vehicle limit and the 14-day, 7-day, 48-hour, 30-day and 5-day vehicle periods are now settings (values unchanged). Broken line wraps from the PDF removed.")],
      },
      {
        id: "pets",
        number: "2.4",
        title: "Pets",
        blocks: [
          p("Pets (including mammals, reptiles, birds, fish, and insects) are allowed only if we have authorized them in writing. Unauthorized animals are a lease violation. If an unauthorized animal is found, Landlord may deliver a {{cure_notice_days}}-day notice to cure under s. 83.56(2)(b), Florida Statutes. If the animal is not removed within {{cure_notice_days}} days after delivery, Landlord may terminate the Lease. Pet-related charges may also apply."),
          p("Assistance animals (including service animals) are not pets. We will consider requests for an assistance animal as a reasonable accommodation for a person with a disability, as required by fair housing law. Any request for supporting information will be made only as allowed by that law. Pet rent, pet fees and pet limits do not apply to assistance animals."),
          p("If you or any guest or occupant violates animal restrictions (with or without your knowledge), you'll be subject to charges, damages, eviction, and other remedies provided in this Lease Contract and by law. If an animal has been in the Premises at any time during your occupancy (with or without our consent), we'll charge you for de-fleaing, deodorizing, and shampooing, to the extent permitted by law."),
        ],
        changes: [
          ch("F24", "Fla. Stat. 83.56(2)(b), 83.56(4)", "must", "Replaced the 24-hour removal default with the 7-day notice to cure the statute requires for unauthorized pets (this notice cannot be waived in a lease).", "You must remove an illegal animal within 24 hours of notice from us, or you will be considered in default"),
          ch("F25", "Outside the saved statute (Fair Housing Act; Fla. Stat. 413.08, 760.27 not in file)", "attorney", "\"Service animal\" widened to assistance animals; documentation requests limited to what the law allows; pet charges do not apply. Attorney to supply final wording.", "We may require a written statement from a qualified professional, verifying the need for the service animal."),
          ch("F26", "Outside the saved statute (assistance animals)", "attorney", "De-fleaing charge kept, limited to \"to the extent permitted by law\" so it is not applied to an assistance animal where the law forbids it.", "we'll charge you for de-fleaing, deodorizing, and shampooing"),
        ],
      },
    ],
  },

  // ───────────────────────────── 3 Responsibilities ─────────────────────────────
  {
    id: "responsibilities",
    number: "3",
    title: "Responsibilities",
    initials: true,
    clauses: [
      {
        id: "condition",
        number: "3.1",
        title: "Condition of Premises and Alterations",
        blocks: [
          p("Resident has inspected the Premises and accepts its condition, subject to Landlord's continuing duties under s. 83.51, Florida Statutes. Resident will keep the Premises clean and in good condition as required by s. 83.52, Florida Statutes. You agree not to alter, damage, or remove our property, including alarm systems, smoke detectors, furniture, telephone and cable TV wiring, screens, locks, and security devices. You may not paint or make any permanent alteration without our written consent."),
        ],
        changes: [
          ch("F27", "Fla. Stat. 83.51(1), 83.47(1)(a)", "attorney", "Removed \"as is\" and \"We disclaim all implied warranties\"; acceptance of condition is now subject to the landlord's 83.51 duties.", "You accept the apartment, fixtures, and furniture as is ... We disclaim all implied warranties."),
        ],
      },
      {
        id: "maintenance",
        number: "3.2",
        title: "Maintenance & Care",
        blocks: [
          p("**Plumbing.** Resident is fully responsible for any costs of plumbing backups or slow drainage that result from misuse, whether accidental or intentional. Resident agrees not to dispose of inappropriate items or substances into any plumbing fixture or drain line, including but not limited to:"),
          list(["Cooking oils or grease", "Sanitary napkins, tampons, or wipes (flushable or otherwise)", "Diapers", "Toys or foreign objects", "Excessive food waste (e.g., rice, pasta, bones)"]),
          p("If any of the above items are found to be the cause of a plumbing issue, Resident will bear 100% of the associated repair costs. Resident must promptly notify Landlord in writing of any plumbing leaks, slow drainage, or unusual water pressure. Landlord will then make reasonable efforts to remedy the issue in compliance with Florida Statute 83.51."),
          p("**Air Conditioning & Heating (HVAC).** Resident is required to replace the air conditioning filter {{ac_filter_interval}}. Failure to do so may result in restricted airflow, system inefficiency, or damage. Resident acknowledges that any damage or repair caused by failure to replace the filter may result in Resident being held financially liable for repair or replacement costs as determined by a licensed HVAC technician."),
          p("**Smoke Detectors.** Resident agrees to test all smoke detectors monthly and replace batteries as needed to keep them working. Resident shall immediately report any non-functioning detectors to the Landlord."),
          p("**Water Filtration.** Resident is responsible for replacing all water filters in appliances such as refrigerators or standalone filtration systems as needed and at least every {{water_filter_months}} months unless the manufacturer specifies otherwise."),
        ],
        changes: [ch("4d", "n/a", "cleanup", "Filter intervals are now settings (values unchanged).")],
      },
      {
        id: "repair-deductible",
        title: "Resident Repair Deductible",
        when: ["repair_deductible"],
        blocks: [
          {
            kind: "choice",
            id: "repair_deductible_applies",
            setBy: "landlord",
            field: "repair_deductible_applies",
            options: [
              { id: "responsible", text: "Resident is responsible" },
              { id: "not_responsible", text: "Resident is not responsible" },
            ],
          },
          p("Resident agrees to pay the first ${{repair_deductible}} of any repair or maintenance cost per incident, unless otherwise required to be covered solely by the Landlord under Florida law. This deductible does not apply to repairs arising from Landlord negligence or major system failures not caused by tenant conduct."),
        ],
        changes: [
          ch("F29", "Fla. Stat. 83.51(1), 83.47(1)(a)-(b)", "attorney", "Owner decision (Nov 1, 2026): keep the $150 deductible on every single-family home; this clause now appears only on single-family leases. Attorney to review: outside single-family homes and duplexes, a deductible on 83.51(1) repairs shifts a duty the statute does not let the landlord shift. Review suggests limiting it to single-family homes and duplexes. Amount is now a setting.", "Resident agrees to pay the first $150.00 of any repair or maintenance cost per incident"),
        ],
      },
      {
        id: "negligence",
        title: "Damage Due to Negligence",
        blocks: [
          p("Resident is fully responsible for 100% of the cost to repair or replace any damage resulting from Resident's:"),
          list(["Abuse or misuse of the premises or appliances", "Failure to report issues in a timely manner", "Violations of the Lease or community policies", "Intentional acts, negligence, or that of their guests, occupants, or pets"]),
          p("All repairs will be completed by a Landlord-approved vendor unless explicitly authorized in writing."),
        ],
      },
      {
        id: "mold",
        title: "Mold & Mildew",
        blocks: [
          p("It is generally understood that mold spores are present essentially everywhere and that mold can grow in almost any moist location. Landlord has informed Resident of the need to prevent moisture in the Premises and of good housekeeping and ventilation practices. Resident acknowledges the necessity of housekeeping, ventilation, and moisture control (especially in kitchens, bathrooms, and around outside walls) for mold prevention. In signing this Lease, Resident has examined the Premises and certifies that Resident has not observed mold, mildew or moisture within the Premises. Resident agrees to immediately notify Landlord if Resident observes mold, mildew or moisture conditions (from any source, including leaks), and to allow Landlord to evaluate and make recommendations or take appropriate corrective action."),
          p("Resident is responsible for mold or moisture damage caused by Resident's failure to ventilate, clean, or promptly report leaks or moisture. Landlord remains responsible for conditions it must repair under s. 83.51, Florida Statutes. Control of moisture and mold prevention are an important part of Resident's Lease obligations."),
        ],
        changes: [
          ch("F31", "Fla. Stat. 83.47(1)(b)", "must", "Deleted the release of all landlord liability for mold and moisture (void under 83.47(1)(b)). Prevention and reporting duties kept; added that the tenant pays for mold damage the tenant causes and the landlord keeps its 83.51 repair duty.", "Resident relieves Landlord from any liability for any bodily injury or damages to property caused by or associated with moisture or the growth of or occurrence of mold"),
        ],
      },
      {
        id: "pest",
        title: "Pest Control",
        blocks: [
          p("Resident is responsible for general pest control beginning {{pest_control_start_days}} days after move-in, unless otherwise agreed in writing. Resident agrees to treat the premises for common pests (ants, roaches, spiders, etc.) at regular intervals, not to exceed {{pest_control_interval_days}} days between treatments. Resident shall notify Landlord immediately if any infestation (including rodents or bed bugs) is suspected so appropriate action can be coordinated."),
        ],
        changes: [ch("4d", "n/a", "cleanup", "30-day start and 90-day interval are now settings (values unchanged).")],
      },
      {
        id: "irrigation",
        title: "Lawn Maintenance & Irrigation System Usage",
        when: ["single_family"],
        blocks: [
          p("If the Premises is equipped with a functional irrigation system, Resident is required to operate and maintain the system on a regular basis. At a minimum, the irrigation system must be used at least {{irrigation_days_per_week}} days per week, or as otherwise required by local ordinance or HOA regulation. Resident shall ensure that:"),
          list(["Irrigation timers are properly set and seasonally adjusted.", "Sprinkler heads remain unobstructed and functional.", "Leaks, broken heads, or dry patches are promptly reported to the Landlord."]),
          p("Failure to use the irrigation system or maintain adequate lawn hydration may result in damage to the lawn or landscaping. In such cases, Resident shall be fully responsible for the cost of any corrective action, including but not limited to:"),
          list(["Lawn seeding or re-sodding", "Soil restoration", "Replacement of dead grass, plants, or shrubs", "Associated labor and materials"]),
          p("Landlord reserves the right to determine whether the lawn condition deviates from its original move-in state through documentation, photos, or professional inspection."),
        ],
        changes: [ch("F33", "Fla. Stat. 83.51(1)-(2)", "cleanup", "Shown only for single-family homes, matching the scope the statute allows. Watering days per week is now a setting.")],
      },
      {
        id: "lawn-assignment",
        title: "Lawn Maintenance Assignment",
        when: ["single_family"],
        blocks: [
          {
            kind: "choice",
            id: "lawn_care_by_resident",
            setBy: "landlord",
            field: "lawn_care_by_resident",
            options: [
              { id: "responsible", text: "Resident is responsible" },
              { id: "not_responsible", text: "Resident is not responsible" },
            ],
          },
          p("If Resident is responsible, the following services must be performed consistently to maintain curb appeal and comply with property standards:"),
          list(["Lawn mowing", "Weed removal from flower beds and landscaped areas", "Shrub and bush trimming"]),
          p("Service frequency: Winter/Fall (November–March): at least {{mow_winter_per_month}} times per month. Spring/Summer (April–October): at least {{mow_summer_per_month}} times per month."),
          p("Landlord reserves the right to inspect the condition of landscaping and lawn care. If Resident fails to maintain the grounds in accordance with this clause, the Landlord may contract the necessary services and bill all associated costs to the Resident as additional rent."),
        ],
        changes: [ch("F33", "Fla. Stat. 83.51(1)-(2)", "cleanup", "Shown only for single-family homes. Mowing frequencies are now settings; the office sets the checkbox per lease.")],
      },
      {
        id: "requests",
        number: "3.3",
        title: "Requests, Repairs, Malfunctions",
        blocks: [
          p("**Maintenance Notification Requirements.** You must report any damage or problem immediately upon discovery, and no later than {{report_within_hours}} hours after becoming aware of it. Failure to do so may result in you being held responsible for any increased repair costs or damages."),
          p("Our complying with or responding to any oral request regarding security or non-security matters does not waive the requirement for written notice under this Lease Contract. Written notice may be submitted via the tenant portal, email, or any other method designated by us in writing. This does not limit how you may deliver notices allowed by Florida law."),
          p("You must promptly notify us in writing of the following: water leaks, electrical problems, malfunctioning lights, broken or missing locks or latches, signs of mold or mildew, pest infestations, HVAC malfunctions, appliance failures, structural cracks, or any condition that poses a hazard to the property, your health, or safety."),
          p("We will respond in accordance with applicable state law and the Lease to repair or remedy such conditions. Landlord may temporarily shut off equipment or a utility only when needed to make a repair or prevent damage, for the shortest practical time, and with notice to Resident when possible."),
        ],
        changes: [
          ch("F35", "Fla. Stat. 83.67(1)", "attorney", "Utility shut-offs limited to repairs or preventing damage, for the shortest practical time, with notice when possible.", "We reserve the right to turn off equipment and interrupt utility services as necessary"),
          ch("F34", "Fla. Stat. 83.56(4), 83.60(1)(b)", "cleanup", "Portal/e-mail kept as a convenience; added that it does not limit statutory notice methods. Report window is now a setting.", "Written notice must be submitted via the tenant portal, email"),
        ],
      },
      {
        id: "entry",
        number: "3.4",
        title: "Right of Entry and Inspections",
        blocks: [
          p("Landlord may enter at any time to protect or preserve the Premises. For repairs, Landlord will give at least {{entry_notice_hours}} hours' notice and enter only between {{entry_start_time}} and {{entry_end_time}}."),
          p("For inspections, including routine and quarterly in-person inspections, maintenance and pest control visits, and for showing the Premises to buyers, lenders, tenants, real estate agents, insurance representatives or contractors, Landlord will give at least {{entry_notice_hours}} hours' notice and enter at a reasonable time. Resident agrees not to unreasonably withhold consent."),
          p("Landlord may also enter in an emergency, when Resident unreasonably withholds consent, or when Resident has been absent for half a rental period (except that if rent is current and Resident has told Landlord of the absence, Landlord will enter only with consent or to protect the Premises), as provided in s. 83.53, Florida Statutes. Landlord will not use the right of entry to harass Resident."),
        ],
        changes: [
          ch("F36", "Fla. Stat. 83.53(2)", "must", "Entry notice for repairs corrected from 12 to 24 hours, between 7:30 a.m. and 8:00 p.m. Other entries follow the 83.53 consent, emergency and absence rules.", "generally requires at least 12 hours' notice for non-emergency entry"),
        ],
      },
      {
        id: "move-out",
        number: "3.5",
        title: "Move Out",
        blocks: [
          p("**End-of-Term Notice.** If Resident does not intend to renew, Resident must give Landlord written notice at least {{end_of_term_notice_days}} days before the Lease End Date. If Landlord does not intend to renew, Landlord will give Resident written notice, delivered as provided in s. 83.56(4), Florida Statutes, at least {{end_of_term_notice_days}} days before the Lease End Date. Resident's notice should include a forwarding address."),
          p("If Resident vacates at the end of the Lease Term without giving the End-of-Term Notice required above, Resident may be liable for liquidated damages of ${{end_of_term_ld_amount}}. This applies only if Landlord gave Resident written notice, delivered as provided in s. 83.56(4), Florida Statutes, within {{ld_prenotice_days}} days before the start of the notice period, that stated Resident's notice obligation, the date the Lease ends, and all fees, penalties, and other charges that apply. This does not release Resident from any outstanding rent or damages."),
          p("After Resident surrenders or abandons the Premises (as defined in s. 83.59(3)(c), Florida Statutes), or after a lawful eviction, Landlord may retake possession, clean and repair, re-rent, determine any security deposit claims, and handle any personal property left behind as provided in s. 83.67(5) and chapter 715, Florida Statutes. Surrender, abandonment, and eviction do not affect Landlord's duty to mitigate."),
          p("**Cleaning.** You must thoroughly clean the unit, including doors, windows, furniture, bathrooms, kitchen appliances, patios, balconies, garages, carports, and storage rooms. If you don't clean adequately, you'll be liable for reasonable cleaning charges."),
          p("**Charges.** You'll be liable for the following charges, if applicable: unpaid rent; unpaid utilities; unreimbursed service charges; repairs or other damages, excluding ordinary wear and tear; replacement cost of our property that was in or attached to the Premises and is missing; unreturned keys; missing or burned-out light bulbs; removing or rekeying unauthorized security devices or alarm systems; agreed reletting charges; packing, removing, or storing property removed or stored; removing illegally parked vehicles; animal-related charges; government fees or fines against us for violation (by you, your occupant, or guest) of local ordinances relating to smoke detectors, false alarms, recycling, or other matters; late-payment and returned-check charges, plus attorney's fees, court costs, and filing fees actually paid; and other sums due under this Lease Contract."),
          p("**Deposit Refund.** Landlord will return or make a claim on your security deposit as described in Section 1.4 and section 83.49(3), Florida Statutes."),
        ],
        changes: [
          ch("F37", "Fla. Stat. 83.575(1)", "must", "Added the landlord's matching duty to give notice of non-renewal; without it the tenant's 60-day notice clause is not allowed. Notice days is now a setting limited to 30-60.", "You will give us a written notice with your intent to vacate 60 (sixty) days prior to the date of expiration"),
          ch("F38", "Fla. Stat. 83.575(2), 83.595(4)(b)", "must", "Liquidated damages now apply only if the tenant vacates without notice AND the landlord first sent the 83.575(2) pre-notice within 15 days before the notice period. No charge for failing to give notice \"to renew\". The app must not post this charge unless the pre-notice was sent and logged.", "Your failure to provide proper notice to renew or not renew per your lease will result in a charge to your account for \"liquidated damages\""),
          ch("F39", "Fla. Stat. 83.67(5), 83.59(3)(c)", "attorney", "Removed the \"immediate right to ... remove property\"; personal property is handled under 83.67(5) and ch. 715. The optional 83.67(5) legend was NOT added (owner decision).", "gives us the immediate right to: clean up, make repairs in, and relet the apartment; determine any security deposit deductions; and remove property"),
          ch("F11", "Fla. Stat. 83.49(3)(a)-(b)", "must", "Deposit Refund no longer repeats the 30-day mail rule; it points to the 15/30-day process in Section 1.4.", "no later than 30 (thirty) days after the Lease Contract termination"),
        ],
      },
      {
        id: "single-family",
        number: "3.6",
        title: "Single-Family Home Maintenance Responsibilities",
        when: ["single_family"],
        blocks: [
          p("This section applies only to residents of single-family homes. Resident is responsible for the following exterior maintenance duties:"),
          list([
            "Pressure Washing: Required {{exterior_maintenance_frequency}}. Resident must ensure walkways, driveways, exterior walls, and other visibly stained areas are properly cleaned.",
            "Gutter Cleaning: Required {{exterior_maintenance_frequency}}, particularly after leaf-fall seasons or storm events.",
            "Trash Cans: Must be returned from curbside on the same day as pick-up and stored out of public view.",
            "Lawn Watering: Resident shall maintain lawn hydration per HOA or county guidelines. During drought conditions or summer months, watering shall be done a minimum of {{irrigation_days_per_week}} days per week unless otherwise restricted.",
            "Other HOA Compliance: Resident is responsible for any homeowner association (HOA) citations or fines issued due to: visible mold/mildew or staining on the home; overgrown grass, weeds, or untrimmed bushes; visible bulk waste or items left curbside outside of designated pick-up times; failure to maintain mailbox, fencing, or property edging in good condition; parking in unauthorized areas (lawns, sidewalks, HOA-restricted zones).",
          ]),
          p("If Resident fails to comply, Landlord reserves the right to complete such work and assess costs to the Resident's ledger as additional rent."),
        ],
        changes: [ch("4d", "n/a", "cleanup", "Shown only for single-family homes (the clause already said so). Frequencies are now settings.")],
      },
      {
        id: "self-inspection",
        number: "3.7",
        title: "Quarterly Self Inspection",
        blocks: [
          p("To ensure the home is being properly maintained and to reduce the need for frequent in-person inspections, residents are required to conduct quarterly self-inspections of the property."),
          p("Inspection Guidelines: Resident shall complete the self-inspection within the first week of each quarter (January, April, July, and October). The inspection must include clear date-stamped photos of the following areas:"),
          list([
            "Kitchen (including stove, refrigerator interior, under sink)",
            "All bathrooms (including showers/tubs, sinks, toilets)",
            "Air conditioning filter (close-up of current condition)",
            "Water heater closet or laundry area",
            "Interior walls for signs of mold or moisture",
            "All flooring surfaces (carpet, tile, etc.)",
            "Exterior view of front yard and backyard (including grass, shrubs, and fence condition)",
          ]),
          p("Photos must be emailed to the management team or uploaded to the tenant portal as instructed."),
          p("Failure to Comply: If a resident fails to complete the quarterly inspection or submits incomplete reports, the landlord reserves the right to conduct an in-person inspection, with notice as provided in Section 3.4, and charge a ${{inspection_fee}} inspection fee to the resident's ledger."),
        ],
        changes: [ch("F41", "Fla. Stat. 83.53", "cleanup", "Inspection fee is now a setting; in-person inspection refers to the Section 3.4 notice rules.", "charge a $75.00 inspection fee")],
      },
    ],
  },

  // ───────────────────────────── 4 General Clauses ─────────────────────────────
  {
    id: "general",
    number: "4",
    title: "General Clauses",
    initials: true,
    clauses: [
      {
        id: "release",
        number: "4.1",
        title: "Release from Lease Contract",
        blocks: [
          p("Except where this Lease or Florida law gives Resident a right to terminate (including ss. 83.56(1), 83.63, 83.682, and 83.512, Florida Statutes, and the Liquidated Damages Addendum, if selected), Resident is not released from this Lease because of a job transfer, school change, marriage, separation, divorce, loss of co-residents, loss of employment, or similar circumstance."),
          p("**Servicemember Termination.** A Resident who is a servicemember may terminate this Lease as provided in s. 83.682, Florida Statutes. This includes receiving permanent change of station orders to move 35 miles or more away; being prematurely or involuntarily discharged or released from active duty or state active duty; being released from active duty or state active duty when the Premises are 35 miles or more from the home of record; receiving orders to move into government quarters (or becoming eligible for and choosing them); receiving temporary duty, temporary change of station, or state active duty orders to an area 35 miles or more away for more than 60 days; or receiving a change of orders to an area 35 miles or more away before taking possession. Resident must give written notice effective at least {{military_notice_days}} days after Landlord receives it, with a copy of the official military orders or a written verification signed by the commanding officer. If a servicemember dies during active duty, an adult member of the immediate family may terminate the same way, with the orders or verification and a copy of the death certificate. Resident owes only rent prorated to the termination date and no other rent or damages for the early termination. If notice is given 14 or more days before occupancy, no damages or penalties apply. These rights cannot be waived."),
          p("**Replacements and Subletting.** Replacing a resident, subletting, or assignment is allowed only with our written consent. If we approve a replacement resident, at our option, the replacement resident must sign this Lease Contract with or without an increase in the total security deposit, or the remaining and replacement residents must sign an entirely new Lease Contract."),
        ],
        changes: [
          ch("F42", "Fla. Stat. 83.56(1), 83.63, 83.682, 83.512, 83.47(1)(a)", "attorney", "\"Not released for any reason ... bad health, or death\" replaced with a list of the statutory termination rights the lease cannot take away.", "you won't be released from this Lease Contract for any reason, including ... bad health, or death"),
          ch("F43", "Fla. Stat. 83.682", "must", "Military clause rewritten to match 83.682: all six triggers, family's right on death, proof required, prorated rent only, no damages if 14+ days before occupancy, cannot be waived.", "You may terminate the Lease Contract if you enlist or are drafted or commissioned and on active duty"),
        ],
      },
      {
        id: "default",
        number: "4.2",
        title: "Default by Resident",
        blocks: [
          p("If rent is not paid when due, Landlord may deliver a written {{pay_notice_days}}-day notice under s. 83.56(3), Florida Statutes, demanding payment of the rent or possession of the Premises within {{pay_notice_days}} days (excluding Saturday, Sunday, and legal holidays) after delivery. If Resident does not pay or vacate within that time, Landlord may terminate this Lease and file an action for possession."),
          p("For all other defaults, we may file a suit for Lease Contract termination after giving you {{cure_notice_days}} days' written notice of Lease Contract termination. That notice will state that your Lease Contract will terminate {{cure_notice_days}} days after your receipt of the notice unless the breach is remedied within the {{cure_notice_days}}-day period."),
          p("You'll be in default if you or any guest or occupant materially violates the terms of this Lease Contract, including but not limited to the following: you or any guest or occupant violates the community rules, or fire, safety, or health laws; you or any guest or occupant engages in criminal activity on or near the Premises that threatens the health, safety, or peaceful enjoyment of others or the property; you abandon the Premises; you give incorrect or false answers in your rental application or provide false or fraudulent documentation requested by us; any illegal drugs or paraphernalia are found in the Premises; or you or any guest or occupant engages in any prohibited conduct."),
          p("**Holdover.** You or any occupant, invitee or guest must not hold over beyond the date contained in your move-out notice to vacate (or beyond a different move-out date agreed to by the parties in writing). If a holdover occurs, we are entitled to damages for the holdover period plus any expenses incurred due to the breach of this condition of the Lease Contract."),
          p("**Abandonment of the Premises.** Abandonment is determined under s. 83.59(3)(c), Florida Statutes. Without actual knowledge of abandonment, Resident is presumed to have abandoned the Premises if Resident is absent for one-half of a rental period while rent is unpaid and Resident has not given Landlord written notice of an intended absence. Landlord will not retake possession or dispose of personal property without following the procedures in chapters 83 and 715, Florida Statutes, including filing for possession in court if required and giving written notice about any remaining personal property. After abandonment, Landlord may use any remedy in s. 83.595, Florida Statutes, subject to the Liquidated Damages Addendum if Resident selected Choice 1."),
          p("**Other Remedies.** If Resident defaults, Landlord may use any remedy available under this Lease and Florida law, including terminating the Lease after the notices required by s. 83.56, Florida Statutes, filing an action for possession and money damages, and recovering double rent for any holdover without permission under s. 83.58, Florida Statutes. Landlord may report unpaid amounts to credit reporting agencies as allowed by law."),
        ],
        changes: [
          ch("F45", "Fla. Stat. 83.56(3)-(4)", "attorney", "3-day notice now excludes Saturday, Sunday and legal holidays and is described as a demand for rent or possession, not a \"notice of Lease Contract termination\".", "We may file a suit for Lease Contract termination after giving you three (3) days written notice of Lease Contract termination."),
          ch("F47", "Fla. Stat. 83.56(2), 83.64(1)", "attorney", "Deleted the default for making an \"invalid complaint\" to a utility or the government (close to the retaliation rule) and the arrest-without-conviction defaults; criminal activity limited to activity that threatens others or the property. Attorney to give final wording.", "you or any occupant, in bad faith, makes an invalid complaint to an official or employee of a utility company or the government"),
          ch("F49", "Fla. Stat. 83.59(3)(c), 83.595", "attorney", "5-day unpaid-rent abandonment trigger replaced with the statutory presumption (absent half a rental period, rent unpaid, no notice of absence). \"Liable until re-rented\" replaced with the 83.595 remedies, subject to the Liquidated Damages Addendum.", "If Resident fails to pay rent for five (5) consecutive calendar days after the due date"),
          ch("F50", "Fla. Stat. 83.56(3)-(4), 83.59(3), 83.58", "must", "Removed \"immediately forfeit all rights to occupy\" and \"guilty of a misdemeanor\"; remedies now follow the required notices and court process, plus double rent for holdover under 83.58.", "you immediately forfeit all rights to occupy the apartment any longer ... you are guilty of a misdemeanor"),
          ch("F51", "Outside the saved statute", "attorney", "Removed the undefined \"rental discounts\" repayment and the returned-checks-to-law-enforcement sentence. Credit reporting kept \"as allowed by law\". Attorney may add back if supported.", "you will pay us any amounts stated to be rental discounts ... We may turn any returned checks over to law enforcement officials"),
          ch("F52", "Fla. Stat. 83.505(1)", "must", "The general electronic-notice consent paragraph was removed from this section; e-mail notice is now covered by Section 4.4 and the separate Electronic Notice Addendum.", "Resident agrees to receive notices, documents, and communications related to this lease electronically"),
        ],
      },
      {
        id: "termination-dispute",
        number: "4.3",
        title: "Contract Termination and Dispute",
        blocks: [
          p("This Lease Contract may only be amended, waived, or terminated by our representatives in writing. Any oral promises, representations or agreements by our representatives are not legally binding. Except as provided in s. 83.56(5), Florida Statutes, Landlord's delay in enforcing a term of this Lease does not waive Landlord's right to enforce it later."),
          p("**Waiver of Jury Trial.** To minimize legal expenses and, to the extent allowed by law, you and we agree that a trial of any lawsuit based on statute, common law, and/or related to this Lease Contract shall be to a judge and not a jury."),
          p("**Force Majeure.** If Landlord is delayed in performing an obligation by causes beyond its control (such as hurricanes, strikes, epidemics, or government orders), Landlord will perform as soon as reasonably possible. Resident keeps all rights under ss. 83.56(1) and 83.63, Florida Statutes."),
        ],
        changes: [
          ch("F69", "n/a", "cleanup", "Section 4.3 moved back into Section 4 (the PDF printed it under the Section 5 heading)."),
          ch("F53", "Fla. Stat. 83.56(5)(a), 83.47(1)(a)", "attorney", "Non-waiver now yields to 83.56(5): accepting rent with knowledge of a violation can waive the right to terminate for it.", "isn't a waiver under any circumstances"),
          ch("F54", "Outside the saved statute", "attorney", "Owner decision (Nov 1, 2026): keep the jury waiver as written. Attorney to confirm it is enforceable.", "shall be to a judge and not a jury"),
          ch("F55", "Fla. Stat. 83.56(1), 83.63, 83.47(1)(a)", "attorney", "Force majeure now delays the landlord's performance instead of excusing it, and keeps the tenant's statutory rights.", "We shall be excused from performance of obligations"),
        ],
      },
      {
        id: "notices",
        number: "4.4",
        title: "Delivery of Notices",
        blocks: [
          p("Notices to Landlord go to the notice address in Section 1.1. Notices required by Part II of Chapter 83, Florida Statutes, may be sent by e-mail only if Resident and Landlord have signed the Electronic Notice Addendum. Either party may revoke that election or change the designated e-mail address at any time by written notice. Other routine communications (maintenance updates, reminders) may be sent through the resident portal."),
        ],
        changes: [
          ch("F52", "Fla. Stat. 83.505(1)", "must", "The empty \"Delivery of Notices\" heading now has text: e-mail notice of ch. 83 notices only through the separately signed Electronic Notice Addendum.", "4.4 DELIVERY OF NOTICES (no text)"),
        ],
      },
    ],
  },

  // ───────────────────────────── 5 Standard Charges ─────────────────────────────
  {
    id: "standard-charges",
    number: "5",
    title: "Statement of Standard Charges",
    initials: true,
    clauses: [
      {
        id: "move-out-charges",
        number: "5.1",
        title: "Move Out Charges",
        blocks: [
          p("**Move-Out Charges Schedule (Standard Rates).** These are typical charges for reference only. Any deduction from the security deposit will be based on the actual, reasonable cost of the specific item, excluding ordinary wear and tear, and will be itemized in Landlord's written notice under s. 83.49(3), Florida Statutes."),
          {
            kind: "table",
            head: ["Charge", "Description", "Amount ($)"],
            rows: [
              ["General Cleaning", "Unit not returned in clean condition", "{{charge_general_cleaning}}"],
              ["Deep Cleaning", "Excessive dirt, grease, or unsanitary conditions", "{{charge_deep_cleaning}}"],
              ["Carpet Cleaning", "Professional cleaning required", "{{charge_carpet_cleaning}}"],
              ["Carpet Replacement", "Damaged or heavily stained carpet", "{{charge_carpet_replacement}}"],
              ["Flooring Damage", "Repair or replacement of hard flooring", "{{charge_flooring_damage}}"],
              ["Wall Repair", "Holes, anchors, or excessive wall damage", "{{charge_wall_repair}}"],
              ["Painting (Per Room)", "Repainting due to damage or unauthorized color", "{{charge_painting_room}}"],
              ["Full Unit Repaint", "Entire unit requires repainting", "{{charge_full_repaint}}"],
              ["Appliance Cleaning", "Oven, fridge, etc. not cleaned", "{{charge_appliance_cleaning}}"],
              ["Appliance Repair", "Damage due to misuse", "{{charge_appliance_repair}}"],
              ["Appliance Replacement", "Non-repairable appliance damage", "{{charge_appliance_replacement}}"],
              ["Cabinet / Countertop Repair", "Damage to cabinets or surfaces", "{{charge_cabinet_repair}}"],
              ["Plumbing Repair", "Clogs or misuse-related issues", "{{charge_plumbing_repair}}"],
              ["Fixture Replacement", "Light fixtures, fans, faucets", "{{charge_fixture_replacement}}"],
              ["Doors / Windows Repair", "Damage to doors, screens, or windows", "{{charge_doors_windows}}"],
              ["Blind Replacement", "Broken or missing blinds", "{{charge_blinds}}"],
              ["Trash Removal", "Debris or belongings left behind", "{{charge_trash_removal}}"],
              ["Bulk Hauling", "Furniture or large item removal", "{{charge_bulk_hauling}}"],
              ["Odor Remediation", "Smoke, pet, or strong odors", "{{charge_odor_remediation}}"],
              ["Pet Damage", "Scratches, stains, or odor", "{{charge_pet_damage}}"],
              ["Pest Treatment", "Infestation due to tenant conditions", "{{charge_pest_treatment}}"],
              ["Yard Maintenance", "Unmaintained lawn or exterior", "{{charge_yard_maintenance}}"],
              ["Unauthorized Alterations", "Restoring unit to original condition", "{{charge_unauthorized_alterations}}"],
              ["Key / Fob Replacement", "Missing keys or access devices", "{{charge_key_replacement}}"],
              ["Lock Change / Rekey", "Required due to missing keys", "{{charge_rekey}}"],
              ["Utility Charge Processing", "Final billing or transfer failure", "{{charge_utility_processing}}"],
              ["Administrative Fee", "Coordination of repairs and processing", "{{charge_admin_fee}}"],
            ],
          },
        ],
        changes: [
          ch("F57", "Fla. Stat. 83.49(3)(a), 83.43(14)", "attorney", "Replaced \"subject to actual cost where higher\" with: reference only, deductions at actual reasonable cost, itemized in the 83.49(3) notice. The flat \"Administrative Fee\" row is kept but is not tied to tenant damage: attorney to confirm before deducting it. Every amount is now a setting.", "All charges are subject to actual cost where higher and will be itemized in the final security deposit disposition."),
          ch("F69", "n/a", "cleanup", "\"5.1 Move Out Charges\" heading now sits above the charge table instead of above Sections 4.3 and 4.4."),
        ],
      },
    ],
  },

  // ───────────────────────────── 6 Bed Bug Addendum ─────────────────────────────
  {
    id: "bed-bugs",
    number: "6",
    title: "Bed Bug Addendum",
    initials: true,
    clauses: [
      {
        id: "bed-bug-ack",
        number: "6.1",
        title: "Acknowledgement of Bed Bug Introduction",
        blocks: [
          p("The parties recognize that bed bugs are typically introduced into homes through human activities, often via personal items such as luggage, purses, briefcases, furniture, and other belongings. The Landlord informs the Resident that the Premises have been thoroughly inspected before the Resident takes possession. The Premises have been fully cleaned and vacuumed, and all electrical outlets, air conditioning ducts, appliances, baseboards, carpets, closets, and cabinets have been inspected and deemed bed bug-free."),
        ],
        changes: [ch("F60", "n/a", "cleanup", "\"Apartment\" changed to \"home\"/\"Premises\". The office must confirm this inspection statement is true for each unit.")],
      },
      {
        id: "bed-bug-inspection",
        number: "6.2",
        title: "Inspection Option",
        blocks: [
          p("The Resident may opt for an inspection of the Premises, at their own expense, by an approved third party within {{bed_bug_inspection_days}} days of signing this Addendum. The management office can provide a list of approved pest control companies. Should an inspection reveal the presence of bed bugs, management will arrange for their pest control company to conduct a re-inspection and, if necessary, provide treatment at management's cost. If no bed bugs are found, any preventative measures taken by the Resident will be at their own expense."),
        ],
        changes: [ch("F69", "n/a", "cleanup", "Renumbered: the original printed \"6.1\" twice. Inspection window is now a setting.")],
      },
      {
        id: "bed-bug-treatment",
        number: "6.3",
        title: "Responsibility for Treatments",
        blocks: [
          p("If bed bugs are found during the tenancy and the infestation was caused by Resident, Resident's household, or guests, Resident will pay the reasonable cost of treatment for the Premises (and for adjoining units to the extent the infestation spread from the Premises). Management will arrange treatment through its pest control company, and the Resident must prepare the Premises as described below. Failure to follow the preparation steps may make Resident responsible for the cost of additional treatments."),
          p("If Resident must leave the Premises for treatment, Landlord will give at least {{bed_bug_vacate_notice_days}} days' written notice, the time away will not exceed {{bed_bug_max_vacate_days}} days, and rent will be abated for that time, as provided in s. 83.51(2)(a)1, Florida Statutes."),
          p("1. Preparation for Treatment. The following preparations must be followed before treatment:"),
          list([
            "a. No items may be removed from the infested unit before treatment, including appliances, furniture, or clothing.",
            "b. The Resident agrees to close the blinds and turn off the lights.",
            "c. The Resident must either dispose of the mattress and box springs or arrange for their treatment. If disposing, these items cannot be placed in the property dumpster.",
            "d. All wall-mounted items must be removed and left in the room; the bed should be pulled away from the wall but remain in the room. Large furniture should also be pulled away from the wall, if possible, but left in the room.",
            "e. Carpeting will be pulled up from around the room's perimeter but left on the floor.",
          ]),
          p("2. Post-Treatment Responsibilities. Following treatment, the Resident must remove all bed linens, placing them in a sealed bag for immediate cleaning in hot water or dry cleaning. It is strongly recommended that all clothing in the unit be thoroughly cleaned after treatment."),
          p("3. Follow-Up Services. The Resident acknowledges that a follow-up service will occur approximately {{bed_bug_followup_days}} days after the initial treatment, with the Resident required to follow the same preparation procedures."),
          p("4. Final Inspection. The Premises will be inspected {{bed_bug_final_inspection_days}} days after the follow-up treatment."),
        ],
        changes: [
          ch("F58", "Fla. Stat. 83.51(2)(a)1, 83.51(4), 83.45", "attorney", "Resident pays for treatment only when the infestation was caused by the household or guests (and for adjoining units only if it spread from this unit). Added the statutory 7-day notice, 4-day maximum and rent abatement when the tenant must leave.", "If bed bugs are discovered during the Resident's tenancy, the Resident agrees that all treatment costs will be their responsibility."),
          ch("4d", "n/a", "cleanup", "Follow-up (about 7 days) and final inspection (30 days) are now settings."),
        ],
      },
      {
        id: "bed-bug-access",
        number: "6.4",
        title: "Access and Cooperation",
        blocks: [
          p("The Resident understands that denial of access to the Landlord or its agent for service, failure to cooperate in preparation for treatment, or refusal to pay for bed bug services that are Resident's responsibility under this Addendum is a material breach of the lease agreement. This may result in a {{cure_notice_days}}-day notice to cure and a {{cure_notice_days}}-day notice to vacate as provided in Florida Statutes."),
        ],
        changes: [ch("F59", "Fla. Stat. 83.56(2)", "cleanup", "Renumbered from 6.3; refusal to pay limited to costs that are the Resident's under 6.3.", "refusal to pay for bed bug services")],
      },
    ],
  },

  // ───────────────────────────── 7 Liquidated Damages Addendum ─────────────────────────────
  {
    id: "liquidated-damages",
    number: "7",
    title: "Liquidated Damages Addendum",
    standalone: true,
    initials: true,
    clauses: [
      {
        id: "ld-addendum",
        number: "7.1",
        title: "Liquidated Damages / Early Termination Addendum (s. 83.595, Florida Statutes)",
        blocks: [
          p("This Addendum to the Lease is for the premises at: {{unit_address}}. It is a separate addendum and must be signed separately from the Lease."),
          p("By this addendum, Resident has a choice of what happens if Resident ends the lease early. Resident can pay a fixed amount OR allow Landlord to charge what is allowed by statute. This choice must be made at the time the Lease is signed. If no choice is made and Resident ends the lease early, Landlord will charge what is allowed by Florida Statutes."),
          p("To end this Lease early under the first option, Resident must give Landlord written notice at least {{etf_notice_days}} days before the early termination date."),
          {
            kind: "choice",
            id: "ld_choice",
            prompt: "Mark only one:",
            setBy: "tenant",
            field: "ld_choice",
            options: [
              { id: "agree", text: "I agree, as provided in the rental agreement, to pay ${{ld_amount}} (an amount that does not exceed 2 months’ rent) as liquidated damages or an early termination fee if I elect to terminate the rental agreement, and the landlord waives the right to seek additional rent beyond the month in which the landlord retakes possession." },
              { id: "decline", text: "I do not agree to liquidated damages or an early termination fee, and I acknowledge that the landlord may seek damages as provided by law." },
            ],
          },
          { kind: "initials", parties: ["tenants"], label: "Resident initials next to the chosen option" },
          p("If I choose the first option, I also owe rent and other charges accrued through the end of the month in which Landlord retakes possession, plus charges for damage to the unit. This addendum does not apply to failure to give the end-of-term notice under s. 83.575, Florida Statutes."),
          { kind: "signatures", parties: ["tenants", "agent"], label: "Resident(s) and Landlord ({{landlord_name}}, by {{agent_name}}, its authorized agent)" },
        ],
        changes: [
          ch("F61", "Fla. Stat. 83.595(4)", "must", "Rebuilt as a separately signed addendum using the statutory first-person wording. The amount is now a real dollar figure (default 2x rent, capped at 2 months' rent) instead of the label \"Fill in 2x Monthly Rent\". Added the early-termination notice period (60 days or less), and that rent through the month of retaking possession and damages are still owed. Removed \"Resident will not owe any future rent\".", "Resident agrees ... to pay Liquidated Damages - Fill in 2x Monthly Rent ... Resident will not owe any future rent due under the lease with Choice 1"),
        ],
      },
    ],
  },

  // ───────────────────────────── 8 Pet Addendum ─────────────────────────────
  {
    id: "pet-addendum",
    number: "8",
    title: "Pet Addendum",
    when: ["has_pets"],
    initials: true,
    clauses: [
      {
        id: "pet-addendum-body",
        number: "8.1",
        title: "Pet Addendum",
        blocks: [
          p("THIS PET ADDENDUM (\"Addendum\") regarding the Residential Lease Agreement dated as of {{lease_start_date}} (the \"Lease\") by and between the landlord {{landlord_name}}, by its agent {{agent_name}}, and {{tenant_names}} (\"Resident(s)\"), pertaining to the residence at {{unit_address}} (the \"Premises\"). If the Lease and this Addendum conflict, this Addendum controls. This Addendum does not apply to assistance animals, which are not pets (see Section 2.4)."),
          list(
            [
              "Resident's Pet. Resident desires to keep the following described pet (the \"Pet\") in the Premises: {{pet_information}}. Because the Lease prohibits keeping pets in the Premises without Landlord's prior written consent, Resident agrees to the terms and conditions of this Addendum in exchange for Landlord's agreement to permit Resident to keep the Pet in the Premises.",
              "Pet Rent. In addition to the monthly Rent due under the Lease, Resident shall pay to Landlord monthly pet rent (which shall be \"Additional Rent\" under the Lease) of ${{pet_rent}} per pet, per month, payable in advance on or before the first day of each calendar month during the Term of the Lease, without notice or demand.",
              "Pet Fee. When Resident signs this Addendum, Resident shall pay to Landlord a NONREFUNDABLE pet fee of ${{pet_fee}} per pet (the \"Pet Fee\"). The Pet Fee is not part of the Security Deposit under the Lease and is not an advance payment of Rent. The Pet Fee is paid in consideration of Landlord's agreement to permit Resident to keep the Pet in the Premises and will not be returned to Resident under any circumstances.",
              "Responsibility. Resident is solely responsible for the maintenance of the Pet and agrees to keep the Pet under Resident's control at all times. Resident agrees not to leave the Pet unattended for unreasonable periods of time.",
              "Restraint of Pet. The Pet shall be restrained (by leash, carrier or other reasonably appropriate restraint) but not tethered when outside the Premises. Resident shall take reasonable precautions to prevent the Pet from escaping the Premises.",
              "Applicable Laws. Resident agrees to comply with all laws, rules, regulations and local ordinances applicable to the Pet, including leash and licensing requirements.",
              "Waste and Odors. Resident agrees to clean up after the Pet and to properly and promptly dispose of the Pet's waste. Resident shall take all action necessary to control, to Landlord's reasonable satisfaction, any offensive or noxious odors associated with the Pet.",
              "Food. Resident agrees not to leave unattended food or water for the Pet, or any other animal, outside the Premises.",
              "Complaints. Resident agrees to keep the Pet from being unreasonably noisy or aggressive or causing any annoyance or discomfort to others, and shall remedy immediately any complaints made to Landlord concerning the Pet.",
              "Identification Tag. In addition to any tags or licenses required by law, Resident agrees to provide the Pet with an identification tag that the Pet will wear at all times while kept in the Premises.",
              "Breeding. Resident agrees not to breed or allow the Pet to reproduce. If this unintentionally occurs, the Pet's offspring shall be placed in homes other than the Premises within {{pet_offspring_weeks}} weeks of birth.",
              "Pests. Resident agrees to pay all costs of remediation or extermination of any pest infestation resulting from the Pet, whether during or after the Term of the Lease.",
              "No Other Pets. This Addendum applies only to the Pet(s) described above, and no other pet may be added or substituted under this Addendum. Resident shall provide Landlord with a picture of the Pet before occupancy of the Premises. Any animal not authorized under this Addendum is an unauthorized animal under Section 2.4. Landlord may contact animal control as allowed by law.",
              "Revocation. If Resident fails to strictly comply with this Addendum, Landlord may terminate this Addendum and revoke Landlord's permission for Resident to keep the Pet in the Premises. In that case, Resident shall have {{pet_removal_days}} days to permanently remove the Pet from the Premises.",
              "Liability; Indemnification. Resident agrees to immediately pay for any damage, loss, or expense caused by the Pet. Resident also agrees to indemnify and hold Landlord harmless from all claims (including costs and expenses of defending against such claims) arising or alleged to arise from the presence of the Pet in, on or about the Premises.",
            ],
            true,
          ),
        ],
        changes: [
          ch("F62", "Fla. Stat. 83.43(12)", "cleanup", "Typo \"Addition Rent\" fixed to \"Additional Rent\". Pet rent ($25), pet fee ($350), 7-day removal and 8-week offspring periods are now settings. Landlord named as the owner LLC by its agent.", "(which shall be \"Addition Rent\" under the Lease) of $25.00 per pet"),
          ch("F63", "Outside the saved statute (animal-control law)", "attorney", "Removed \"presumed to be strays and will be disposed of\"; other animals are unauthorized animals under 2.4 and Landlord may contact animal control as allowed by law.", "Any animals on or about the Premises other than the Pet will be presumed to be strays and will be disposed of"),
          ch("F25", "Outside the saved statute (Fair Housing Act)", "attorney", "Added that this Addendum (pet rent, fee, limits) does not apply to assistance animals."),
        ],
      },
    ],
  },

  // ───────────────────────────── 9 Required Insurance Addendum ─────────────────────────────
  {
    id: "insurance-addendum",
    number: "9",
    title: "Required Insurance Addendum to Lease Agreement",
    initials: true,
    clauses: [
      {
        id: "required-insurance",
        number: "9.1",
        title: "Required Insurance Addendum",
        blocks: [
          p("This Addendum is attached to and becomes part of the Residential Lease Agreement. For the duration of the Lease, Lessee is required to maintain and provide the following minimum required insurance coverage:"),
          list(["${{required_liability_limit}} Limit of Liability for Lessee's legal liability for damage to Lessor's property for no less than the following causes of loss: fire, smoke, explosion, and water damage resulting from backup or overflow of sewer, drain or sump (\"Required Insurance\")."]),
          p("Lessee is required to furnish Lessor with evidence of Required Insurance before occupancy of the leased premises and at each lease renewal. If at any time Lessee does not have Required Insurance, Lessee is in breach of the Lease and Lessor shall have, in addition to any other rights under the Lease, the right but not the obligation to purchase Required Insurance coverage protecting the sole interest of the Lessor and seek contractual reimbursement from the Lessee for all costs and expenses associated with such purchase."),
          p("Lessee may obtain Required Insurance or broader coverage from an insurance agent or insurance company of Lessee's choice. If Lessee furnishes evidence of such insurance and maintains it for the duration of the Lease, nothing more is required."),
        ],
        changes: [ch("F17", "Outside the saved statute (insurance)", "attorney", "Liability limit is now a setting. Conflicts with the §1.6 additional-insured wording remain until the owner picks one insurance model.")],
      },
      {
        id: "llip",
        when: ["llip_offered"],
        blocks: [
          p("If Lessee does not maintain Required Insurance, the insurance requirement of this Lease may be satisfied by Lessor, who may purchase such coverage through the Lessor's Legal Liability Insurance Policy (\"LLIP\"). The coverage provided under the LLIP will provide the Required Insurance coverage listed above. An amount equal to the total cost to the Lessor for the LLIP coverage shall be charged to Lessee by the Lessor as a recoverable expense under the Lease. Some important points of this coverage, which Lessee should understand, are:"),
          list(
            [
              "LLIP is designed to fulfill the insurance requirement of the Lease. Lessor is the Insured under the LLIP. This is a single-interest master insurance policy. Lessee is not an Insured, Additional Insured or beneficiary under the LLIP. All loss payments are made to the Lessor.",
              "LLIP coverage is NOT personal liability insurance or renters insurance. LLIP does not cover the Lessee's personal property (contents), additional living expenses or liability arising out of bodily injury or property damage to any third party. If Lessee requires any of these coverages, Lessee should contact an insurance agent or insurance company of Lessee's choice to obtain personal liability insurance or renters insurance to protect Lessee's interests.",
              "Coverage under the LLIP may be more expensive than the cost of Required Insurance obtainable by Lessee elsewhere. At any time, Lessee may contact an insurance agent or insurance company of their choice for insurance options to satisfy the Required Insurance under this Lease.",
              "If Lessee has purchased Renters Insurance and at any time allows such Renters Insurance to lapse in breach of the Lease Agreement, Lessor may purchase Lessor Insurance without notice and add the total cost associated therewith to Lessee's monthly rent payment.",
              "Licensed insurance agents may receive a commission on the LLIP.",
              "The total cost to the Lessee for the Lessor obtaining LLIP shall be ${{llip_monthly}} per month, subject to no proration. This is an amount equal to the actual premium charge to the Lessor including any premium taxes and fees due to state governing bodies. There are no other fees, cost or charge added to or included within this total cost.",
              "If loss or damage to Lessor's property exceeds the amount of Required Insurance, Lessee shall remain contractually liable to Lessor for such amount. In the event of liability to any other party for bodily injury or property damage, Lessee shall remain liable to such other party.",
              "It shall be the Lessee's duty to notify Lessor of any subsequent purchase of Renters Insurance.",
            ],
            true,
          ),
          p("Scheduling of the premises under the LLIP is not mandatory. Lessee may purchase Required Insurance from an insurance agent or insurance company of Lessee's choice at any time, and coverage under the LLIP will then be terminated by the Lessor."),
        ],
        changes: [
          ch("F65", "Outside the saved statute (insurance placement)", "attorney", "Kept as written: LLIP placement \"without notice\", and the cost called a \"recoverable expense\" here but \"Additional Rent\" elsewhere. Attorney to confirm and pick one label. LLIP cost is now a setting; shown only when the property offers LLIP.", "Lessor may purchase Lessor Insurance without notice and add the total cost associated therewith to Lessee's monthly rent payment."),
          ch("F67", "n/a", "cleanup", "The \"Scheduling of the premises under the LLIP is not mandatory\" paragraph moved here from §10.1, where it was misplaced.", "10.1 ... Scheduling of the premises under the LLIP is not mandatory"),
        ],
      },
    ],
  },

  // ───────────────────────────── 10 Security Deposit Alternative ─────────────────────────────
  {
    id: "deposit-alternative",
    number: "10",
    title: "Security Deposit Alternative Addendum",
    when: ["deposit_alternative_offered"],
    standalone: true,
    initials: true,
    clauses: [
      {
        id: "sda-definitions",
        number: "10.1",
        title: "Security Deposit Alternative",
        blocks: [
          p("As used in this Addendum: \"Lease\" may be interchangeable with \"Lease Agreement\"; \"Lessee\" may be interchangeable with \"Resident\" or \"Tenant\"; and \"Lessor\" may be interchangeable with \"Landlord\" or \"Owner\"."),
        ],
        changes: [ch("F67", "n/a", "cleanup", "LLIP paragraph removed from this clause and moved to Section 9.")],
      },
      {
        id: "sda-offer",
        number: "10.2",
        title: "Security Deposit Alternative",
        blocks: [
          p("We offer residents the option to opt into a Security Deposit Alternative, which reduces the traditional security deposit by at least {{sda_reduction_percent}}%. This option is offered to all new residents of {{property_name}}. Choosing it or not does not affect whether your application is approved."),
        ],
        changes: [
          ch("F66", "Fla. Stat. 83.491(7)", "disclosure", "\"If you are eligible\" replaced with an offer to all new residents of the property, and a statement that the choice is not used in approving applications (required if this program is a fee in lieu under 83.491).", "If you are eligible, this option will be made available to you upon first login to your Resident Portal."),
        ],
      },
      {
        id: "sda-terms",
        number: "10.3",
        title: "Terms and Conditions",
        blocks: [
          list(
            [
              "Program Fee: Residents who choose the Security Deposit Alternative pay a program fee of ${{sda_fee}}, non-refundable, due with move-in funds.",
              "Coverage Provider: The Security Deposit Alternative is provided through {{sda_provider}}. Details of this coverage will be presented to you when you first log in to your resident portal. We strongly encourage you to carefully review all terms and conditions provided by {{sda_provider}}.",
              "Deadline for Opting In: To use the Security Deposit Alternative, you must submit your application on or before {{lease_start_date}}.",
            ],
            true,
          ),
        ],
        changes: [
          ch("F67", "n/a", "attorney", "The $20 fee was described as both a non-refundable fee and \"applied to your first month's rent\". Now one clear statement: non-refundable program fee due with move-in funds. Amount and provider are settings.", "This fee will be charged as additional rent and applied to your first month's rent."),
        ],
      },
      {
        id: "sda-adjustment",
        number: "10.4",
        title: "Security Deposit Adjustment",
        blocks: [
          p("If you opt for the Security Deposit Alternative, your cash security deposit is reduced to ${{reduced_deposit}}. The reduced deposit is a security deposit held and returned as described in Section 1.4 and s. 83.49, Florida Statutes."),
        ],
        changes: [
          ch("F67", "n/a", "cleanup", "Literal label \"Obligo Option - Enter the deposit amount x 25.\" replaced with the computed reduced deposit.", "Obligo Option - Enter the deposit amount x 25."),
          ch("F66", "Fla. Stat. 83.49", "disclosure", "The cash portion is a security deposit, so it follows the 83.49 hold, return and claim process instead of \"refundable, provided no charges have been made\".", "This portion is refundable, provided no charges have been made upon move-out."),
        ],
      },
      {
        id: "sda-charges",
        number: "10.5",
        title: "Charges and Refunds",
        blocks: [
          list(
            [
              "Use of the Reduced Deposit: If charges are incurred at move-out, they are first claimed against your reduced deposit under Section 1.4 before {{sda_provider}} coverage applies.",
              "{{sda_provider}} Coverage: Any charges beyond your reduced deposit will be handled through {{sda_provider}}. Installment options will be made available to you through {{sda_provider}}.",
            ],
            true,
          ),
        ],
        changes: [ch("F66", "Fla. Stat. 83.49(3)", "cleanup", "\"Refundable portion\" renamed \"reduced deposit\" and tied to the Section 1.4 claim process.", "your refundable portion will be utilized before the Obligo coverage starts")],
      },
      {
        id: "sda-fee-in-lieu",
        number: "10.6",
        title: "Fee in Lieu of Security Deposit Notice",
        blocks: [
          p("If this program is a fee in lieu of a security deposit under s. 83.491, Florida Statutes, Landlord notifies you that:"),
          list([
            "You may pay a security deposit instead of the fee at any time.",
            "You may, at any time, end the fee agreement and instead pay the security deposit of {{security_deposit}} stated in the Lease. Doing so will not hurt your credit if the deposit is paid on time.",
            "You may choose to pay the security deposit in monthly installments in an amount agreed with Landlord while in the fee program: {{sda_installment_terms}}.",
            "Additional charges for these options: {{sda_additional_charges}}.",
            "Amounts for each option: program fee ${{sda_fee}} plus reduced deposit ${{reduced_deposit}}; or full security deposit {{security_deposit}}.",
            "The fee is nonrefundable.",
            "The fee is only for securing occupancy without paying the full required security deposit.",
            "The fee does not limit or change your obligation to pay rent and fees under the Lease, or to pay the cost of repairing damage to the Premises beyond normal wear and tear.",
            "If Landlord uses any part of the fee to buy insurance, you are not insured and are not a beneficiary of that insurance, and the insurance does not change your obligation to pay rent and fees or the cost of repairing damage beyond normal wear and tear.",
            "The fee amount will not increase during the term of the Lease.",
          ]),
          law("FEE IN LIEU OF SECURITY DEPOSIT", "Fla. Stat. 83.491(4)(b)"),
          law("THIS FEE IS NOT A SECURITY DEPOSIT AND PAYMENT OF THE FEE DOES NOT ABSOLVE THE TENANT OF ANY OBLIGATIONS UNDER THE RENTAL AGREEMENT, INCLUDING THE OBLIGATION TO PAY RENT AS IT BECOMES DUE AND ANY COSTS AND DAMAGES BEYOND NORMAL WEAR AND TEAR WHICH THE TENANT OR HIS OR HER GUESTS MAY CAUSE.", "Fla. Stat. 83.491(4)(b)"),
          law("THE TENANT MAY TERMINATE THIS AGREEMENT AT ANY TIME AND STOP PAYING THE FEE AND INSTEAD PAY THE SECURITY DEPOSIT AS PROVIDED IN SECTION 83.491, FLORIDA STATUTES.", "Fla. Stat. 83.491(4)(b)"),
          law("THIS AGREEMENT HAS BEEN ENTERED INTO VOLUNTARILY BY BOTH PARTIES AND THE TENANT AGREES TO PAY THE LANDLORD A FEE IN LIEU OF A SECURITY DEPOSIT AS AUTHORIZED UNDER SECTION 83.491, FLORIDA STATUTES. IF THE LANDLORD USES ANY PORTION OF THE TENANT’S FEE TO PURCHASE INSURANCE, THE TENANT IS NOT INSURED AND IS NOT A BENEFICIARY OF SUCH COVERAGE, AND THE INSURANCE DOES NOT CHANGE THE TENANT’S FINANCIAL OBLIGATIONS UNDER THE RENTAL AGREEMENT.", "Fla. Stat. 83.491(4)(b)"),
          law("THIS DISCLOSURE IS BASIC. PLEASE REFER TO PART II OF CHAPTER 83, FLORIDA STATUTES, TO DETERMINE YOUR LEGAL RIGHTS AND OBLIGATIONS.", "Fla. Stat. 83.491(4)(b)"),
        ],
        changes: [
          ch("F66", "Fla. Stat. 83.491(3), 83.491(4)", "disclosure", "Added the 83.491(3) written notice items and the 83.491(4)(b) capital-letter disclosure word for word, and made this addendum separately signed by tenant and landlord's agent (83.491(4)(a)). Attorney must first decide whether the Obligo program is a fee in lieu under 83.491; if not, remove this clause and use the Obligo contract the attorney approves."),
        ],
      },
      {
        id: "sda-election",
        blocks: [
          {
            kind: "choice",
            id: "sda_choice",
            prompt: "Mark one:",
            setBy: "tenant",
            field: "sda_choice",
            options: [
              { id: "opt_in", text: "I choose the Security Deposit Alternative (program fee ${{sda_fee}}; reduced deposit ${{reduced_deposit}})." },
              { id: "opt_out", text: "I will pay the full security deposit of {{security_deposit}}." },
            ],
          },
          { kind: "initials", parties: ["tenants"], label: "Resident initials next to the chosen option" },
          { kind: "signatures", parties: ["tenants", "agent"], label: "Resident(s) and Landlord ({{landlord_name}}, by {{agent_name}}, its authorized agent)" },
        ],
        changes: [
          ch("F67", "n/a", "cleanup", "Duplicated \"By signing below / By initialing below\" lines replaced with one opt-in choice, initials and signatures.", "By signing below, you acknowledge ... By initialing below, you acknowledge ... By initialing below"),
        ],
      },
    ],
  },

  // ───────────────────────────── 11 Welcome Letter ─────────────────────────────
  {
    id: "welcome-letter",
    number: "11",
    title: "Welcome Letter",
    initials: true,
    clauses: [
      {
        id: "welcome",
        number: "11.1",
        title: "Welcome Letter",
        blocks: [
          p("Applicant(s): {{tenant_names}}"),
          p("Move-In Date: {{lease_start_date}}"),
          p("Lease Term: {{lease_term_months}} months, from {{lease_start_date}} to {{lease_end_date}}"),
          p("Monthly Rental Charges: {{monthly_charges}}"),
          p("Address: {{unit_address}}"),
          p("The application fee is used to screen applicant(s) with regard to credit history and other background information. A criminal background check will also be performed as part of this process. Application fees are non-refundable."),
          p("Application Fee Due: ${{application_fee}}"),
          p("Admin Fee Due: ${{admin_fee}}"),
          p("Deposit Due: Security Deposit (refundable as described in Section 1.4): {{security_deposit}}"),
        ],
        changes: [
          ch("F68", "n/a", "cleanup", "Literal labels \"For Welcome Letter: Application Fee Amount\" and \"For Welcome Letter:Admin Fee Amount\" replaced with fee settings.", "Application Fee Due: For Welcome Letter: Application Fee Amount"),
        ],
      },
      {
        id: "welcome-sda",
        when: ["deposit_alternative_offered"],
        blocks: [p("If the Security Deposit Alternative is selected: reduced deposit ${{reduced_deposit}} plus program fee ${{sda_fee}}.")],
        changes: [ch("F67", "n/a", "cleanup", "Literal label \"Obligo Option - Enter the deposit amount x 25.\" replaced with the computed reduced deposit.", "If Obligo is selected Obligo Option - Enter the deposit amount x 25.")],
      },
      {
        id: "welcome-funds",
        blocks: [
          p("Date Due: within {{move_in_funds_due_hours}} hours of {{lease_start_date}}."),
          p("Move-In Funds are payable in CERTIFIED FUNDS ONLY (money orders or cashier's checks)."),
          p("Make payable to: {{landlord_name}}"),
          p("**Utility Providers**"),
          list(
            [
              "Electric: {{electric_provider}}, phone {{electric_phone}}",
              "Water / Sewer / Trash: {{water_sewer_trash}}",
              "Renter's Insurance: (${{required_liability_limit}} minimum in liability). Please add additional interest of \"{{insurance_interested_party}}\". We must have the declarations page before move-in.",
              "Cable: {{cable_provider}}, phone {{cable_phone}}",
              "Phone/DSL: {{phone_provider}}, phone {{phone_provider_phone}}",
            ],
            true,
          ),
          p("**Balance Due by Move-In**"),
          list([
            "Next Month Rent: {{next_month_rent}}",
            "Next Month Utility Charges: {{next_month_utilities}}",
            "Prorated Charges: {{prorated_charges}}",
          ]),
        ],
        changes: [
          ch("F68", "n/a", "cleanup", "Literal labels \"Funds Payable to (Enter owner entity name)\", \"For Welcome Letter:Water|Sewer|Trash (flat fee or provider\", \"Next Months Rent amount If applicable\" and \"Next Months Utility If applicable\" replaced with fields. Funds are payable to the owner LLC. Utility contacts are per-property settings; the duplicated utility list was merged.", "Make payable to:Funds Payable to (Enter owner entity name)"),
          ch("F17", "Outside the saved statute (insurance)", "attorney", "Interested-party name and liability minimum are now settings. This \"additional interest\" wording conflicts with the §1.6 \"additional insured\" wording until the owner picks one model.", "Please add additional interest of \"SIM REI Property Management, LLC\""),
        ],
      },
      {
        id: "welcome-llip",
        when: ["llip_offered"],
        blocks: [list(["Next Month LLIP: {{next_month_llip}}"])],
        changes: [ch("F68", "n/a", "cleanup", "Literal label \"Next Month LLIP\" replaced with the computed amount; shown only when LLIP is offered.", "Next Month LLIP:Next Month LLIP")],
      },
      {
        id: "welcome-sda-balance",
        when: ["deposit_alternative_offered"],
        blocks: [list(["With the Security Deposit Alternative selected: program fee ${{sda_fee}} + reduced deposit ${{reduced_deposit}}"])],
        changes: [ch("F67", "n/a", "cleanup", "\"*With Obligo Selected: $20 + Obligo Option - Enter the deposit amount x 25.\" replaced with fields.", "*With Obligo Selected: $20 + Obligo Option - Enter the deposit amount x 25.")],
      },
      {
        id: "welcome-total",
        blocks: [
          p("Total Charges Due at Move-In: {{total_move_in}}"),
          p("All of the above items, as well as a lease signed by all leaseholders, are required on or before your move-in date in order to receive keys."),
        ],
      },
    ],
  },

  // ───────────────────────────── 12 Sign and Accept ─────────────────────────────
  {
    id: "sign",
    number: "12",
    title: "Sign and Accept",
    clauses: [
      {
        id: "acceptance",
        number: "12.1",
        title: "Acceptance of Lease",
        blocks: [
          p("This is a legally binding document. By typing your name, you are consenting to use electronic means to (i) sign this contract and (ii) accept the lease agreement and addenda. You will receive a printed contract for your records."),
          { kind: "signatures", parties: ["tenants"], label: "Lessee(s)" },
        ],
        changes: [ch("F52", "Outside the saved statute (ch. 668, e-signatures)", "attorney", "E-signature consent kept as written; it is separate from e-mail delivery of ch. 83 notices. Attorney to confirm under ch. 668.")],
      },
      {
        id: "guarantor-signatures",
        when: ["has_guarantor"],
        blocks: [{ kind: "signatures", parties: ["guarantors"], label: "Guarantor(s)" }],
        changes: [ch("N/A", "n/a", "attorney", "New guarantor signature block, shown only when a lease has a guarantor. The original lease has no guaranty terms: attorney to supply them.")],
      },
      {
        id: "landlord-signature",
        blocks: [{ kind: "signatures", parties: ["agent"], label: "Landlord: {{landlord_name}}, by {{agent_name}}, its authorized agent" }],
        changes: [
          ch("F1", "Fla. Stat. 83.50", "disclosure", "Signature block now names the owner LLC as Landlord, signed by SIM REI as its authorized agent, with printed name and date.", "X Lessor Date Signed"),
        ],
      },
    ],
  },

  // ───────────────────────────── 13 Electronic Notice Addendum (new) ─────────────────────────────
  {
    id: "email-notice-addendum",
    number: "13",
    title: "Electronic Notice Addendum",
    when: ["email_notices"],
    standalone: true,
    clauses: [
      {
        id: "email-addendum-intro",
        number: "13.1",
        title: "Electronic Delivery of Notices (s. 83.505, Florida Statutes)",
        blocks: [
          p("This Addendum to the Lease for {{unit_address}} is between {{landlord_name}}, by its agent {{agent_name}}, and {{tenant_names}}. It is signed separately from the Lease. **The election to receive notices by e-mail is voluntary. Either party may revoke it or update its e-mail address at any time.**"),
        ],
        changes: [
          ch("F52", "Fla. Stat. 83.505(1)", "must", "New separately signed addendum using the 83.505(1) form word for word, with each party's election and e-mail address. Without it, ch. 83 notices (3-day, 7-day, deposit claims, 83.575 notices) cannot be sent by e-mail. App: store each party's election, address and any revocation, and keep a copy of every e-mailed notice and proof of transmission (83.505(5)). Each adult tenant should make their own election.", "Resident agrees to receive notices, documents, and communications related to this lease electronically"),
        ],
      },
      {
        id: "landlord-election",
        title: "Landlord election",
        blocks: [
          law("Notices from a tenant may contain time-sensitive information about the tenant’s housing. The election to receive notices from the tenant by e-mail is voluntary.", "Fla. Stat. 83.505(1)"),
          {
            kind: "choice",
            id: "landlord_email_election",
            setBy: "landlord",
            field: "landlord_email_election",
            options: [
              { id: "agree", text: "I {{agent_signer_name}}, the landlord or the landlord’s agent, agree to receive notices required by the rental agreement or under part II of chapter 83, Florida Statutes, from the tenant by e-mail. I designate the following e-mail address for receipt of notices from the tenant: {{agent_notice_email}}." },
              { id: "decline", text: "I do not agree to receive notices by e-mail." },
            ],
          },
          law("I may revoke my agreement to receive notices by e-mail by providing written notice to the tenant which is effective upon delivery of such written notice and does not affect the validity of any notice that was previously sent by e-mail.", "Fla. Stat. 83.505(1)"),
          law("I may update my e-mail address designated for electronic delivery at any time by providing written notice to the tenant specifying the new e-mail address, which takes effect upon delivery of such notice.", "Fla. Stat. 83.505(1)"),
        ],
      },
      {
        id: "tenant-election",
        title: "Tenant election",
        blocks: [
          law("Notices from a landlord may contain time-sensitive information about a tenant’s housing. The election to receive notices from the landlord by e-mail is voluntary.", "Fla. Stat. 83.505(1)"),
          {
            kind: "choice",
            id: "tenant_email_election",
            setBy: "tenant",
            field: "tenant_email_election",
            options: [
              { id: "agree", text: "I {{tenant_names}}, the tenant, agree to receive notices required by the rental agreement or under part II of chapter 83, Florida Statutes, from the landlord by e-mail. I designate the following e-mail address for receipt of notices from the landlord: {{tenant_notice_email}}." },
              { id: "decline", text: "I do not agree to receive notices by e-mail." },
            ],
          },
          { kind: "initials", parties: ["tenants"], label: "Tenant initials next to the chosen option" },
          law("I may revoke my agreement to receive notices by e-mail by providing written notice to the landlord which is effective upon delivery of such written notice and does not affect the validity of any notice that was previously sent by e-mail.", "Fla. Stat. 83.505(1)"),
          law("I may update my e-mail address designated for electronic delivery at any time by providing written notice to the landlord specifying the new e-mail address, which takes effect upon delivery of such notice.", "Fla. Stat. 83.505(1)"),
          { kind: "signatures", parties: ["tenants", "agent"], label: "Tenant(s) and Landlord ({{landlord_name}}, by {{agent_name}}, its authorized agent)" },
        ],
      },
    ],
  },
];

const money = (label: string, example: string): TemplateField => f(label, "setting", example);

const fields: Record<string, TemplateField> = {
  // Parties and property
  tenant_names: f("Tenants (financially responsible)", "lease", "Jordan Sample and Casey Sample"),
  other_occupants: f("Other (non-adult) occupants", "lease", "Riley Sample (age 7)"),
  landlord_name: f("Landlord: owner's legal name (owning LLC)", "property", "Sample Holdings LLC"),
  agent_name: f("Agent (management company) legal name", "company", "SIM REI Property Management LLC"),
  agent_address: f("Agent address for notices and demands (83.50)", "company", "432 N Eustis St, Eustis, FL 32726"),
  agent_signer_name: f("Name of the person signing for the agent", "lease", "Wesley Owen"),
  agent_notice_email: f("Landlord/agent e-mail designated for tenant notices (83.505)", "setting", "notices@example.com"),
  tenant_notice_email: f("Tenant e-mail designated for landlord notices (83.505)", "lease", "tenant@example.com"),
  landlord_email_election: f("Landlord e-mail notice election (agree / decline)", "setting", "agree"),
  tenant_email_election: f("Tenant e-mail notice election (agree / decline)", "lease", "agree"),
  unit_address: f("Unit address", "unit", "123 Sample St, Eustis, FL 32726"),
  property_name: f("Property name", "property", "Sample Property"),
  guest_stay_days: f("Days a guest may stay before Landlord approval", "setting", "7"),

  // Term
  lease_start_date: f("Lease start date", "lease", "January 1, 2027"),
  lease_end_date: f("Lease end date", "lease", "December 31, 2027"),
  lease_term_months: f("Lease term (months)", "computed", "12"),
  long_term_increase_percent: f("Yearly rent increase for leases over 12 months (%)", "setting", "3"),
  year_two_rent: f("Monthly rent for months 13 to 24", "computed", "$1,390.50"),
  mtm_rent_increase: money("Month-to-month rent increase per month", "150.00"),
  mtm_notice_days: f("Month-to-month termination notice (days before end of a monthly period)", "setting", "30", "Fla. Stat. 83.57(3)"),

  // Rent
  monthly_charges: f("Monthly charges (itemized)", "lease", "Rent $1,500.00"),
  prorated_rent: f("Prorated rent", "computed", "$500.00"),
  prorate_after_day: f("Move-in day after which next month's rent is also due", "setting", "19th"),
  rent_due_day: f("Rent due day", "setting", "1st"),
  rent_late_after_day: f("Rent is late after this day", "setting", "3rd"),
  late_fee_rule: f("Late fee rule", "setting", "$50.00 on the 4th"),
  daily_late_fee_start_day: f("Daily late fee starts after this day", "setting", "4th"),
  daily_late_fee: f("Daily late fee", "setting", "$0.00"),
  nsf_fee: money("Returned payment (NSF) fee (attorney to confirm legal cap)", "50.00"),

  // Deposit
  security_deposit: f("Security deposit", "lease", "$1,500.00"),
  deposit_return_days: f("Days to return deposit when no claim", "setting", "15", "Fla. Stat. 83.49(3)(a)"),
  deposit_claim_notice_days: f("Days to send notice of claim on deposit", "setting", "30", "Fla. Stat. 83.49(3)(a)"),
  deposit_objection_days: f("Days tenant has to object to a deposit claim", "setting", "15", "Fla. Stat. 83.49(3)(a)"),
  deposit_account_type: f("How deposits are held (non_interest / interest / surety_bond), per owner", "property", "non_interest"),
  deposit_bank_name: f("Deposit bank name (Florida financial institution), per owner", "property", "Sample Bank"),
  deposit_bank_address: f("Deposit bank street address, per owner", "property", "100 Sample Ave, Eustis, FL 32726"),
  deposit_interest: f("Tenant entitled to interest? (not_entitled / entitled), per owner", "property", "not_entitled"),
  deposit_interest_terms: f("Interest terms if entitled (83.49(1)(b)-(c))", "property", "5 percent per year, simple interest"),

  // Utilities, insurance, keys
  utilities_included: f("Utilities paid by Landlord", "lease", "None"),
  required_liability_limit: money("Required renter's liability coverage", "100,000"),
  keys_list: f("Keys provided", "unit", "Front door"),
  lockout_fee: money("Lockout service charge", "125.00"),

  // Parking
  vehicles_per_leaseholder: f("Vehicles allowed per leaseholder", "setting", "One"),
  stored_vehicle_days: f("Days unmoved before a vehicle is a Stored Vehicle", "setting", "14"),
  vehicle_cover_days: f("Days under a cover before a vehicle is a Stored Vehicle", "setting", "7"),
  vehicle_repair_hours: f("Hours of on-site repair before a vehicle is a Stored Vehicle", "setting", "48"),
  expired_registration_days: f("Days of expired registration for an Abandoned Vehicle", "setting", "30"),
  vehicle_notice_days: f("Days after written notice to remove a vehicle", "setting", "5"),

  // Notices fixed by law
  cure_notice_days: f("Notice to cure / noncompliance period (days)", "setting", "7", "Fla. Stat. 83.56(2)"),
  pay_notice_days: f("Notice to pay rent or deliver possession (days, excluding weekends and legal holidays)", "setting", "3", "Fla. Stat. 83.56(3)"),
  military_notice_days: f("Servicemember termination notice (days after landlord receives it)", "setting", "30", "Fla. Stat. 83.682(1)"),
  entry_notice_hours: f("Entry notice for repairs (hours)", "setting", "24", "Fla. Stat. 83.53(2)"),
  entry_start_time: f("Earliest entry time for repairs", "setting", "7:30 a.m.", "Fla. Stat. 83.53(2)"),
  entry_end_time: f("Latest entry time for repairs", "setting", "8:00 p.m.", "Fla. Stat. 83.53(2)"),

  // Maintenance
  ac_filter_interval: f("AC filter replacement interval", "setting", "monthly"),
  water_filter_months: f("Water filter replacement (months)", "setting", "6"),
  repair_deductible_applies: f("Resident repair deductible applies? (responsible / not_responsible)", "lease", "responsible"),
  repair_deductible: money("Resident repair deductible per incident", "150.00"),
  pest_control_start_days: f("Resident pest control starts (days after move-in)", "setting", "30"),
  pest_control_interval_days: f("Maximum days between resident pest treatments", "setting", "90"),
  irrigation_days_per_week: f("Minimum irrigation / watering days per week", "setting", "2"),
  lawn_care_by_resident: f("Lawn maintenance assigned to resident? (responsible / not_responsible)", "lease", "responsible"),
  mow_winter_per_month: f("Minimum lawn services per month, November-March", "setting", "2"),
  mow_summer_per_month: f("Minimum lawn services per month, April-October", "setting", "4"),
  report_within_hours: f("Report damage within (hours)", "setting", "24"),
  exterior_maintenance_frequency: f("Pressure washing and gutter cleaning frequency", "setting", "once per lease term (minimum once annually)"),
  inspection_fee: money("Fee for in-person inspection after missed self-inspection", "75.00"),

  // Move out
  end_of_term_notice_days: f("End-of-term notice days, both parties (30-60, 83.575(1))", "setting", "60"),
  end_of_term_ld_amount: f("Liquidated damages for vacating without end-of-term notice (SIM REI: one month's rent)", "computed", "1,500.00"),
  ld_prenotice_days: f("Landlord pre-notice window before the notice period starts (days)", "setting", "15", "Fla. Stat. 83.575(2)"),

  // Move-out charge schedule (ranges in dollars)
  charge_general_cleaning: money("Move-out charge: general cleaning", "150 – 300"),
  charge_deep_cleaning: money("Move-out charge: deep cleaning", "300 – 600"),
  charge_carpet_cleaning: money("Move-out charge: carpet cleaning", "125 – 250"),
  charge_carpet_replacement: money("Move-out charge: carpet replacement", "800 – 2,500"),
  charge_flooring_damage: money("Move-out charge: flooring damage", "300 – 2,000"),
  charge_wall_repair: money("Move-out charge: wall repair", "75 – 300"),
  charge_painting_room: money("Move-out charge: painting per room", "150 – 400"),
  charge_full_repaint: money("Move-out charge: full unit repaint", "800 – 2,000"),
  charge_appliance_cleaning: money("Move-out charge: appliance cleaning", "50 – 150 each"),
  charge_appliance_repair: money("Move-out charge: appliance repair", "150 – 600"),
  charge_appliance_replacement: money("Move-out charge: appliance replacement", "500 – 1,500"),
  charge_cabinet_repair: money("Move-out charge: cabinet / countertop repair", "150 – 800"),
  charge_plumbing_repair: money("Move-out charge: plumbing repair", "150 – 500"),
  charge_fixture_replacement: money("Move-out charge: fixture replacement", "75 – 300 each"),
  charge_doors_windows: money("Move-out charge: doors / windows repair", "150 – 600"),
  charge_blinds: money("Move-out charge: blind replacement", "50 – 150 each"),
  charge_trash_removal: money("Move-out charge: trash removal", "100 – 500"),
  charge_bulk_hauling: money("Move-out charge: bulk hauling", "200 – 800"),
  charge_odor_remediation: money("Move-out charge: odor remediation", "200 – 1,000"),
  charge_pet_damage: money("Move-out charge: pet damage", "200 – 1,500"),
  charge_pest_treatment: money("Move-out charge: pest treatment", "150 – 400"),
  charge_yard_maintenance: money("Move-out charge: yard maintenance", "100 – 500"),
  charge_unauthorized_alterations: money("Move-out charge: unauthorized alterations", "200 – 1,500"),
  charge_key_replacement: money("Move-out charge: key / fob replacement", "25 – 100 each"),
  charge_rekey: money("Move-out charge: lock change / rekey", "75 – 200"),
  charge_utility_processing: money("Move-out charge: utility charge processing", "50 – 150"),
  charge_admin_fee: money("Move-out charge: administrative fee (attorney to confirm)", "100 – 250"),

  // Bed bugs
  bed_bug_inspection_days: f("Days after signing for optional resident bed bug inspection", "setting", "3"),
  bed_bug_followup_days: f("Days after first treatment for follow-up treatment", "setting", "7"),
  bed_bug_final_inspection_days: f("Days after follow-up for final inspection", "setting", "30"),
  bed_bug_vacate_notice_days: f("Written notice before tenant must vacate for extermination (days)", "setting", "7", "Fla. Stat. 83.51(2)(a)1"),
  bed_bug_max_vacate_days: f("Maximum days tenant must vacate for extermination", "setting", "4", "Fla. Stat. 83.51(2)(a)1"),

  // Liquidated damages addendum
  ld_choice: f("Tenant's liquidated damages choice (agree / decline)", "lease", "agree"),
  ld_amount: f("Liquidated damages / early termination fee (default 2x monthly rent; may not exceed 2 months' rent, 83.595(4))", "computed", "3,000.00"),
  etf_notice_days: f("Early termination notice days (60 or less, 83.595(4))", "setting", "60"),

  // Pets
  pet_information: f("Pet description", "lease", "Dog, Labrador, 50 lb, \"Max\""),
  pet_rent: money("Pet rent per pet per month", "25.00"),
  pet_fee: money("Non-refundable pet fee per pet", "350.00"),
  pet_offspring_weeks: f("Weeks to rehome unintended offspring", "setting", "8"),
  pet_removal_days: f("Days to remove pet after permission is revoked", "setting", "7"),

  // LLIP
  llip_monthly: money("LLIP monthly cost", "10.50"),

  // Security deposit alternative
  sda_provider: f("Security deposit alternative provider", "setting", "Obligo"),
  sda_fee: money("Security deposit alternative program fee (non-refundable)", "20.00"),
  sda_reduction_percent: f("Minimum deposit reduction under the alternative (%)", "setting", "75"),
  reduced_deposit: f("Reduced cash deposit (deposit x 25%)", "computed", "375.00"),
  sda_installment_terms: f("Deposit installment terms, if agreed (83.491(3)(c))", "lease", "Not offered"),
  sda_additional_charges: f("Additional charges for paying a deposit instead (83.491(3)(d))", "setting", "None"),
  sda_choice: f("Tenant's security deposit alternative choice (opt_in / opt_out)", "lease", "opt_out"),

  // Welcome letter
  application_fee: money("Application fee (per adult)", "75.00"),
  admin_fee: money("Admin fee", "85.00"),
  move_in_funds_due_hours: f("Move-in funds due within (hours of move-in date)", "setting", "48"),
  electric_provider: f("Electric provider", "property", "Duke Energy"),
  electric_phone: f("Electric provider phone", "property", "(800) 700-8744"),
  water_sewer_trash: f("Water / sewer / trash (flat fee or provider)", "property", "City utility billing (sample)"),
  cable_provider: f("Cable provider", "property", "Comcast"),
  cable_phone: f("Cable provider phone", "property", "800-COMCAST"),
  phone_provider: f("Phone/DSL provider", "property", "CenturyLink"),
  phone_provider_phone: f("Phone/DSL provider phone", "property", "877-862-9343"),
  insurance_interested_party: f("Name to list as additional interest on renter's insurance", "setting", "SIM REI Property Management, LLC"),
  next_month_rent: f("Next month's rent, if applicable", "computed", "$1,500.00"),
  next_month_utilities: f("Next month's utility charges, if applicable", "computed", "$0.00"),
  next_month_llip: f("Next month's LLIP charge", "computed", "$10.50"),
  prorated_charges: f("Prorated charges", "computed", "$500.00"),
  total_move_in: f("Total charges due at move-in", "computed", "$3,510.50"),
};

export const RESIDENTIAL_LEASE: DocumentTemplate = {
  id: "residential-lease",
  title: "Residential Lease",
  version: "2026-11 draft 1 (attorney review pending)",
  appliesTo: "Residential (Fla. Stat. ch. 83 Part II)",
  sections,
  fields,
};

