

# SIM REI Manager — AppFolio Replacement Spec
 · 

## Goal and principles
SIM REI Manager replaces AppFolio for the company-owned portfolio: every AppFolio feature we use, rebuilt better, with AI built in and an open API from day one.
- 
Parity first. Nothing in AppFolio that SIM REI uses today goes missing. AppFolio can be shut off only when every row in the parity map below is built.
- 
Improve where AppFolio is weak. No API access on our plan, add-on pricing for AI, rigid multi-entity accounting, and a 50-unit minimum.
- 
AI-native, not AI add-on. Every screen has an assistant that can read the books and act. Every action goes through an approval queue that Wesley controls.
- 
Open by default. A documented REST API, webhooks and outbound integrations, so nothing is locked in the way our AppFolio data is today.
- 
Built for an owner-operator. Multiple LLCs under SIM REI Holdings, co-owned buildings (100 N Dewey), and owner distributions are first-class. SIM REI is the first customer; the plans section covers selling it to other managers.

## AppFolio feature inventory
AppFolio sells three plans: Core ($1.49/unit/mo), Plus ($3.20) and Max ($5.00), with a 50-unit minimum and minimum spend (AppFolio pricing). The API is read-only on Plus and read/write only on Max. Its AI agents ("Performers") are split across tiers.
Module
What AppFolio offers
Plan
Property accounting and reports
GL, bank reconciliation, receivables and payables, owner statements, standard reports
Core
Advanced accounting
Budgeting, advanced data analysis, custom fields
Plus
Marketing and leasing
Vacancy listings, online applications, screening, e-leases
Core
Leasing CRM and Leasing Signals
Prospect pipeline and lead scoring
Max
Work orders
Requests, vendor dispatch, tracking
Core
Maintenance scheduling and automated billing
Recurring jobs, bill-back to tenants
Plus
Inspections and unit turns
Mobile inspections, make-ready workflows
Core
Purchase orders and inventory
POs, inventory tracking
Core
Integrated communication
Email, text, resident messaging
Core
Mobility
Mobile app for staff; resident and owner portals
Core
Realm-X Assistant and Messages
AI chat assistant and message drafting
Core
Realm-X Flows
AI workflow automation
Plus
Accounting Performer
AI bill entry, invoice coding, approval routing, financial close; budgeting on Max
Plus / Max
Leasing Performer
AI leasing agent on email, text and phone, 24/7, books tours
Add-on
Resident Messenger Performer
AI answers resident questions from policies; about a third resolved automatically in beta
Add-on
Claude connector
Agent-to-agent link from Realm-X to Claude for multi-step workflows (June 2026)
Not stated
AppFolio Stack
Partner integration marketplace; standard on Core, premium on Plus
Core / Plus
AppFolio API
Read-only on Plus, read/write on Max; partners apply for sandbox access
Plus / Max
Affordable and student housing
HUD/LIHTC applications and waitlists
Plus
AI announcements: AppFolio, June 2026. Integrations: AppFolio Stack partners. Affordable and student housing are out of scope for SIM REI.

## Feature parity map
Every AppFolio module has a SIM REI Manager version. Two requirements go beyond AppFolio: dashboard tiles you can drag around, and our own built-in e-signature platform.
Area
AppFolio today
SIM REI Manager
How it's better
Dashboard
Fixed home screen
Tiles you can drag, resize, hide and add, saved per user
Each person arranges their own view; the AI can add a tile on request ("show me Grove Tower NOI")
E-signature
E-leases inside the leasing flow
Native e-sign platform: templates, signer order, audit trail, signed PDF to the tenant file
Sign any document, not just leases: renewals, notices, vendor agreements, owner documents. No per-envelope fees.
Properties and units
Property and unit records
Same, plus owning entity, ownership splits and loan details on every property
Built for LLCs under SIM REI Holdings and co-owned buildings
Tenants and leases
Lease records, renewals
Lease timeline, renewal offers that go straight to e-sign
AI drafts the renewal offer with a rent suggestion
Rent and payments
Online payments, ledgers, late fees
ACH and card through the portal, autopay, automatic late fees, ledgers
Partial-payment rules and payment plans; payments reconcile to the bank feed automatically
Accounting
GL, bank rec, AP/AR, owner statements
Multi-entity GL, bank feeds, reconciliation, AP with approvals, owner distributions, 1099s
One login across every entity; distributions split by ownership % automatically
Budgeting and analysis
Plus/Max only
Included: budgets, forecasts, custom reports
No tier gating
Leasing and marketing
Listings, applications, screening, CRM on Max
Listings syndication, online applications, screening integration, prospect pipeline
CRM included; AI answers leads 24/7
Maintenance
Work orders, vendors, scheduling on Plus
Work orders with delivery-style tracking, vendor portal, recurring jobs, bill-back
Requests from portal, phone (Weblo) and email land in one queue
Inspections and turns
Mobile inspections, make-ready
Mobile inspections with photos, move-in/move-out comparison, turn checklists
AI compares move-in and move-out photos to suggest deposit deductions
Purchase orders and inventory
POs, inventory
POs, inventory, equipment tracking
Can track the skid steer and trailer subscription equipment
Communication
Email, text, resident messaging
Unified inbox: email, SMS, portal chat, call summaries
Every message is tied to the tenant, unit and work order
Portals
Resident and owner portals, mobile app
Tenant portal and owner portal (Grove Tower partners), mobile-first
Owners see statements and distributions live
Custom fields
Plus only
Custom fields on any record
Included
API
Read-only on Plus, read/write on Max, partner approval
Full read/write REST API plus webhooks on every plan
You own the data and the keys
"Like Parcel" refers to Wesley's own Parcel prototype; its e-sign flow and look are the model.

## Modules added in review (Oct 27)
These came out of the prototype review and are now part of v1.
Module
What it does
Bills
Invoices emailed in are read and coded by AI, approved by you, then paid straight from the app by ACH, mailed check or company card. You can also pay all scheduled bills in one batch.
Bank accounts
Connect each entity's accounts through Plaid. Each property chooses where its rent lands, where deposits are held, and which account pays its bills. Warns you if security deposits point at an operating account.
Reports
Library of financial, rent, leasing, maintenance and tax reports with PDF/Excel/CSV export and monthly email. The AI builds custom reports on request.
CSV import
Rent roll, tenant contacts, vendors, owners and AppFolio exports. The AI matches columns, then you review flagged rows before anything is written.
Vendors
Directory with W-9, insurance (COI) and 1099 tracking. A vendor can't be dispatched while documents are missing.
Vendor portal
Vendors get an email with a one-time login link (no password). They can accept or decline the job, pick a visit time within the tenant's availability, finish the job with photos, and upload an invoice that lands in Bills.
Team and users
Add more property managers and staff, each with their own login, a role (Admin, Property manager, Accountant, Maintenance coordinator, Leasing agent, Read-only) and access to only the properties you choose.
E-sign
Matches the Parcel flow: send for signature with signer order and auto-placed fields, then the signer types their name, with Florida UETA consent.
Look and feel
Same colors as Parcel: warm off-white background, deep green-black text, teal-green accent, sky/sun/coral status colors, Archivo type, rounded cards and pill tags.
Also added later in the review:
- 
Leasing: vacancy listings with AI-written descriptions and a rent check, posting to Zillow, Apartments.com and simreipm.com, and an applicant pipeline (New → Screening → Approved → Lease sent → Signed) scored against written criteria. Declines send an adverse action notice. Co-applicants invited from the application show as Invited (with Resend invite) and are linked automatically. Managers can link or unlink applications by hand, and AI flags separate applications for the same unit from the same address. Linked applicants are one household: incomes combine for the 3× check, and approve or decline applies to everyone who has applied.
- 
Inspections and deposits: move-in, move-out and periodic inspections with photo comparison. AI suggests deposit deductions; you can untick or edit any of them. Tracks Florida's 15- and 30-day deadlines, sends the certified-mail claim notice, and refunds by ACH.
- 
Recurring maintenance: preventive schedules (filters, pest, detectors, gutters) that create work orders ahead of time and assign them to a named vendor.
- 
Vendor assignment by name on every work order, with when it's scheduled and who it's assigned to shown on the dashboard tile and the Maintenance list. Creating, assigning or auto-generating a work order emails and texts the vendor immediately with a one-tap accept-and-schedule link, and every message (with delivered/opened status) is logged on the work order.
- 
Tenant portal additions: notice to vacate, renters insurance upload, vehicles, pets, people on the lease, emergency contact, and documents.
- 
Accounting additions: recurring bills, journal entries that must balance before posting and can only be reversed, a custom report builder, and Add buttons for every record type.
- 
Communications: a library of 37 letters and notices in seven groups: Florida legal notices (3-day, 7-day with and without cure, 12-hour entry, non-renewal, deposit claim, abandoned property), violations (parking, trash, noise, pets, occupants, smoking, patio, yard, damage, HOA), rent and payments, lease and renewals, maintenance and property, move-out, and leasing. Pick a property and a unit, a group, or everyone with a balance, and each letter fills in tenant names, address, county, rent, balance, lease dates and deadlines (3-day deadlines skip weekends and court holidays, plus 5 days if mailed). Wording can be edited per send or saved as your own template. Sends by email, text, portal, print or certified mail, and files a copy to each tenant's document cabinet. Includes a sent log and automations (rent reminders, late notices, 12-hour entry notices when a vendor schedules, renewal offers, insurance expiring). Legal notices are never sent automatically.
- 
Lease templates: pick a unit and the matching residential or commercial leases and addenda appear. They fill in from the tenant or approved applicant, the owning entity, rent, deposit, term and county. Required addenda are added automatically (radon notice, lead paint for pre-1978 buildings, pet addendum when pets are listed). Upload your own attorney-approved lease and AI maps its blanks. Send for e-signature; signed copies file to the tenant's cabinet.
- 
Guest cards and unit-based applications: Leasing has a Guest cards tab. Send any prospect a personal application link for a unit, with their details pre-filled, and track sent, opened and applied. The unit's residential or commercial setting decides which application opens.
- 
Move-out workflow and tenant document cabinet: each tenant profile has Ledger, Documents and Move-out tabs. Move-out runs details → inspection → charges against the deposit (unpaid ledger balance pulled in automatically, AI-suggested charges from the inspection, or add your own) → final account statement. Sending it emails the tenant, posts it to their portal, optionally queues certified mail when keeping deposit money, and files the statement in the tenant's document cabinet. The cabinet files leases, applications, inspections, notices and statements automatically and takes uploads.
Still to design: a tenant-requests inbox on the manager side, communications and automations (reuse Parcel's), an owner portal, 1099s and budgets.
Rollout: SIM REI uses it first. Once it's working well, it may be offered to other managers for a monthly fee.

## Plans: everything in AppFolio Max, in our Basic plan
Our Basic plan includes every feature AppFolio reserves for its top Max tier ($5.00/unit/mo) and its Plus tier. No minimum unit count.
AppFolio Max / Plus feature
AppFolio plan
SIM REI Manager Basic
Leasing CRM
Max
Included
Leasing Signals (lead scoring)
Max
Included — AI ranks prospects
API read/write
Max
Included, plus webhooks and MCP
Accounting Performer: budgeting
Max
Included — AI budgets and reforecasts
Dedicated customer success
Max
Included as an in-app AI assistant; human support plan TBD
Accounting Performer: bill entry and close
Plus
Included
Advanced budgeting and accounting
Plus
Included
Advanced data analysis
Plus
Included — ask the AI or build tiles
Custom fields
Plus
Included
Realm-X Flows (automation)
Plus
Included — agents and workflow rules
Premium integrations
Plus
Included
Maintenance scheduling and automated billing
Plus
Included
Scale and control (permissions)
Plus
Included — roles and approval rules
Everything in Core
Core
Included
Movable dashboard tiles, native e-sign, owner ACH payouts
Not offered
Included
Selling Basic to other property managers changes the scope from an in-house tool to a multi-company product. That needs:
- 
Separate, isolated accounts per company.
- 
Trust accounting for third-party owners' money under Florida broker rules.
- 
Management-fee billing.
- 
A payments setup where each company is its own merchant (Stripe Connect platform).
- 
Security reviews.
Decided: SIM REI goes first. Outside companies come later, for a monthly fee, once the product is proven. The multi-company work above can wait until then, but the data model is built so each company's data stays separate from day one.

## AI layer
Claude runs underneath the whole app: an assistant on every screen, plus agents that do the routine work and send anything with money or legal weight to an approval queue for Wesley.
Agent
What it does
Needs approval
Assistant
Answers questions across the books ("who's late at Palmetto?", "Grove Tower NOI YTD"), builds reports and dashboard tiles on request
No (read-only)
Maintenance triage
Turns Weblo call summaries, portal requests and emails into work orders; sets category and priority; suggests a vendor
Vendor dispatch over a set dollar limit
Accounting agent
Reads invoices from email, codes them to the right entity and GL account, matches bank-feed transactions, drafts the month-end close
Bill payment and journal entries
Collections agent
Sends reminders on a set schedule, offers payment plans within your rules, drafts the 3-day notice
Any legal notice
Leasing agent
Answers prospect texts and emails 24/7, books showings, pre-screens applications
Approving an applicant
Resident messenger
Answers tenant questions from the lease and house rules
Anything outside policy
Renewal agent
Flags leases ending in 90 days, suggests the renewal rent, prepares the e-sign packet
Sending the offer
Inspection AI
Compares move-in and move-out photos, lists the damage, drafts deposit deductions
Deposit disposition
Document AI
Pulls key terms out of leases, insurance certificates and loan documents into the record
No
Guardrails:
- 
Every agent action is logged with the reasoning behind it.
- 
Dollar limits and approval rules are set per entity.
- 
The approval queue reaches Wesley by email and phone push, matching how the current AppFolio automations already work.

## API and integrations
The app is open on every side: a public REST API, webhooks for every event, and an MCP server so Claude (or any AI agent) can operate it directly.
- 
REST API. Read/write on every object: properties, units, tenants, leases, charges, payments, GL entries, work orders, documents. Uses scoped API keys per integration.
- 
Webhooks. Events such as payment.received, lease.signed, workorder.created and bill.approved fire to any URL you give them.
- 
MCP server. Exposes the same API as tools, so Claude chats and scheduled tasks can read and act in the app.
Integration
Purpose
Likely provider (to confirm)
Bank feeds
Import transactions for reconciliation
Plaid
Rent payments
ACH and card from the tenant portal, payouts to each entity's account
Stripe
Tenant screening
Credit, criminal and eviction checks
TransUnion SmartMove or similar
Listings syndication
Post vacancies to Zillow, Apartments.com and others
Zillow Rental Network feed
Phone and AI receptionist
Call summaries become work orders and messages
Weblo (email parsing first, API if available)
Email and SMS
Notices, reminders, two-way texting
Resend for email (already connected); Twilio for SMS
Google Workspace
Calendar for showings and vendor visits; Drive for signed documents and monthly reports
Google (already connected)
Bookkeeping
Sync or export to the outside bookkeeper
QuickBooks Online (already connected)
Renters insurance
Proof-of-coverage tracking
Provider TBD
Open question: does NorthPoint Bookkeeping keep working in QuickBooks? If so, the app syncs to QuickBooks; if not, it becomes the books of record.

## Owners, payouts and rent payments
Owners are their own records. Money moves by ACH both ways: tenants pay rent in, and owners get distributions out. Tenants pay nothing for ACH; card payments carry a fee the tenant pays.
Flow
How it works
Who pays the fee
Owner records
Each owner (person or entity) has contact info, tax ID on file for 1099s, a payout bank account, and an ownership % per property (e.g. 100 N Dewey: Owen 35%, DiVenanzo 32.5%, Nelson 32.5%)
—
Owner payouts
Monthly distribution run: cash available after expenses, debt service and reserve is split by ownership %. ACH to each owner, statement emailed, owner portal updated
SIM REI (ACH cost is small, a flat fee per payout)
Tenant ACH
Bank account linked in the portal (instant verification); one-time or autopay
Free to tenant; SIM REI absorbs the processor's ACH fee
Tenant credit card
Card in the portal; a convenience fee is shown before they confirm and added to the payment
Tenant pays the fee
Returned payments
A returned ACH reverses the ledger entry, posts an NSF fee, and blocks ACH for that tenant after a set number of returns
Tenant (NSF fee per lease)
Owner contributions
Owners can fund shortfalls by ACH into the property account
—
Card fee rules to confirm before launch: card networks cap surcharges and require them to be disclosed. Debit cards generally can't be surcharged. Some processors handle this by charging a flat convenience fee or by detecting debit vs credit. Stripe is the likely processor for both directions, with Stripe Connect for payouts to owners. The exact fee setup gets confirmed with the processor and your attorney.

## Build phases and migration
The build runs in four phases. AppFolio stays live until the last gate, so nothing breaks during the switch.
Phases 1–2 replace what AppFolio is used for daily. Phases 3–4 add everything AppFolio doesn't offer us. Stack: Supabase (database, logins, storage) and Vercel (app hosting), both already connected.