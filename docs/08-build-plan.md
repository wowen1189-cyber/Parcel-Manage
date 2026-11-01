# 08 — Build plan

Build in order. Each phase ends with a demo Wesley can click through, tests passing, and sample data seeded. AppFolio stays live until Phase 4's switch-over checklist is complete. At the start of a phase, restate its checklist; at the end, report what's done and what to click.

## Phase 0 — Foundation
- [ ] Next.js + TypeScript + Tailwind app; design tokens and base components from `06-design-system.md`; Archivo font
- [ ] Supabase project connected; `0001_core.sql` applied; typed client generated; `.env.example`
- [ ] Auth: email magic link + password; company creation on first sign-in; invite teammates by email with role and title
- [ ] Manager app shell: sidebar (all nav items, placeholders OK), top bar, "+ New" menu, AI panel placeholder; responsive
- [ ] Company settings screen: profile (name, phones incl. tenant-facing office phone, address, time zone) and Business rules form seeded with SIM REI defaults from `02-business-rules.md`
- [ ] Audit log writes; RLS verified with a test that a second company can't see the first company's rows; database tests that a posted journal entry can't be edited, un-posted or deleted, that an invite only works for the invited email, and that work order numbers start at 1 for each company
- [ ] Seed script: SIM REI with its entities, properties (The Grove Tower 20 units, Grove Park mixed-use, 420 S Palmetto, 1026 W Line St, 6 Forest Lane) and sample tenants
- [ ] GitHub repo + Vercel project with preview deploys
**Done when:** Wesley signs in, sees the shell with SIM REI's properties seeded, edits a business rule, and a second test company sees none of SIM REI's data.

## Phase 1 — Daily operations (replace AppFolio day to day)
- [ ] Properties and units (residential/commercial unit kind), entities, ownership splits
- [ ] Tenants and leases; tenant profile tabs: Ledger, Contact & household (emergency contacts, vehicles with tag + parking permit, renters insurance, text opt-in), Documents
- [ ] Charges, late fees (scheduled job), manual payments; double-entry journal posting; journal entries screen (balance to post; reverse only)
- [ ] Maintenance: work orders with timeline, priority, vendor assignment by name (email now, text in Phase 3), when/who on lists and dashboard
- [ ] Vendors with W-9/COI tracking and dispatch block
- [ ] Tenant portal: sign-in, home with balance (pay button stubbed until Phase 2), **guided maintenance request from `03-maintenance-triage.json`** (tips, required photos, priority rules, emergency acknowledgment, AI technician summary), requests timeline, Messages (portal channel), My lease (notice to vacate, insurance upload, vehicles, emergency contacts, pets, people, documents)
- [ ] Vendor portal: link login, accept/decline, schedule (24-hour entry notice to tenants; earliest slot respects the notice period), complete with photos, invoice upload → Bills
- [ ] Communications: letter templates (start with Florida notices + 10 most-used), auto-fill, sender picker with **editable title** and signature = sender, email + portal + print, sent log, document cabinet filing
- [ ] Dashboard with draggable tiles
- [ ] AI connection (BYOK) in Settings; AI technician summary and self-check tips use it, with graceful fallback when no key
- [ ] CSV import (rent roll, tenants, vendors, owners, AppFolio exports) with AI column matching
**Done when:** SIM REI can run a normal week: post rent, record payments, take a tenant maintenance request through vendor completion, send a notice, and see it all filed.

## Phase 2 — Money
- [ ] Stripe Connect: tenant ACH (free) and card (fee disclosed first), autopay, returned payments + NSF, receipts
- [ ] Plaid bank feeds, property → account mapping (trust warning), bank reconciliation
- [ ] Bills: inbound email invoices read and coded by AI (approval required), pay by ACH/check/card, pay all scheduled; recurring bills
- [ ] Owner statements and monthly distribution run split by ownership %, ACH payouts; owner portal (statements, distributions, documents)
- [ ] Native e-sign (templates, signer order, typed signature, UETA consent, audit trail, signed PDF filing); lease templates that fill from the unit and add required addenda
- [ ] Move-out workflow and final account statement (Fla. 83.49), inspections & deposits with AI-suggested deductions and deadline tracking
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
