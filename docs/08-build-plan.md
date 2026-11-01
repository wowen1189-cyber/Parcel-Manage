# 08 — Build plan

Build in order. Each phase ends with a demo Wesley can click through, tests passing, and sample data seeded. AppFolio stays live until Phase 4's switch-over checklist is complete. At the start of a phase, restate its checklist; at the end, report what's done and what to click.

## Phase 0 — Foundation
- [x] Next.js + TypeScript + Tailwind app; design tokens and base components from `06-design-system.md`; Archivo font
- [x] Supabase project connected; `0001_core.sql` applied; typed client generated; `.env.example`
- [x] Auth: email magic link + password; company creation on first sign-in; invite teammates by email with role and title
- [x] Manager app shell: sidebar (all nav items, placeholders OK), top bar, "+ New" menu, AI panel placeholder; responsive
- [x] Company subdomains: add `company.subdomain` (unique; lowercase letters, numbers, hyphens) in a new migration; middleware reads the subdomain and loads that company before sign-in; SIM REI seeded as `simreipm`; root domain read from `NEXT_PUBLIC_ROOT_DOMAIN` (`parcelmanage.com` in production, `localhost:3000` locally); local dev at `simreipm.localhost:3000`; on the Vercel test address fall back to the signed-in user's company; a test proving a user from one company signing in on another company's subdomain sees nothing
- [x] Company settings screen: profile (name, phones incl. tenant-facing office phone, address, time zone) and Business rules form seeded with SIM REI defaults from `02-business-rules.md`
- [x] Audit log writes; RLS verified with a test that a second company can't see the first company's rows; database tests that a posted journal entry can't be edited, un-posted or deleted, that an invite only works for the invited email, and that work order numbers start at 1 for each company
- [x] Seed script: SIM REI with its entities, properties (The Grove Tower 20 units, Grove Park mixed-use, 420 S Palmetto, 1026 W Line St, 6 Forest Lane) and sample tenants
- [x] GitHub repo + Vercel project with preview deploys (live at simreipm.parcelmanage.com; every upload to GitHub publishes automatically)
**Done when:** Wesley signs in, sees the shell with SIM REI's properties seeded, edits a business rule, and a second test company sees none of SIM REI's data.

## Phase 1 — Daily operations (replace AppFolio day to day)
- [ ] Properties and units (residential/commercial unit kind), entities, ownership splits. *Done: property list/detail/edit with owning LLC and ownership splits, CSV export, SIM REI imported from AppFolio. Also done: add a property, add and edit units, grouped menu, movable dashboard tiles.*
- [ ] Tenants and leases; tenant profile tabs: *(Done: tenant list with filters and CSV export, lease page with terms, late fee, contacts, door code, notes. Also done: commercial lease (ch. 83 Part I) with per-lease commercial terms and rent schedule; new lease with the length planner (draft, then mark signed), household and insurance editing, automatic billing settings, rebuilt lease template, lease expirations. Left: text opt-in, documents.)* Ledger, Contact & household (emergency contacts, vehicles with tag + parking permit, renters insurance, text opt-in), Documents
- [x] Charges, late fees (scheduled job), manual payments; double-entry journal posting; journal entries screen (balance to post; reverse only) *(Done: chart of accounts, posting functions, tenant ledger with payments, charges and returned payments, automatic billing job with cutover start, opening balances, Accounting trial balance per owner, journal entries with reversal.)*
- [ ] Maintenance: work orders with timeline, priority, vendor assignment by name (email now, text in Phase 3), when/who on lists and dashboard *(Done: staff work orders with the triage questions and safety buttons, priority from answers (staff can change it with a reason), vendor assignment with the paperwork block and job email, scheduling that enforces 83.53(2) and records how notice was given, completion with cost, timeline, list with filters and CSV, dashboard tile. Also done: photos from tenants and vendors on the work order, vendor job link, false-emergency charge to the ledger (by a person). Left: texting (Phase 3), recurring maintenance (Phase 4).)*
- [x] Vendors with W-9/COI tracking and dispatch block *(Done: directory, edit, paperwork status and dispatch rule, add a vendor, paperwork requests with a no-account upload link and reminders, documents on the vendor page, dispatch block on work orders.)*
- [x] Tenant portal *(Done: tenants sign in with the e-mail on file (first sign-in creates their login), home with balance, guided repair requests with safety buttons, priority from answers, self-check tips, emergency acknowledgment and photos, request timeline, ledger, messages with the office, My lease with vehicles, emergency contacts, renters insurance upload and notice to vacate; office side: portal invite and message thread with signed replies. Online pay button arrives with Stripe in Phase 2.)*: sign-in, home with balance (pay button stubbed until Phase 2), **guided maintenance request from `03-maintenance-triage.json`** (tips, required photos, priority rules, emergency acknowledgment, AI technician summary), requests timeline, Messages (portal channel), My lease (notice to vacate, insurance upload, vehicles, emergency contacts, pets, people, documents)
- [x] Vendor portal: link login, accept/decline, schedule (24-hour entry notice to tenants; earliest slot respects the notice period), complete with photos, invoice upload → Bills *(Done as a private job link per assignment, no account needed.)*
- [x] Communications: letter templates (start with Florida notices + 10 most-used), auto-fill, sender picker with **editable title** and signature = sender, email + portal + print, sent log, document cabinet filing *(Done: 7 Florida notices with statutory wording (3-day with the weekend/holiday deadline, 7-day with and without cure, deposit claim, month-to-month end, non-renewal, entry) and 9 everyday letters; live preview; e-mail only counts as legal delivery with the 83.505 addendum; every letter filed as a PDF on the tenant and logged under Sent with CSV.)*
- [x] Dashboard with draggable tiles
- [x] AI connection (BYOK) in Settings; AI technician summary and self-check tips use it, with graceful fallback when no key *(Done: Settings > AI with Anthropic, OpenAI, Gemini or OpenAI-compatible, key encrypted in Supabase Vault and never shown again, test on save, monthly spending limit that pauses AI, usage log; new repair requests get an AI technician brief in the background; self-check tips come from the triage file.)*
- [ ] CSV import (rent roll, tenants, vendors, owners, AppFolio exports) with AI column matching *(Done: AppFolio rent roll and vendor directory reader, run as `npm run import:appfolio`. Left: the in-app Import data screen, tenant directory, owners.)*
**Done when:** SIM REI can run a normal week: post rent, record payments, take a tenant maintenance request through vendor completion, send a notice, and see it all filed.

## Phase 2 — Money
- [ ] Stripe Connect: tenant ACH (free) and card (fee disclosed first), autopay, returned payments + NSF, receipts
- [ ] Plaid bank feeds, property → account mapping (trust warning), bank reconciliation
- [ ] Bills: inbound email invoices read and coded by AI (approval required), pay by ACH/check/card, pay all scheduled; recurring bills *(Done: bills from vendor job links or entered by hand, approve (posts expense and payable), record payment (blocked without a W-9), void, list with filters and CSV. Left: e-mailed invoices read by AI, online vendor payments, recurring bills.)*
- [ ] Owner statements and monthly distribution run *(Done: Owners screen with each owner's properties, management agreement and fees — company default, owner agreement or per-property — with estimated monthly fees and CSV export. Also done: monthly close per owner (fees from rent collected, statement with cash, bills, reserve and distribution, PDF e-mailed to owners and partners, payouts split by ownership and recorded). Left: ACH payouts, owner portal.)* split by ownership %, ACH payouts; owner portal (statements, distributions, documents)
- [ ] Native e-sign (templates, signer order, typed signature, UETA consent, audit trail, signed PDF filing); lease templates that fill from the unit and add required addenda
- [ ] Move-out workflow and final account statement (Fla. 83.49), inspections & deposits with AI-suggested deductions and deadline tracking *(Done: move-out, deductions, 83.49 deadline tracker on the page and dashboard, prefilled claim notice, objection window guard, deposit applied and refunded from trust. Left: photo inspections, AI-suggested deductions.)*
**Done when:** a full month closes: rent collected online, bills paid, bank reconciled to $0.00, Grove Tower partners receive statements and ACH distributions.

## Phase 3 — Leasing and communication
- [ ] Vacancies and listings (AI description, rent check, syndication feeds, company site listing pages)
- [ ] Guest cards, personal application links per unit; public rental application (residential/commercial by unit kind; fees; co-applicant invites; household linking)
- [ ] Screening via TransUnion ShareAble (mock first): decision rules from business rules, deposit tiers, adverse action notices, admin-fee refund on denial
- [ ] Twilio: two-way SMS (tenant profile Text messages tab, portal "also by text" opt-in, STOP handling), vendor dispatch texts, escalation texts
- [ ] AI leasing agent: setup (BYOK test gate, company settings, channels, rules), conversations, showings on Google Calendar, screening tab, escalations, test chat
- [ ] Automations (rent reminders, late notices, entry notices (24 hours before repair visits), renewal offers, insurance expiring); legal notices only drafted
- [ ] Weblo call-summary email parsing into work orders/messages
**Done when:** a prospect texts at 9 PM, gets answers, books a showing on Wesley's calendar, applies, is screened, and receives a lease to e-sign, with escalations texted to Wesley.

## Phase 4 — Insight, platform, switch-over
- [ ] Reports library (41) + custom builder + exports + scheduled emails (`04-reports-and-metrics.md`)
- [ ] Metrics page with company targets, alerts and daily snapshots
- [ ] AI assistant panel (read-only Q&A, build report/tile) and approval queue; remaining agents (collections, renewal, accounting close, resident messenger, document AI)
- [ ] Public REST API, scoped keys, signed webhooks; MCP server
- [ ] Recurring maintenance, purchase orders/projects, inventory and keys
- [ ] Security review: RLS tests per table, secrets audit, rate limits, backups/restore drill, error monitoring
- [ ] **Switch-over checklist:** import final AppFolio data (balances as of cutover date), parallel-run one month, reconcile every bank and trust account, confirm tenant autopay re-enrollment, owner/partner sign-off, then cancel AppFolio
**Done when:** AppFolio is off and SIM REI runs fully on Parcel Manage.

## Later (selling to other companies)
Self-serve signup and billing for Parcel Manage subscriptions; third-party trust accounting and management-fee billing; corporate books; per-company sending domains and Twilio numbers; onboarding import wizard; help center.
