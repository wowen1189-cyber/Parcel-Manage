# 05 — Integrations

Each integration lives in `lib/integrations/<name>/` behind a small interface, so it can be swapped or mocked in tests. Company-level credentials (e.g. its AI key, its Twilio number) are stored encrypted per company; platform-level keys live in environment variables. Build a sandbox/mock mode for every integration so the app runs end to end without real accounts.

| Service | Purpose | Phase | Level | What Wesley needs to do |
|---|---|---|---|---|
| **Supabase** | Database, auth, storage, RLS, scheduled jobs, Vault for secrets | 0 | Platform | Create a new project `parcel-manage`; give Claude Code the project URL, anon key and service role key |
| **Vercel** | Hosting, preview deploys, cron, company subdomains (`parcelmanage.com` + wildcard `*.parcelmanage.com`, already added) | 0 | Platform | Sign in with GitHub; import the repo; done: parcelmanage.com is registered with Vercel, so DNS is automatic |
| **GitHub** | Code repository | 0 | Platform | Create private repo `parcel-manage` |
| **AI provider (BYOK)** | All AI features | 1 | Per company | SIM REI: create an Anthropic API key at console.anthropic.com and paste it in Settings › AI connection (not in code) |
| **Resend** | Transactional email (notices, receipts, statements, scheduled reports), inbound email for invoices and Weblo summaries | 1 | Platform (+ per-company sending domain) | Verify the sending domain (e.g. simreipm.com) with DNS records. Inbound invoices: turn on receiving for the inbound domain (MX record), add a webhook for `email.received` to https://parcelmanage.com/api/email/inbound, and put its signing secret in `RESEND_WEBHOOK_SECRET`. Resend sends every received e-mail to every receiving webhook on the account, so each app ignores addresses that aren't its own. |
| **Stripe Connect** | Tenant ACH (free) and card (fee shown first) payments; owner ACH payouts; each company is its own connected account | 2 | Platform + per company | Create a Stripe platform account; SIM REI onboards as the first connected account. Confirm card fee rules with Stripe and an attorney (surcharge caps, no surcharge on debit) |
| **Plaid** | Bank feeds for reconciliation; instant bank verification for ACH | 2 | Platform | Apply for Plaid production access |
| **Twilio** | Two-way SMS with tenants, prospects and vendors; vendor dispatch texts; escalation texts | 3 | Platform account, per-company numbers | Create Twilio account; complete **A2P 10DLC** business registration for SIM REI (required for business texting; can take days to weeks); buy a local number |
| **Checkr Tenant** (decided Nov 2, 2026, replacing TransUnion ShareAble) | Credit, eviction and criminal screening; Checkr e-mails the applicant, who enters their own DOB/SSN with Checkr (Parcel Manage never handles them). Orders name each property company as the original requester; the ordering account pays. Default package Essential (company setting screening.checkrPackage). Results fill the screening box (provider "checkr", agency "Checkr, Inc." for FCRA notices); a person decides. API reference saved at docs/reference/checkr-tenant-api-v1.yaml | 3 | API key | Sign up at tenant.checkr.com, finish identity vetting, create a Test key in Developer settings and paste it into CHECKR_TENANT_API_KEY yourself; add a webhook to https://<domain>/api/checkr/webhook and paste its secret into CHECKR_WEBHOOK_SECRET. Going live: request production access, a live key, billing, a separate live webhook |
| **Calendars (self-serve, built Nov 2, 2026)** | Each person: a private subscription link of Parcel Manage dates (showings, repair visits, move-outs, lease ends, to-dos) for Google Calendar "From URL", Outlook or Apple; and their own calendars added by secret iCal address, shown on the Calendar page with double-booked showings flagged. No Google Cloud project needed | 3 | Per user, self-serve | Nothing to set up. A two-way Google Calendar API connection (creating events in Google) would need a Google Cloud project, OAuth consent screen and Google's app review |
| **Listing syndication** | Zillow Rental Network, Apartments.com, company site | 3 | Per company | Apply for feed access (Zillow listing feed / ILS partner) |
| **Weblo** | AI phone answering; call summaries emailed → parsed into work orders and messages | 3 | Per company | Forward Weblo summary emails to the company's inbound address; API later if Weblo offers one |
| **QuickBooks Online** | Optional sync/export for an outside bookkeeper | 4 | Per company | Connect via OAuth if the bookkeeper keeps using QuickBooks |
| **Lob** (or similar) | Certified and first-class mail for legal notices and deposit claims | 4 | Platform | Create account |
| **E-sign** | Built in (no vendor). Audit trail, typed signature, Florida UETA consent, tamper-evident PDF (hash + timestamp) | 2 | — | — |

## AI provider abstraction (`lib/ai/`)
- Providers: Anthropic (default model setting per company, e.g. `claude-sonnet-5-5`), OpenAI, Google Gemini, OpenAI-compatible (custom base URL). Model name is free text, validated by a test call.
- Each call records company, feature/agent, tokens, estimated cost, latency, outcome. Enforce the company's monthly spending limit; at the limit, pause AI features and route work to people.
- Tool use for agents goes through the same permission checks as the UI; actions with money or legal weight create approval items instead of executing.
- Prompts live in `lib/ai/prompts/` as versioned files; business rules are injected from company settings, never hard-coded.

## Public API, webhooks, MCP
- Built Nov 2, 2026: keys in Settings › API (scopes `read`, `write:work_orders`; SHA-256 at rest; 120 requests/minute/key); REST GET `/api/v1/{properties,units,leases,owners,vendors,work-orders}` (`limit` up to 200, `offset`, `property_id`) and POST `/api/v1/work-orders`; MCP server at `/api/mcp`. Never returned: door codes, access notes, tax IDs, bank details.
- REST `/api/v1/*` for properties, units, tenants, leases, charges, payments, journal entries, bills, vendors, work orders, documents, messages. Scoped API keys per integration (read / read-write / per-object), shown once, hashed at rest.
- Webhooks with signed payloads and retries: `payment.received`, `payment.returned`, `lease.signed`, `workorder.created`, `workorder.status_changed`, `bill.approved`, `application.submitted`, `screening.completed`, `metric.off_target`.
- MCP server exposing the same operations as tools (Phase 4).
