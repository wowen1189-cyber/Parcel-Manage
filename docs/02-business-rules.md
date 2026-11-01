# 02 — Business rules (company settings, SIM REI defaults)

Every rule here is a **company setting**. Build a Settings › Business rules screen to edit them. Seed SIM REI with these values. Where law requires something, it is marked **(law)** and is not optional.

## Company profile (SIM REI)
- Company: SIM REI Property Management · 432 N Eustis St, Eustis, FL 32726 · time zone America/New_York · county default: Lake
- Office phone shown to tenants: **(352) 715-6203** (from simreipm.com). Office hours Mon–Fri 9–5.
- Escalation contact for the AI leasing agent: Wesley Owen, mobile (352) 434-9441. Showings run by Wesley Owen on Google Calendar.
- Team titles: Wesley Owen — Broker | Owner; Nikki Boswell — Office Administrator. Titles are editable per user.

## Rental criteria (applied identically to every applicant)
| Rule | SIM REI value |
|---|---|
| Income | Household gross income at least **2.5× monthly rent** — hard minimum. A higher deposit does not make up for income. |
| Credit score | **No minimum score.** |
| Debts ignored | Credit cards, medical bills and student loans are **not held against** the applicant. |
| Debts that matter | Late or unpaid **utilities** or **car payments** → escalate for case-by-case review (not automatic decline). |
| Evictions | None in the last **5 years** → otherwise decline. |
| Landlord balance | No money owed to a past landlord → otherwise decline. |
| Criminal history | **Case-by-case review** by the escalation contact; no automatic denials (HUD guidance warns against blanket bans). |
| Security deposit | Credit **620+**: 1 month's rent. **Under 620**: 1.5×–2× month's rent, set from credit and rental history (AI suggests, a person confirms). The agent quotes the range, never a final number. |
| Application fees | **$75 per adult** application fee + **$85 admin fee**, both paid by card at submission. **Admin fee refunded if denied.** |
| Who pays for screening | **SIM REI pays** the screening company (decided Nov 1, 2026); the application fee covers it. Target: credit + criminal + eviction + ID check for no more than AppFolio's $30 per adult. Checkr Tenant is $34.99 retail + $1.50 Stripe Identity, so negotiate a partner rate (Checkr, TransUnion ShareAble for Rentals) before switching. Applicants are SIM REI's own customers of the screening company relationship (no reselling reports). See docs/reference/screening-and-insurance-2026-11.md. |
| Lease term | **7–14 months.** Terms under 12 months add **$50/month** to rent. |
| Application type | From the unit type (residential vs commercial), never chosen by the applicant. |

**Decision outcomes** (screening results arrive by API):
1. Approve — 620+, income ≥ 2.5×, no eviction in 5 yrs, no landlord balance, no utility/car-payment problems → 1-month deposit; lease goes to e-sign.
2. Approve with higher deposit — under 620, everything else passes → 1.5×–2× (person confirms). **Adverse action notice required (law, FCRA).**
3. Escalate for review — utility or car-payment problems, or anything on the criminal report → person decides.
4. Decline — income under 2.5×, eviction in 5 yrs, or landlord balance → person reviews, then adverse action notice **(law)** and $85 admin fee refunded.

## Pets
- Allowed: up to **2 pets**; **$350 one-time pet fee** + **$25/month per pet**.
- Restricted breeds (and mixes): Pit Bull, Doberman Pinscher, Rottweiler, Great Dane, Presa Canario, Chow Chow, German Shepherd, Alaskan Malamute, Akita, Cane Corso, Bull Mastiff, Wolf Hybrid. (Source: RentPrep's commonly restricted list. Company should confirm against its landlord insurance exclusions.)
- **Assistance animals are not pets (law):** no pet fees, deposits, limits or breed restrictions; accommodation requests escalate to a person.

## AI leasing agent
- Channels: email (listing leads + direct), two-way SMS, website chat. Phone stays with the company's phone system (SIM REI: Weblo).
- Mode: reply automatically 24/7; escalate by **text** to the escalation contact with a link to the thread.
- Always escalate: rent/fee negotiation, complaints, accommodation/assistance animals, fair housing questions, legal or lease-term questions, background history questions, asks for a person, upset or urgent.
- Fair housing guardrails: same answers and criteria for everyone; never describe neighborhoods by who lives there; never steer to or away from units.
- Showings: weekdays **10:00 AM–6:00 PM**, **30-minute** slots, **15-minute** buffer, only around existing calendar events; collect name, phone, move-in date and number of occupants before booking; confirmation text immediately, reminder 1 hour before, one no-show follow-up.
- AI provider: company's own key; monthly spend limit (SIM REI default $100); agent off until connection test passes.
- Texting requires prior opt-in; STOP opts out **(law, TCPA/carrier rules)**.

## Maintenance priority and emergencies
- Priority comes from triage answers (`docs/03-maintenance-triage.json`), never from the tenant choosing "emergency".
- **AC is an emergency** when the inside temperature is **above 80°F** (summer) **or** young children or elderly people live in the home. This applies whether the AC is blowing warm air or won't turn on at all. Otherwise AC outage is Urgent.
- Other emergency rules are in the triage file (active leaks that can't be stopped, water near electrical, sewage backup, smoke/fire, hot or sparking electrical, door that can't be locked, no heat below 55°F, toilet overflow that the valve doesn't stop, water heater flood).
- Gas smell and active smoke/fire: two buttons, "I smell gas" and "I see smoke, fire or sparks", are always on the first screen of a request. They show safety steps (leave, call 911) immediately and create an Emergency work order with **no questions, no required photos and no false-emergency charge acknowledgment** (never discourage reporting danger).
- **False-emergency charge:** for other emergencies, the tenant must acknowledge before submitting: "My answers are accurate. If this turns out not to be an emergency, I agree to pay the vendor's emergency charge plus a **$100** fee." Store the acknowledgment (timestamp, text shown, answers). The charge must also be in the lease or a maintenance addendum to be enforceable (company's attorney to confirm wording).
- Entry: Florida requires at least **24 hours' notice** for repairs, with entry between **7:30 AM and 8:00 PM** **(law, Fla. Stat. 83.53(2), raised from 12 hours by the 2022 "Miya's Law"; attorney to confirm)**. Send automatically when a vendor schedules, and don't let a vendor pick a time sooner than the notice period or outside those hours. No notice is needed in an emergency or when the tenant agrees to the time. Store the notice period as a company setting (default 24 hours) so it can follow future law changes or other states.
- Entry notice delivery: chapter 83 doesn't say how the 24-hour repair notice must be given. Each scheduled visit records the method (posted on the door, handed to the tenant, mailed, or e-mailed). E-mail counts as the notice only when the tenant signed the 83.505 e-mail notice addendum (lease.email_notices_agreed); otherwise the e-mail to tenants is a courtesy copy.
- Vendor paperwork: a vendor who works on site (trades, cleaning, landscaping, pest, fire, elevator, or trade not set) needs a **W-9 on file and a current liability insurance certificate** before a work order can be sent. Expired workers' comp also blocks. Insurance ending within 30 days shows a warning but still allows dispatch. Utilities, suppliers, government, legal, bookkeeping and media vendors are exempt. Only an admin can allow a specific vendor to be dispatched anyway.

## Rent, fees and payments
- Lease lengths: SIM REI offers 7 to 24 months (Florida ch. 83 sets no maximum; leases over a year must be written and signed, and witnesses are not required for leases, Fla. Stat. 689.01(1)). Under 12 months adds the short-term surcharge; over 12 months the lease states a yearly rent increase (SIM REI: 3%), since a fixed-term lease can't be changed mid-term.
- Lease settings per property (property.lease_settings): repair deductible (only allowed for single-family homes and duplexes, 83.51(1)), pest control (resident or landlord; landlord by default in larger buildings, 83.51(2)(a)), lawn care and irrigation (houses), utilities paid by the landlord, keys, utility providers, where deposits are held (83.49(2)), and the owner's flood (83.512) and lead-paint answers. Every lease at the property fills in from them.
- Repair deductible and jury waiver (decided Nov 1, 2026): every single-family home lease carries a $150 resident repair deductible per incident (lease §3.2; Florida lets single-family and duplex leases shift some repair duties to the tenant, 83.51); not used on multi-unit buildings. The jury trial waiver (§4.3) stays. Attorney to confirm both.
- Lease expirations: at most 12% of units may end in any one month, for the portfolio and for each property (at least 1 per property). Avoid November, December and January. Leases end on the last day of a month. When offering a new lease or a renewal (from 90 days before the end), Parcel Manage recommends the length that keeps endings spread out: 12 months if that month is open, otherwise the closest length ending in an open month.
- Rent due on the 1st; late fee posts after the grace period per lease (SIM REI sample: $50 on the 6th). A lease can carry its own late-fee terms (days of grace and a flat amount or a percent of rent; imported from AppFolio for 12 SIM REI leases), which win over the company default. Florida residential law (ch. 83 Part II) sets no late-fee amount; the fee must be written into the lease (83.43 lets the lease call it rent). ACH is free to tenants; cards carry a convenience fee shown before confirming (SIM REI sample: 3%). Returned ACH posts an NSF fee and can block ACH after repeated returns.
- Owner distributions monthly, split by ownership %, after expenses, debt service and reserve.

## Florida notices (law — have the company's attorney review templates before first use)
- 3-day notice to pay or deliver possession (83.56(3)): rent only; deadline excludes Saturdays, Sundays and court holidays; +5 days if mailed; hand delivery or posting if absent.
- 7-day notices of noncompliance with/without opportunity to cure (83.56(2)).
- Notice of entry for repairs: at least 24 hours, entry between 7:30 AM and 8:00 PM (83.53(2), as amended in 2022).
- Security deposit: return within 15 days, or send notice of intent to claim by certified mail within 30 days; tenant has 15 days to object (83.49).
- Legal notices are **never sent automatically**; they're drafted for approval.

## Communications
- Letters and emails go out with the **sender's name and title**; signature = sender. Titles editable and saved per user.
- Every message (email, text, portal, letter) is saved to the tenant's record; copies of letters file to the document cabinet.
