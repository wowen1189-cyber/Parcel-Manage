# Parcel Manage — build kit for Claude Code

Parcel Manage is property management software built to replace AppFolio. SIM REI is the first customer, and the product is built from day one to be sold to other property management companies for a monthly fee.

This folder is everything Claude Code needs to build the real app: the full spec, the business rules, the database starting point, and a phase-by-phase build plan. Claude Code reads `CLAUDE.md` automatically every time it starts in this folder.

---

## What you (Wesley) need to do

### 1. Setup

1. Keep this folder where it is (`Documents/Parcel Manage/parcel-manage`).
2. Open Claude Code in that folder. It reads `CLAUDE.md` automatically and knows what to build and in what order.
3. Claude Code will ask you to create or connect accounts as it needs them: GitHub, Supabase (a **new** project called `parcel-manage`), Vercel, and your Anthropic API key first. Stripe, Plaid, Twilio, TransUnion and Google Calendar come later in the build plan.

### 2. Your first message to Claude Code

Paste this:

> Read CLAUDE.md and everything in /docs. Then set up the project for Phase 0 in docs/08-build-plan.md: create the Next.js app, connect Supabase, apply the database migration, and get a login page and the empty app shell with the sidebar running on my computer. Ask me for anything you need, such as account keys. Stop when Phase 0's checklist is done and show me how to open it in my browser.

### 3. How to work with it, phase by phase

- Start each phase with: **"Start Phase N from docs/08-build-plan.md."**
- Claude Code builds, runs the tests, and tells you what to click to check it. Open it in your browser (it gives you a link like `http://localhost:3000`) and try it.
- Tell it what's wrong in plain words, the same way you've been reviewing the prototype.
- When a phase passes its checklist, say **"Commit and push this phase."** That saves it to GitHub, and Vercel puts it online automatically.
- Keep AppFolio running until Phase 4's switch-over checklist is done.

### 4. Add screenshots of the prototype (recommended)

Open the prototype on claude.ai ("Parcel Manage — Prototype"), click into each screen, and take screenshots (Cmd + Shift + 4, then drag). Save them into `prototype/screenshots/` with names like `manager-dashboard.png`, `tenant-portal-maintenance.png`, `leasing-agent-setup.png`. Claude Code can look at them to match the design. One screen per file is fine; you don't need every tab.

### 5. Rough timeline

Each phase is several focused Claude Code sessions. Phases 0–2 replace what you use AppFolio for every day; Phases 3–4 add everything AppFolio doesn't do, then switch over. Plan on weeks, not days, and review as you go.

---

## What's in this folder

| File | What it is |
|---|---|
| `CLAUDE.md` | Standing instructions Claude Code follows every session: stack, rules, how to work |
| `docs/01-product-spec.md` | Every feature, screen by screen |
| `docs/02-business-rules.md` | SIM REI's leasing criteria, fees, maintenance triage and emergency rules, Florida notice rules. These become **settings each company can change**, with SIM REI's values as the defaults |
| `docs/03-maintenance-triage.json` | The tenant-portal question tree: categories, questions, self-check tips, emergency rules |
| `docs/04-reports-and-metrics.md` | The 41-report library and the Metrics page, with formulas |
| `docs/05-integrations.md` | Every outside service, what it's for, and the keys it needs |
| `docs/06-design-system.md` | Parcel's colors, type and components |
| `docs/07-data-model.md` | How the data fits together, in plain English |
| `docs/08-build-plan.md` | Phases 0–4 with checklists |
| `supabase/migrations/0001_core.sql` | Starting database schema with company-level security |
| `prototype/` | The AI leasing agent screen source and your screenshots |
| `docs/reference/` | Official Florida landlord-tenant law (Chapter 83), saved from flsenate.gov |
| `docs/archive-spec-2026-10-27.md` | The original October spec, for reference |
