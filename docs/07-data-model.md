# 07 — Data model (plain English)

The starting schema is in `supabase/migrations/0001_core.sql`. Claude Code should extend it phase by phase with new migrations (never edit an applied migration).

## Tenancy and people
- **company** — a property management company (SIM REI is the first). Has a unique `subdomain` (SIM REI: `simreipm`) that routes `<subdomain>.parcelmanage.com` to it. Holds settings (business rules JSON validated by Zod, branding, phones, time zone).
- **profile** — a login (Supabase auth user), created automatically on sign-up; teammates at the same company can see each other's profile. **membership** links a profile to a company with a role, a title (editable, used on letters) and property access. **invitation** holds an emailed invite (email, role, title, property access, hashed link token, 7-day expiry) until the person signs in and accepts it. `create_company()` makes a new company with the caller as admin; `accept_invitation()` turns an invite into a membership.
- **contact** — any person or business the company deals with (tenant, applicant, owner, vendor contact, emergency contact). Portal users link a profile to a contact.

## Portfolio
- **entity** — legal owner (LLC/corp) with its own books, bank accounts and tax ID.
- **property** — belongs to an entity; type; address; county.
- **property_owner** — ownership % of an owner (contact) in a property (e.g. 35 / 32.5 / 32.5).
- **unit** — belongs to a property; `kind` residential/commercial (drives applications and lease templates); market rent; status.
- **loan**, **insurance_policy** (property level).

## Leasing and tenancy
- **guest_card** (prospect + desired unit, source, showing status), **showing**.
- **application** (unit, type, status pipeline, fees paid, household group), **application_member** (each adult, invited/applied), **screening_report** (provider, result, decision, deposit tier, adverse action sent).
- **lease** (unit, dates, term months, rent, deposit, short-term surcharge, status), **lease_tenant** (contacts on the lease, primary flag).
- **tenant_profile_item** tables: **emergency_contact**, **vehicle** (make/model, color, tag number, state, parking permit #, updated_by source), **renters_insurance** (carrier, policy, expires, liability, interested party, document).
- **notice_to_vacate**, **move_out** (charges, statement, refund).

## Money (double-entry)
- **gl_account** (chart of accounts per company: number, name, type, section heading, Schedule E tax_line, system = posted to by the app and can't be hidden, active = offered for new entries; standard list in `ensure_chart_of_accounts`, migration 0062), **journal_entry** (date, entity, memo, source, status draft/posted/reversed, reversal_of; only drafts can be edited or deleted, a posted entry can only be marked reversed), **journal_line** (account, property, unit, debit_cents, credit_cents). A database check/trigger enforces debits = credits on post.
- **charge** (tenant ledger charge: rent, late fee, pet rent, NSF, false-emergency charge, move-out charge…) and **payment** (method, processor ids, status, returned) both post journal entries.
- **bank_account** (entity, type operating/trust/reserve, Plaid ids), **property_bank_map** (rent → account, deposits → trust, bills → account), **bank_transaction** (from Plaid), **reconciliation**.
- **vendor** (contact, trade, W-9, COI expiry, 1099), **bill** (+ **bill_line**), **recurring_bill**, **owner_distribution** (+ lines per owner).

## Operations
- **work_order** (number counting up per company, unit, category/item/symptom ids from the triage tree, answers JSON, priority, emergency acknowledgment JSON, room, entry ok, pets, AI summary, vendor, scheduled window, technician arrival time, status), **work_order_event** (timeline), **work_order_notification** (email/text to vendor with delivery status), **photo** (storage path, linked record).
- **recurring_maintenance**, **inspection** (+ **inspection_room**, photos, suggested deductions).
- **document** (storage path, category, linked tenant/lease/property/etc., source), **esign_envelope** (+ signers, audit events, signed file hash).
- **message** (channel email/sms/portal/chat, direction, thread, contact, sender membership, delivery status) and **letter_send** (template, recipients, via, sender name+title).
- **letter_template**, **lease_template**.

## AI, reports, platform
- **ai_connection** (company, provider, model, encrypted key ref, monthly limit, status), **ai_usage** (per call), **agent_action** (agent, action, reasoning, approval status), **approval_item**.
- **leasing_agent_settings**, **conversation** (prospect threads + escalation).
- **saved_report**, **scheduled_report**, **metric_target**, **metric_snapshot**.
- **api_key** (hashed), **webhook_endpoint**, **webhook_delivery**, **audit_log**.

## Security model
- Every business table has `company_id`; RLS: `company_id in (select company_id from membership where profile_id = auth.uid())`, narrowed by role and property access in policies or views.
- Portal users (tenants, vendors, owners) get separate policies limited to their own contact's records.
- Server-only operations (webhooks, scheduled jobs, AI agents) use the service role inside server code, always passing an explicit `company_id`.
