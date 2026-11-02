# 01 — Product spec: Parcel Manage

Status: approved scope from the prototype review (Oct 27 – Nov 1, 2026). The clickable prototype is "Parcel Manage — Prototype" on claude.ai; screenshots go in `prototype/screenshots/`.

## 1. Users and apps

| App | Who | Device | Notes |
|---|---|---|---|
| Manager app | Company staff (roles below) | Desktop first, works on phone | Sidebar + content layout |
| Tenant portal | Tenants on a lease | Phone first | Bottom tab bar: Home, Requests, Messages, My lease |
| Vendor portal | Vendors assigned work | Phone first | One-time email/text login link, no password |
| Owner portal | Owners and partners of a property | Desktop and phone | Statements, distributions, documents, property metrics |
| Rental application | Prospects | Phone first, public | Residential or commercial, chosen automatically from the unit |
| Public listings | Prospects | Public | Company's vacancy pages on its subdomain (e.g. simreipm.parcelmanage.com/rentals; linkable from the company's own site) + chat widget |

**Roles** (per company, with per-property access): Admin, Property manager, Accountant, Maintenance coordinator, Leasing agent, Read-only. Permission matrix: Tenants & leases, Maintenance, Accounting, Approve bills, Owner payouts, Users & settings (see prototype Settings › Team). Each user has a **name and an editable title** (used on letters, emails and signatures).

**Company web address.** Each company gets its own subdomain of the Parcel Manage domain, and every app above (manager app, tenant, vendor and owner portals, rental application, listings) is served there for that company. SIM REI: `simreipm.parcelmanage.com` (`{ROOT_DOMAIN}` is the `NEXT_PUBLIC_ROOT_DOMAIN` setting, never hard-coded. It is `parcelmanage.com` in production (bought Nov 1, 2026 through Vercel, with `parcelmanage.com` and `*.parcelmanage.com` on the Vercel project) and `localhost:3000` on the Mac. On Vercel preview addresses, which can't have company subdomains, pick the company from the signed-in user's membership). The subdomain is chosen at signup (lowercase letters, numbers and hyphens), is unique, and decides which company a visitor sees before anyone signs in. A user who signs in on the wrong company's subdomain sees nothing from that company. Later, a company can also point its own domain at Parcel Manage (e.g. a listings page on simreipm.com).

## 2. Manager app — navigation

Dashboard · Properties · Tenants & leases · Leasing · AI leasing agent · Communications · Accounting · Bills · Recurring bills · Journal entries · Bank accounts · Reports · Metrics · Maintenance · Inspections & deposits · Owners & payouts · E-sign · Settings & team · Vendors · Import data. Global "+ New" menu (Property, Tenant and lease, Owner, Work order, Vendor). AI assistant side panel available on every screen (chat + approvals queue). Badges on nav items for counts needing attention.

## 3. Modules

### Dashboard
Drag-and-drop tiles (move, resize half/full width, reset, saved per user). Default tiles: Key numbers, Collections this month (with delinquent list), Activity feed, Upcoming owner payouts, Awaiting signature, Leases ending in 90 days, Open work orders (each showing **when scheduled and who it's assigned to**). The AI can add a tile on request.

### Properties and units
Property: name, address, type (residential, commercial, mixed), owning entity (LLC), ownership splits (e.g. The Grove Tower: Wesley Owen 35%, Daniel DiVenanzo 32.5%, Rick Nelson 32.5%), loans, insurance policies, bank account mapping. Unit: number, type (**residential or commercial; this drives which application and lease templates are used**), beds/baths/sq ft, market rent, amenities, keys, status. Property detail: occupancy, monthly rent, owed, units table.

### Tenants and leases
Tenant list (search, status pills: Current, Late, Delinquent, Renewal due, Vacant, Listed). Tenant profile tabs:
- **Ledger**: charges, payments, running balance. Record payment, Add charge, Start move-out, **Text tenant**.
- **Contact & household**: mobile, email, preferred contact (Text/Email/Call), **text opt-in**; **emergency contacts** (name, relationship, phone); **vehicles** (year/make/model, color, **tag number**, state, **parking permit # issued by the office**); **renters insurance** (carrier, policy #, expiration, liability coverage, company listed as interested party, status Active/Expiring soon/Missing). Each item shows who last changed it ("Tenant portal · date" or "Office · edited"). Tenants edit vehicles, insurance and emergency contacts in their portal; office can edit everything.
- **Text messages**: two-way SMS thread (Twilio), quick messages (rent reminder, entry notice, work order update, please call), blocked if not opted in, STOP opts out, every message saved to the record.
- **Documents**: document cabinet; everything signed, sent or uploaded files here automatically; filters by type; upload with a type.
- **Move-out**: details (date, how notice was given, forwarding address) → inspection → charges against the deposit (unpaid ledger balance pulled in automatically; AI-suggested charges from the inspection; add your own) → final account statement (Florida 83.49 language) → send (email + portal + optional certified mail) and file to the cabinet; refund or bill the balance.

### Leasing
- **Vacancies & listings**: AI-written description (rewrite button), rent and deposit, pets, AI rent check against comparable listings, residential/commercial type (from the unit, overridable), syndication channels (Zillow network, Apartments.com, company site), publish/update.
- **Guest cards**: prospects with source, desired move-in, showing status, notes; send a **personal application link for a specific unit** with details pre-filled by email and/or text; track sent / opened / applied.
- **Applicants pipeline**: Invited → New → Screening → Approved → Lease sent → Signed (and Declined). Co-applicants invited from an application are linked as one household automatically; manual link/unlink; AI flags likely households (same unit, same current address). Household income combines. Checks shown against the company's written criteria (see business rules). Actions per stage; declines and higher-deposit approvals send adverse action notices.
- **Rental application** (public): residential (household, income, rental history, pets, vehicles) or commercial (business, owners/guarantor, financials), chosen by unit type. Fees per company settings (SIM REI: $75 per adult application + $85 admin fee, card only, admin fee refunded if denied). Co-applicant invites.

### AI leasing agent
Tabs: Setup, Conversations, Showings, Screening, Escalations.
- **Setup**: AI connection (provider: Anthropic/OpenAI/Gemini/OpenAI-compatible; API key; model; monthly spending limit; Test connection; masked key; agent cannot be turned on until the test passes); Your company (name, escalation contact + mobile, who runs showings, showing calendar); Channels (email/listing leads, two-way SMS, website chat; phone stays with the company's phone system, e.g. Weblo); How it works (auto-reply 24/7, escalate by text); escalation triggers (price/fee negotiation, complaints, accommodation and assistance animals, fair housing questions, legal/lease-term questions, background history questions, asks for a person, upset/urgent); fair-housing guardrails; the criteria the agent quotes (from business rules); showing rules; open items checklist; **Test the agent** chat.
- **Conversations**: threads by channel with status (Showing booked, Application sent, Escalated · reason), take over / hand back, send application, list of actions the agent took (guest card created, showing booked, reminder scheduled).
- **Showings**: week view of booked and open slots on the showing person's calendar (weekdays 10–6, 30-min slots, 15-min buffer; confirmation + 1-hour reminder; one no-show follow-up).
- **Screening**: provider (TransUnion ShareAble recommended, CRS backup), API credentials, results webhook, who pays (covered by the application fee); automatic decision rules (Approve / Approve with higher deposit / Escalate for review / Decline); recent results with deposit amounts.
- **Escalations**: list with reason, summary, when it was texted, Open thread, Mark handled.

### Communications
- **Letters and notices**: 37+ templates in groups (Florida legal notices: 3-day, 7-day with and without cure, notice of entry, non-renewal, deposit claim, abandoned property; violations: parking, trash, noise, pets, occupants, smoking, patio, yard, damage, HOA; rent and payments; lease and renewals; maintenance and property; move-out; leasing). Pick property → unit, group, or everyone with a balance; letters auto-fill tenant names, address, county, rent, balance, lease dates, deadlines (3-day skips weekends and court holidays; +5 days if mailed). Edit wording per send or save as your own template. Send by email, text, portal, print (with certificate of service) or certified mail. Copy files to each tenant's cabinet.
- **Sender identity**: "Sent by" picker (active team members) and **editable title** saved to that user's profile. Email From line = "Name, Title · Company <email>". Signature block = sender's name (script + typed) and title. The sent log records the sender.
- **Lease templates**: pick a unit; matching residential/commercial leases and addenda appear and fill in; required addenda auto-added (radon, lead paint pre-1978, pet addendum); upload your own attorney-approved lease and AI maps its blanks; send for e-sign.
- **Sent log** and **Automations** (rent reminder 3 days before due; late notice after grace; 3-day notice drafted for review only; entry notice when a vendor schedules; renewal offer 90 days before end; insurance expiring 30 days; welcome letter; move-out instructions). Legal notices are never sent automatically.

### Maintenance
- **Work orders**: list with filters (Open, Completed, All), each showing when and who; detail with status timeline (Request received → Vendor accepted → Visit scheduled → Completed with invoice), priority (from triage), vendor assignment by name (assigning or creating **emails and texts the vendor immediately** with an accept-and-schedule link; delivery/opened status logged; resend), tenants on the unit with call/text/email and availability, "text tenants a scheduling link", AI summary from the tenant's triage answers, photos.
- **Emergency handling**: emergency priority (set by triage rules, never by the tenant) pages the on-call vendor/staff immediately. If the vendor finds it wasn't an emergency, the office can post the **false-emergency charge** (vendor's emergency call-out cost + company fee; SIM REI $100) to the tenant ledger, citing the tenant's signed acknowledgment from the request.
- **Recurring maintenance**: preventive schedules (HVAC filters, pest, detectors, gutters, AC service, extinguishers) with frequency, lead time and named vendor; creates work orders ahead of time.
- Requests arrive from tenant portal, phone (Weblo call summaries via email parsing first), email, and staff.

### Inspections & deposits
Move-in, move-out, periodic. Room-by-room condition with photo counts, side-by-side move-in vs move-out, AI-suggested deductions (editable, untickable), deposit math (held − unpaid − deductions), Florida 15/30-day deadline tracking, certified-mail notice of intent to claim, ACH refund.

### Accounting
Multi-entity general ledger (chart of accounts per company, entity per property), trial balance, bank reconciliation (tick deposits in transit and outstanding checks; finish only at $0.00 difference), owner statements (income, expenses, management fee, NOI, debt service, reserve, cash to distribute). **Journal entries**: manual entries must balance to post; drafts allowed; posted entries can only be reversed. Automatic entries from rent charges, payments, bills, bank feed.

### Bills and recurring bills
Invoices emailed in are read and coded by AI (entity, property, GL, work order match, anomaly notes), approved, then paid by ACH, mailed check or company card from the mapped account; pay-all-scheduled. Recurring bills: vendor, property, GL, amount (fixed or varies), frequency, next date, auto-pay under a limit vs approve each, pause/resume.

### Bank accounts
Plaid-connected accounts per entity (operating, security deposit trust, reserve). Each property maps rent deposits → account, security deposits → trust account, bills paid from → account. Warn if deposits map to an operating account.

### Owners & payouts
Owner records (person or entity, contact, tax ID on file, payout bank, stakes per property, YTD). Monthly distribution run split by ownership %, ACH, statement emailed, owner portal updated. Owner contributions for shortfalls.

### E-sign
Native e-signature: templates, signer order, auto-placed fields, typed-name signing with Florida UETA consent, audit trail, signed PDF to cabinets. Sign anything (leases, renewals, notices, vendor and owner documents). No per-envelope fees.

### Vendors
Directory with trade, contact, W-9 and insurance (COI) status and expiration; a vendor can't be dispatched while documents are missing; 1099 tracking; vendor ledger.

### Reports and Metrics
See `docs/04-reports-and-metrics.md`: 41-report library (each with options instead of separate variants, each showing which AppFolio reports it replaces), custom report builder (data source, columns, group, filter, sort, save), PDF/Excel/CSV export, **Scheduled emails** (report or Metrics summary, properties, frequency, format, recipients who don't need a login; pause/remove), and the **Metrics** page with company-editable targets and alerts.

### Import data
CSV import for rent roll, tenant contacts, vendors and owners from any software (AppFolio, Buildium, Rent Manager, Yardi, …) or a spreadsheet: upload → columns matched by heading, AI fills gaps (override per column) → review rows (ready / flagged / needs a fix) → import; logged and undoable for 30 days.

### Settings & team
Payments (credit card fee at the processor's cost, at most 3%; debit cards and ACH free), Integrations (connect/disconnect), API keys and webhooks, Team (invite by email with role and property access; permission matrix), company profile (name, phones, addresses, logo, time zone), **business rules** (see `docs/02-business-rules.md`), AI connection (shared with the leasing agent).

## 4. Tenant portal
- **Home**: balance due, pay (ACH free / card with fee shown before confirming), autopay toggle, recent activity, Request maintenance.
- **Requests**: request list with delivery-style status timeline; **guided new request** (see below).
- **Messages**: thread with the office; optional "also send me office messages by text" with consent wording (rates may apply, reply STOP to opt out).
- **My lease**: lease summary; notice to vacate (date, reason, forwarding address, acknowledgment; time-stamped; withdraw); renters insurance (company, policy, expiration, declarations page upload); **vehicles** (add/remove; make/model, color, **tag number**, state; shows **parking permit #** or "pending from the office"); pets; people on the lease; **emergency contacts** (add/remove); documents. Changes go straight to the office.

### Guided maintenance request (tenant portal)
Six steps with a progress bar and Back: (1) category, (2) item, (3) what's happening, (4) follow-up questions with the **assistant's self-check tips** that update as the tenant answers, plus "That fixed it, no visit needed" (logged on the unit's record), (5) **photos required** (camera or upload, at least one; hint says what to photograph), room, extra notes (required for "Something else"), OK to enter, pets in home, (6) review with priority and an **AI-written summary for the technician**. Full tree and rules: `docs/03-maintenance-triage.json`.
- **Priority is set by the answers, never chosen by the tenant.** No "emergency" labels on options.
- Gas smell or active smoke/fire: "I smell gas" and "I see smoke, fire or sparks" buttons sit above the categories on the first screen. Tapping one shows safety instructions (leave, call 911) right away and creates an Emergency request, with no questions, tips or required photos.
- When answers make it an emergency (other than gas/fire), the tenant must check an acknowledgment: answers are accurate, and if it isn't an emergency they pay the vendor's emergency charge plus the company's fee. The acknowledgment is stored with the request and shown in the technician summary.
- Office phone shown in the portal comes from company settings (SIM REI: (352) 715-6203, from simreipm.com). Don't claim 24/7 unless the company says the number is answered 24/7.

## 5. Vendor portal
Email/text link login → job list → job detail (unit, issue, triage summary and photos, tenants on the unit with call/text, tenant availability) → accept/decline → pick a visit time (only times at least the notice period away, between 7:30 AM and 8:00 PM; triggers the entry notice to tenants) → "I'm here" check-in on arrival → complete with photos → upload invoice (lands in Bills).

## 6. Owner portal
Statements, distributions, documents, property metrics; scheduled emails reach owners without a login.

## 7. AI layer
Every agent uses the company's own AI key (BYOK) through `lib/ai/`. Agents: Assistant (read-only Q&A, builds reports/tiles), Maintenance triage (turns calls/emails/portal requests into work orders; priority; vendor suggestion), Accounting (invoice reading and coding, bank matching, close drafts), Collections (reminders, payment plans within rules, drafts 3-day notice), Leasing agent (above), Resident messenger (answers from lease and house rules), Renewal (90-day flag, rent suggestion, e-sign packet), Inspection AI (photo comparison, deduction drafts), Document AI (extract lease/COI/loan terms). Approval rules and dollar limits per entity; approvals queue reachable by email and push.

## 8. API and integrations
Public REST API (`/api/v1`) with scoped API keys; webhooks (payment.received, lease.signed, workorder.created, bill.approved, etc.); MCP server exposing the same operations. Integrations in `docs/05-integrations.md`.

## 9. Plans (for selling later)
One plan includes everything AppFolio reserves for Plus and Max (leasing CRM, lead scoring, read/write API, budgeting, custom fields, automation, maintenance scheduling, permissions), plus movable dashboard tiles, native e-sign and owner ACH payouts. No unit minimum. AI usage is billed to each company by its own AI provider. Selling to third-party managers later also needs: trust accounting for outside owners' money (Florida broker rules), management-fee billing, corporate (management company) books, Stripe Connect per company, security review.
