# CLAUDE.md — Parcel Manage

You are building **Parcel Manage**, property management software that replaces AppFolio. The owner is Wesley Owen (broker/owner, SIM REI, Eustis FL). He is not a developer: explain what you did and what to click in plain language, and ask him business questions, not technical ones.

## Product in one paragraph
A multi-company SaaS for property managers. SIM REI (owner-operator of its own portfolio across several LLCs, including a co-owned 20-unit building) is customer #1. Everything AppFolio Max does, included in one plan, plus: AI throughout (each company brings its own AI API key), an open REST API + webhooks + MCP server, a native e-signature flow, drag-and-drop dashboard tiles, a guided maintenance triage with AI self-check tips, and an AI leasing agent. Brand family: "Parcel" (Parcel Manage = this product).

Read these before writing code, and re-read the relevant one before each phase:
- `docs/01-product-spec.md` (features and screens)
- `docs/02-business-rules.md` and `docs/03-maintenance-triage.json` (rules; implement as configurable per company)
- `docs/04-reports-and-metrics.md`, `docs/05-integrations.md`, `docs/06-design-system.md`, `docs/07-data-model.md`
- `docs/08-build-plan.md` (what to build, in order, with acceptance checklists)
- `docs/reference/florida-chapter-83-landlord-tenant-2025.html` (official Florida landlord-tenant law, saved Nov 1, 2026 from flsenate.gov; check notices, entry and deposit rules against it)
- `prototype/screenshots/*` if present, and `prototype/LeasingAgent.dc.html` (a working prototype screen; its `renderVals()` script shows the intended behavior)

## Stack (decided — don't change without asking)
- **Next.js (App Router) + TypeScript (strict)**, React Server Components where sensible
- **Tailwind CSS** with the tokens in `docs/06-design-system.md`; build small in-house components (no heavy UI kit). Font: Archivo (Google Fonts)
- **Supabase**: Postgres, Auth (email magic link + password), Storage (documents, photos), Row Level Security, scheduled jobs (pg_cron or Supabase scheduled functions)
- **Vercel** hosting; GitHub repo `parcel-manage`; preview deploy per branch
- **Zod** for validation, **supabase-js typed client** (chosen in Phase 0: it works directly with Row Level Security; types in `lib/supabase/database.types.ts`, regenerate with `npm run db:types`), **Vitest** for unit and database tests, **Playwright** for key end-to-end flows
- **Next.js 16**: read `node_modules/next/dist/docs/` before using an API (see `AGENTS.md`). Middleware is `proxy.ts`. Cache Components is off on purpose: nearly every screen is private and per-request
- Money: store as integer cents. Dates: store `date`/`timestamptz`; display in the company's time zone (SIM REI: America/New_York)
- Email: Resend. SMS: Twilio. Payments: Stripe Connect. Bank feeds: Plaid. Screening: Checkr Tenant (Wesley Owen, Nov 2, 2026; replaced TransUnion ShareAble). Calendar: Google Calendar API. AI: provider abstraction over Anthropic / OpenAI / Gemini / OpenAI-compatible, using **the company's own key**

## Non-negotiable rules
1. **Multi-company from day one.** Every business table has `company_id`. RLS policies restrict every row to members of that company. Never query without the company scope. Tenants, vendors and owners log into portals and see only their own records.
2. **Nothing is hard-coded to SIM REI.** Company name, phone numbers, fees, screening criteria, pet rules, lease terms, emergency rules, report targets, sender titles — all are company settings. SIM REI's values in `docs/02-business-rules.md` are seed data and defaults.
3. **AI is bring-your-own-key.** Keys are stored encrypted (Supabase Vault or pgsodium), never returned to the browser after saving, never logged. Each company sets a monthly AI spending limit; when reached, AI features pause and work routes to humans. If no key is connected, every AI feature degrades gracefully (the app still works without AI).
4. **Anything with money or legal weight needs approval.** AI agents draft; a person approves. Legal notices are never sent automatically. Every agent action is logged with its reasoning.
5. **Accounting integrity.** Double-entry: every financial event writes balanced journal lines. Posted entries are never edited or deleted, only reversed. Security deposits live in trust accounts separate from operating funds.
6. **Fair housing and consumer law.** Same criteria for every applicant. Adverse action notices when declining or charging a higher deposit based on a credit report (FCRA). Assistance animals are not pets (no pet fees/limits). Texts only to people who opted in; honor STOP. Card surcharges disclosed before payment; ACH is free to tenants.
7. **Audit everything.** Create/update/delete on business records writes to `audit_log` (who, when, before/after).
8. **Accessibility.** Real buttons, labels on inputs, 44px touch targets, 4.5:1 contrast. Tenant and vendor portals are mobile-first.
9. **Follow the law, and check it every time.** Before building or changing anything that touches Florida landlord-tenant law (notices and deadlines, entry, security deposits, late fees, rent, move-out, evictions, abandoned property, lease terms, fair housing), read the matching section of `docs/reference/florida-chapter-83-landlord-tenant-2025.html` first. Where a doc and the statute disagree, the statute wins: stop and tell Wesley. Put the statute section in a code comment next to the rule (e.g. `// Fla. Stat. 83.53(2): 24 hours' notice, 7:30 AM–8:00 PM`), add a unit test for each deadline and limit, and show the section number to the user where it helps (letter templates, deadline trackers). The saved copy is a snapshot: if a section looks outdated, check flsenate.gov and tell Wesley.

## How to work with Wesley
- Work one phase at a time from `docs/08-build-plan.md`. At the start, restate the phase checklist; at the end, report what's done, what's not, and exactly what to click to check it.
- When you need a decision, ask one short question with a recommended option. When you need an account key, tell him which website, which page, and what to copy.
- Never put secrets in code or commit them. Use `.env.local` (git-ignored) and Vercel environment variables. Keep `.env.example` up to date.
- Run lint, type-check and tests before saying a phase is done. Seed realistic sample data so every screen can be clicked through.
- Commit in small, named steps. Push only when Wesley says so.
- If something in the docs conflicts or is unclear, ask instead of guessing. If you change a business rule, update `docs/02-business-rules.md` in the same commit.

## Conventions
- Folder layout: `app/(manager)/...`, `app/(tenant)/portal/...`, `app/(vendor)/vendor/...`, `app/(public)/apply/...`, `app/api/v1/...` (public REST API), `lib/` (domain logic, no UI), `lib/ai/` (provider abstraction + agents), `lib/integrations/<provider>/`, `components/`, `supabase/migrations/`.
- Domain logic lives in `lib/` with unit tests (rent and late fees, deposit tiers, screening decisions, triage priority, Florida notice deadlines, owner distribution splits).
- Every list screen: search, filters, CSV export. Every record: an activity timeline and documents.
- Copy style: plain, short sentences; no jargon; sentence-case headings.

## Running and checking the app
- `npm run dev`, then open **http://simreipm.localhost:3000** (each company has its own subdomain; plain `localhost:3000` is the main site).
- `npm run typecheck`, `npx eslint .`, `npm test` (unit), `npm run test:db` (database rules against the live Supabase project, using throwaway `zz-test-` users and companies that it deletes afterwards).
- SIM REI holds its **real** portfolio, imported from AppFolio with `npm run import:appfolio` (dry run; add `-- --commit`). Export files go in `imports/`, which is git-ignored: never commit them, and never copy real tenant names, phone numbers, addresses or door codes into tests or fixtures (use made-up data). Bank accounts and starting book balances: `npm run import:appfolio-financials` (preview; `-- --commit` adds bank accounts, name/bank/last 4 only; `--post-opening` posts opening entries and is money, so only after Wesley approves the preview). `npm run seed -- --reset` would delete SIM REI and is refused without `--delete-real-data`.
- Migrations: add a new numbered file in `supabase/migrations/` (never edit one that's applied), apply it to Supabase, and record it in `supabase_migrations.schema_migrations`. Then run `npm run db:types`.
- Data access: pages call `requireCompany()` from `lib/session.ts`, which resolves the company from the subdomain and checks membership. Service-role access (`lib/supabase/admin.ts`) is for server jobs only, always with an explicit `company_id`.
