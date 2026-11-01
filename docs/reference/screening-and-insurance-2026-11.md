# Parcel Manage: Cutting Screening Cost, and Lemonade vs Sure

Prepared for SIM REI Property Management (about 60 units, Eustis FL, 3–6 applications a month). Research date: **2026-11-01**. This report builds on `costs-and-insurance.md` and does not repeat it.

How the prices are labelled:
- **[V 2026-11-01]**: read from the vendor's own page today.
- **[3P, date]**: from a third-party review or aggregator. Treat as indicative only.
- **"Not public"**: the vendor publishes no price, so you have to ask sales.

No numbers were guessed. Where sources conflict, both figures are shown.

---

## Summary

- **AppFolio's current price is already low.** It costs $22 per screening plus $8 for ID verification, so $30 per adult. No retail option that includes a full credit report beats $22 when the landlord pays.
  - Cheapest landlord-paid package with full credit, eviction and criminal: **Checkr Tenant "Essential" at $34.99**, with no monthly fee [V 2026-11-01].
  - With Stripe Identity added ($1.50), that is **$36.49 per adult**.
- **To get SIM REI's cost to $0, the applicant has to pay the bureau directly.** Three options do this:
  - **TransUnion SmartMove SmartCheck Plus**: $40–42. TransUnion's own pages show both $40 and $42.
  - **Checkr Tenant Essential** in "applicant pays" mode: $34.99.
  - **Zillow/Experian Connect**: $35, and the report can be reused across Zillow listings for 30 days.
- **The $75-per-adult application fee already covers any of these**, so SIM REI's real cost is $0 net whichever way you go. At 5 adult applicants a month:
  - Today: $375 in fees − $150 to AppFolio = **$225 kept**.
  - Checkr, landlord-paid: $375 − $182 = **$193 kept**.
  - SmartMove, applicant-paid, with the $75 fee unchanged: **$375 kept**, but each applicant pays about $117 in total.
  - Alternatively, cut your own fee to about $35 so the applicant's total stays at about $75.
- **Wholesale and API access to the bureaus doesn't make sense at 5 applications a month.** TransUnion ShareAble, Experian's platform products, CRS, Plaid Check, Argyle, Truework, Snappt and Findigs all require a sales contract and publish no per-report price.
  - Full credit reports also require a one-time **$50 site inspection** by all three bureaus (Rentec Direct, updated 27 Jul 2026).
  - The cheap path is a hosted applicant-pays flow, or Checkr's API at retail price.
- **Florida law:** there is no statutory cap or refund rule for application fees. § 83.425 now **preempts** local rules on screening and application fees, so local ordinances cannot add any. The FCRA still applies: permissible purpose, an adverse action notice for any denial *or* conditional approval, and secure disposal of reports.
- **Insurance:**
  - **Use Sure first.** It is the only one of the two that offers HO-4 renters policies embedded in the lease flow, Verify AI to check policies tenants bring from other insurers, lapse alerts, and **Tenant Legal Liability (TLL) to replace AppFolio's $10.50 LLIP**.
    - Before you build, confirm that Sure's *renters* product is sold in Florida. No source confirms it.
  - **Lemonade** is confirmed live in Florida and is cheap: an average of $201 a year for $100k liability (LendingTree, Sept 2024). Offer it as an optional consumer link.
  - Neither vendor publishes a revenue share. Florida § 626.112(8) blocks sale-contingent payments to unlicensed persons.

---

## 1. Screening options table

Prices are per applicant/report. "Landlord cost" means SIM REI's out-of-pocket cost.

### 1a. Hosted, applicant-pays (SIM REI can pay $0)

| Option | What the applicant pays | What SIM REI pays | Contents | How it fits Parcel Manage | Source / date |
|---|---|---|---|---|---|
| **TransUnion SmartMove** | SmartCheck Plus **$42** on /pricing, **$40** on the homepage. Both say "plus tax where applicable". Basic $25, Premium $49. | **$0** if you choose applicant-pays ("where permitted") | Plus tier: ResidentScore, criminal, credit, eviction. Premium adds Income Insights and Identity Check. | **Link-out only.** The landlord sends an invite by email from SmartMove. No official public API or partner program was found. | mysmartmove.com/pricing [V 2026-11-01] ($42). Homepage search snippet [V 2026-11-01] ($40). |
| **Checkr Tenant** (launched 10 Sep 2026) | **Starter $24.99** (criminal only), **Essential $34.99** (adds credit and eviction), **Complete $44.99** (adds bank-verified income and assets). ID verification ("Identity Intelligence") is **+$3.95**. | **$0** with applicant-pays ("Free for landlords if applicants are selected to pay"). No monthly fee, contract or subscription. | Eviction data covers 49 states (not SD). | **Best fit.** Checkr says Tenant features are "fully accessible via API", with an MCP and a Yardi integration rolling out. **Partner pricing is custom**, so the price through the API at retail rates is not confirmed. | tenant.checkr.com/landlords/start-screening and /businesses/talk-to-sales [V 2026-11-01]. Checkr press release, Sep 2026. |
| **Zillow application + Experian Connect** | **$35**. It covers "an unlimited number of participating rentals for 30 days" on Zillow. | **$0** ("free for landlords and property managers") | Experian credit report, CIC background check (criminal, sex offender, housing court), Zillow residence history, income/employment check | **Zillow-hosted only.** It works only for units listed on Zillow, and the application runs on Zillow, not in your portal. Experian has a separate "Experian API" for businesses (not public). | experian.com/connect [V 2026-11-01]. Zillow tenant-screening page [V, via search]. |
| **RentSpree** | **$39.99** standard; **$49.99** comprehensive (adds bank-verified income and references). Third-party sources say $30–38 [3P 2026]. | $0 if the applicant pays | TransUnion data | Enterprise partner API sold through a demo form. No public docs. Mostly deployed with MLSs and brokerages. | RentSpree pricing via search [V, 2026]. supergood.ai API report [3P]. |
| **Avail (Realtor.com)** | $30–55 depending on state and package; full package $55 | $0 if the applicant pays | Powered by TransUnion | No integration. You would have to use Avail itself. | avail.com and Avail community posts [V/3P, 2026] |
| **RentPrep (via Stessa)** | $30 credit only; **$55** full package (tenant-paid) | $0 if the applicant pays | — | No current official price page | askdoss / LeaseRunner [3P 2026] |
| **VerticalRent** | Criminal **$5**, eviction **$5**, ID verification **$5**. Platinum is $5/mo with 1 report included. | $0 if the applicant pays (optional) | **No credit report**: "not live"; TransUnion and Experian are not available. Data comes from Data Divers / DX Data Exchange. | Has an "API Docs" link in the footer (not reviewed) | verticalrent.com/tenant-screening [V 2026-11-01] |

### 1b. Wholesale / API / point products (for Parcel Manage as a platform)

| Vendor | What it is | Per-report price | Minimums / gating | Source / date |
|---|---|---|---|---|
| **TransUnion ShareAble for Rentals** | Consumer-initiated credit report delivered by API (TransUnion Rental Screening Solutions) | **Not public**. The only "ShareAble" price found is for ShareAble for **Hires**, a different product. | Software providers go through TransUnion's **Platform Integration Management** team: agreements first, then a **test subscriber code**. No small-partner program was found, and the US product page is not public; the product page found is Canadian. | transunion.ca product page; techservices.transunion.com vendor FAQ [V, via search 2026-11-01] |
| **Experian (RentBureau / Connect API / embedded screening)** | Rental payment bureau plus embedded screening for proptech | **Not public** | "Partner with us" business inquiry form. Separate flows for portfolios under and over 25 units. | experian.com/rental-property-solutions [V 2026-11-01] |
| **Equifax** | No direct small-landlord product found. Equifax data reaches landlords through resellers. | Not public | Reseller credentialing | — |
| **CRS Credit API** | Raw tri-bureau credit, criminal and eviction data through one API | **Not public** ("Contact sales"). CRS's own blog estimates a *market* range of $25–75 per applicant, which is not its rate card. | Credentialing required. Prior research found "no monthly minimums for most products". | crscreditapi.com/tenant-screening [V, via search 2026-11-01] |
| **Checkr (Business/Partner)** | Same Tenant product, sold to platforms | "Enterprise and partner pricing is custom" | Demo required | tenant.checkr.com/businesses/talk-to-sales [V 2026-11-01] |
| **Certn** | Background checks (US) | 3P figures: US base criminal $17.99, credit $9.50; entry price $13.99. **Sources conflict.** | 3P says no setup fee and no minimums | zoftwarehub / costbench [3P 2026] |
| **SingleKey** | Canadian tenant screening (uses Equifax Canada and Certn) | From $29.99 [3P]. No US API was confirmed. | — | altss.com / Ivey profile [3P] |
| **Plaid Check Consumer Report** (income + bank) | A consumer reporting agency (CRA) product: base report, income insights | **Not public.** Billed as a flat fee per successful call. Plaid's docs say Plaid Check is "only via Custom plans" (another Plaid page says Growth *or* Custom). Vendr's median spend across all Plaid products is **$9,000 a year** [3P]. | Custom contract | plaid.com/docs/account/billing [V, via search 2026-11-01] |
| **Argyle** (payroll income) | Usage-based | **Not public** | Contact sales | argyle.com [V] |
| **Truework** (income/employment) | Mortgage-oriented | 3P: $42.95–64.95 per income/employment report. One 3P source says enterprise commitments start at $1,000/mo. Checkr's own "Mortgage" product lists **$59.95** (employment) and **$64.95** (income + employment) [V 2026-11-01]. | — | softwarefinder / saasworthy [3P]; checkr.com/pricing [V] |
| **Snappt** (document fraud + income) | Per-applicant fee; the landlord can absorb it or pass it on | **Not public.** Small landlords get it through TenantCloud, or TurboTenant **Pro**. | Enterprise focus | BusinessWire Sep 2025; turbotenant.com [V/3P] |
| **Findigs** | Outsourced application processing for large operators | **Not public** (TrustRadius: "no setup fee") | Enterprise | trustradius [3P] |

**Takeaway:** at 3–6 applications a month, nothing in 1b is worth contracting for.
- **Income:** Checkr Complete ($44.99) already includes bank-verified income.
- **Fraud:** Checkr Identity Intelligence (+$3.95) and Stripe Identity ($1.50, from prior research) cover identity fraud.
- Revisit ShareAble, Plaid Check or CRS only if Parcel Manage is later sold to other landlords at volume.

---

## 2. Recommended screening setup, with the math

### Recommended: Checkr Tenant through the API, with the applicant charged inside your app

1. The applicant pays SIM REI's application fee in Parcel Manage (Stripe).
2. Parcel Manage orders **Checkr Tenant Essential ($34.99)** through the API. SIM REI's own Checkr account is the end user and certifies permissible purpose.
3. Identity: either Stripe Identity ($1.50), or Checkr's +$3.95 add-on if you want ID verification and the credit report in one place.
4. The result is stored against the application. The adverse action notice is generated from a template (see section 3).

Two fallbacks:
- **Zero integration:** a **SmartMove** or **Checkr** applicant-pays invite link launched from the application page.
- **Zillow-sourced leads:** accept the applicant's existing **Zillow/Experian $35** report.

### Math at 5 applications a month

Assumptions:
- 5 adult applicants a month.
- $75 application fee per adult. The $85 admin fee is left out because it is not clear whether it is charged at application or at approval; if it is charged at application, add $425 of revenue to every scenario.
- 1 ID check per adult.

| Scenario | SIM REI cost per adult | SIM REI cost per month | Applicant pays (per adult) | SIM REI keeps per month (fees − cost) |
|---|---|---|---|---|
| **Today: AppFolio** ($22 + $8) | $30.00 | **$150.00** | $75 | **$225.00** |
| **A. Checkr Essential + Stripe Identity, landlord-paid from the $75** | $36.49 | **$182.45** | $75 | **$192.55** |
| A2. Checkr Essential + Checkr ID ($3.95), landlord-paid | $38.94 | $194.70 | $75 | $180.30 |
| **B. SmartMove Plus, applicant-paid, $75 fee kept** | $0 (+$1.50 if you add Stripe Identity) | **$0–7.50** | $75 + $40–42 = **$115–117** | **$367.50–375** |
| **B2. SmartMove Plus, applicant-paid, SIM REI fee cut to $35** | $0 | $0 | $35 + $40–42 = **$75–77** (the same as today) | $175 |
| C. Checkr Essential, applicant-paid, fee cut to $40 | $0 | $0 | $40 + $34.99 = **$74.99** | $200 |
| D. Zillow/Experian applicant-paid, fee cut to $40 | $0 | $0 | $40 + $35 = $75 | $200 |

What the table shows:
- **The $75 fee already covers screening several times over.** At $36–39 per adult, it covers the report and ID with about $36 to spare. SIM REI's real screening cost is therefore **$0 net** under every option.
- **Applicant-pays only "saves" money if you also keep the $75 fee (B).** That raises the applicant's total to about $117, which is a fairness and marketing question rather than a legal one: Florida sets no cap.
- **Getting "way down" really means two things:**
  - (1) Stop paying AppFolio's markup on the platform. AppFolio's $22 is actually a *low* wholesale price; the saving comes from cancelling AppFolio, not from the report price.
  - (2) Decide how much of the $75 to keep.
- **AppFolio's $22 can only be beaten with a negotiated partner contract.** Ask Checkr and CRS for partner rates (open questions 1–2). No public price is lower.

---

## 3. Compliance notes

Not legal advice. Have SIM REI's Florida attorney review this.

### FCRA (federal)

Source: FTC, "Using Consumer Reports: What Landlords Need to Know" [V 2026-11-01].
- **Permissible purpose:** pull reports only on applicants and renewing tenants, or with written permission. You certify to the consumer reporting agency (CRA) that the report is for housing use. Collect an e-signed authorization in the application.
- **Adverse action notice:** required for a denial, **and also** when you require a co-signer, a larger deposit or higher rent "based even partly" on the report.
  - The notice must include the CRA's name, address and phone number.
  - It must state that the CRA did not make the decision.
  - It must explain the right to a free report within 60 days and the right to dispute.
  - If a credit score was used, it must also give the score, a description of it and the key factors.
  - **Build this as an automatic letter in Parcel Manage**, triggered whenever an application is denied or conditionally approved.
- **Disposal Rule:** shred or securely destroy reports. In software terms: restrict access, encrypt, and set a retention period and deletion policy for screening PDFs in Supabase storage.
- **Furnisher Rule:** applies if SIM REI ever reports rent payments or evictions to a CRA.
- **Platform caution:** if Parcel Manage (the software company) buys reports and passes them to other landlords, it risks being treated as a **reseller or CRA** under the FCRA. Keep **each landlord as the CRA's end-user customer**, with its own Checkr or SmartMove account, or use applicant-pays links.

### Florida

- **Application fees:** Chapter 83, Part II sets **no cap, refund, receipt or disclosure rule** for ordinary application or screening fees. 2025 bills on reusable reports (HB 43, SB 362) died. Source: ezel.ai Florida survey, statute checked 20 Jul 2026 [3P].
- **Preemption:** § 83.425 makes residential tenancies, **including tenant screening, rental applications and their fees**, a matter for the state. It "supersedes any local government regulations on matters covered under this part" (flsenate.gov 2025 statutes [V 2026-11-01]).
- **Servicemembers (§ 83.683):** process the application within **7 days**, and give written approval or denial with the reason. Otherwise you must lease to them if all other terms are met. Add a flag and SLA timer in Parcel Manage.
- **§ 83.491** (fee in lieu of a security deposit): if you ever offer it, you cannot deny an application because of the applicant's choice.
- **Data security:** Florida's § 501.171 (FIPA) requires reasonable security and breach notices for SSNs and similar data. This was not re-fetched today; confirm with counsel.
- **Fair housing:** apply your written screening criteria consistently. HUD and fair-housing rules on criminal-history screening still apply; follow your attorney's guidance on current HUD rules.

### Who requires credentialing or a site inspection

| Path | Inspection / credentialing |
|---|---|
| **Full credit report through a reseller** (Rentec Direct example) | **One-time $50 site inspection.** Rentec says "only Full Credit Reports require a site inspection", and lists all three bureaus. A home office is allowed if secure (lockable room or password-protected computer, locked storage or shredder); the inspector takes photos. A score-range "report card" needs no inspection (help.rentecdirect.com, updated 27 Jul 2026 [3P/reseller]). Other resellers say: **annual** inspection for a residential location, one-time for a commercial one; $50–67.20 [3P]. |
| **Direct bureau or API platform** (ShareAble, CRS, Experian) | Agreements, credentialing and test subscriber codes. Platform audits are likely (TransUnion vendor FAQ). |
| **Applicant-initiated** (SmartMove, Zillow/Experian Connect, Checkr applicant-pays) | No landlord site inspection is mentioned on their public pages. Checkr Essential includes a **full credit report**, so ask Checkr whether it requires an inspection (open question 1). |

---

## 4. Lemonade vs Sure

| | **Lemonade** | **Sure** |
|---|---|---|
| **Florida renters availability** | **Yes.** Florida is listed for Renters on lemonade.com/availability [V 2026-11-01]. Prior-loss eligibility in Florida was loosened from **4 Aug 2026** (new business) and **4 Dec 2026** (renewals) (Coverager [3P]). | **Not confirmed.** The renters page says a "live, filed renters program" exists in **50 of 51** jurisdictions but doesn't say which one is excluded [V 2026-11-01]. Sure's Florida news is about homeowners (SageSure, excess and surplus lines). |
| **Carrier / admitted status** | **Lemonade Insurance Company** (stock property/casualty insurer, "licensed… in all other states where Lemonade non-life insurance is available"). Distributed by Lemonade Insurance Agency, LLC (lemonade.com/legal-stuff [V 2026-11-01]). Florida certificate of authority not checked; verify with the Florida Office of Insurance Regulation. | **Sure is the broker/agency.** A Sure support article (modified 4 Feb 2025) says **Assurant** is the renters carrier. Third-party pages say Assurant renters is written by **American Bankers Insurance Co. of Florida**, a Florida-domiciled insurer. Sure's 2026 page instead says "our renters carriers on Sure's filed rates". **Conflict: confirm the Florida underwriter.** |
| **Typical Florida premium, $100k liability** | **$201/yr (~$17/mo)** average: $20k property, $500 deductible, **$100k liability**. Florida all-carrier average is $242 (LendingTree, published 20 Sep 2024 [3P]). Lemonade's default liability is $100k. | **No public Florida premium.** Assurant averaged **$225/yr** on the same LendingTree profile (Sep 2024 [3P]). Sure's standard form SU-RN-001 is $25k property / **$100k liability** / $250 deductible. Liability-only $9/mo and renters $14/mo were *sample* figures on Sure's site (prior research). |
| **Meets the lease's $100k liability requirement** | Yes, by default | Yes. The standard form is $100k, "sized to each property's minimums". |
| **Integration type** | (a) Tracking link (affiliate). (b) Partner API for quote, bind and payment. Per a third-party report, docs sit behind **api-doc-portal.lemonade.com**, gated by due diligence and business review. lemonade.com/api gives no technical details [V 2026-11-01]. | Embeddable quote in the lease flow, plus a REST API. TurboTenant moved from Sure's **iFrame to its API** in Nov 2023, and bound policies rose about 30% in a week. Sure also offers **prebuilt connectors** for AppFolio, Yardi, RealPage, Buildium and Rentec, plus SDKs, a CLI and an **MCP** server [V 2026-11-01]. Public developer docs were not found; a third-party catalog lists api.sureapp.com, webhooks management and a sandbox. |
| **Quote and bind inside the portal** | Through the partner API, once approved | Yes. This is Sure's core property-management use case: "bound at lease signing". |
| **Landlord auto-added as interested party** | **Not documented.** The tenant adds it *after* purchase in the app or at lemonade.com. The interested party then gets cancel, renew and change notices; Lemonade never charges for it. Whether the API can set it is unknown. "Additional insured" is a separate, paid concept that Lemonade frames for co-residents. | **Not stated** on any Sure page. Sure says proof of coverage reaches the property manager "in 4 seconds or less" and the renter gets a PDF. |
| **Proof of coverage / cancellation notices to the platform** | Only the interested-party notices (by email or mail) to the landlord. No webhooks documented. | **Yes:** "Lapse alerts back to the PM the day a policy cancels". Verify (launched 13 Feb 2025) sends alerts on changes, cancellations and expirations for **any** carrier's policy. A webhook API exists per the third-party catalog, but event names are unconfirmed. |
| **Partner program** | lemonade.com/partners-program has a **"Property Managers"** track. You apply through an affiliate onboarding link. No requirements are listed. "Competitive partnership terms and commissions", with no rates given. | No self-serve program page; the /partners page returned 404 today. You "Book a walkthrough" or "Talk to Sure" (sureapp.com/company/contact). Groma, a customer, says it launched renters, verification and TLL "in under 30 days". |
| **Revenue share** | **Not public.** Affiliate payouts of $2.40–25.50 per sale have been reported [3P]; one affiliate tracker says **Florida traffic is excluded** (prior research). | **Not public.** No revenue share is mentioned anywhere. |
| **Florida § 626.112 / licensing** | Lemonade's agency is licensed. Paying SIM REI or Parcel Manage a commission that **depends on a sale** appears barred by § 626.112(8) unless the recipient is a licensed **insurance agency**. Flat, non-contingent fees may be OK. **Attorney to confirm.** | Same. Sure is the licensed brokerage, so SIM REI needs **no license to show a no-compensation embed**. Any revenue share would need a licensed agency structure. **Attorney to confirm.** |
| **Other relevant products** | No landlord, LLIP or verification product found. The availability page has a "Landlords" filter, but its status is unclear and no launch news was found. Lemonade Homeowners (via Homesite) is listed for Florida, which may matter for owner clients. | **Tenant Legal Liability** (the LLIP replacement): $100k per occurrence, $0 deductible, billed per unit only for enrolled units and charged to the resident ledger. You can add or remove units mid-term, and there are no setup costs. Higher limits ($200k/$300k) need 300+ units. **Price is not public on the current page.** Prior research found a sample of $12/unit/mo against AppFolio's $10.50. Florida filing for TLL is also not listed on today's page. **Verify AI** monitors every unit, including bring-your-own-carrier policies, and keeps a compliance ledger; verification-only pricing is not public. |
| **Developer docs** | api-doc-portal.lemonade.com (gated; 3P report); lemonade.com/api | sureapp.com/solutions/platform/apis (per a 3P catalog); sureapp.com/md/platform/* (markdown product pages) |

---

## 5. Recommendation

### Screening
1. Open a **Checkr Tenant** account for SIM REI now. It is self-serve with no monthly fee.
2. Use **Essential ($34.99)** paid by SIM REI out of the $75 fee, so the applicant pays one fee in one portal. Add Stripe Identity ($1.50).
3. In parallel, ask Checkr sales for **partner/API pricing** below $22 so you can match AppFolio's per-report price. Integrate through the API once there is a contract.
4. Until the API is built, send a **Checkr or SmartMove applicant-pays link** and lower SIM REI's own fee by the same amount so applicants pay about $75 in total.
5. Build the **adverse action letter**, the authorization e-signature and the **servicemember 7-day timer** into Parcel Manage before the first live application.

### Insurance

Use **Sure first, Lemonade as a second option for tenants.**
- **Why Sure first:**
  - It replaces three AppFolio pieces with one vendor: renters policies embedded in the portal, Verify for policies tenants bring from other insurers, and TLL for the LLIP.
  - It already has an AppFolio connector, which helps with migration.
  - It sends lapse alerts to the property manager, which is what drives the TLL auto-enroll and the recoverable charge.
- **Before building on Sure, confirm in writing:**
  - (a) Sure's *renters* product is sold in Florida, and by which carrier.
  - (b) TLL is filed in Florida, with the per-unit price for about 60 units.
  - (c) The landlord can be set as interested party through the API.
  - (d) Webhook event names.
- **Offer Lemonade as an optional "buy your own" link** (no compensation). It is confirmed in Florida and is among the cheapest there. Verify those policies with Sure Verify or the DIY upload-and-expiry tracker.
- **Take no insurance compensation in Florida** until counsel approves a licensed-agency structure (§ 626.112(8)).

---

## 6. Open questions / who to contact

| # | Question | Contact |
|---|---|---|
| 1 | **Checkr:** partner/API price per Essential report at about 60 reports a year? Is a site inspection required for the full credit report? Can the applicant pay through our Stripe checkout? FCRA end-user setup per landlord? | tenant.checkr.com/businesses/talk-to-sales |
| 2 | **CRS Credit API:** per-pull price for a tri-bureau soft pull plus eviction and criminal at small volume; minimums; credentialing steps | crscreditapi.com/tenant-screening (Contact sales) |
| 3 | **TransUnion:** is there a US ShareAble for Rentals partner program for small software vendors? Price and audit requirements? Confirm SmartCheck Plus at $40 vs $42. | TransUnion Platform Integration Management (techservices.transunion.com vendor FAQ); mysmartmove.com |
| 4 | **Experian:** embedded screening / Connect API pricing for portfolios under 25 units (they have a separate track) | experian.com/rental-property-solutions ("Partner with us" form) |
| 5 | **Plaid Check:** Consumer Report price per call on a Custom plan, and minimum annual commitment | plaid.com (sales) |
| 6 | **Sure:** Florida renters availability and carrier; Florida TLL filing and price at about 60 units; Verify price; interested-party auto-add; webhook docs and sandbox; any revenue share and its Florida legality | sureapp.com/company/contact; "Book a walkthrough" on sureapp.com/industries/property-management |
| 7 | **Lemonade:** Property Manager track terms; can the API add the landlord as interested party at bind? Are Florida policies eligible for partner compensation? | lemonade.com/partners-program |
| 8 | **Attorney:** § 626.112(8) compensation; FCRA adverse action template; whether Parcel Manage-as-vendor creates reseller status; FIPA data security; the $85 admin fee's timing and disclosure | SIM REI's Florida counsel |
| 9 | **Snappt / Argyle / Truework / Findigs:** only if fraud or income problems show up. All are "Not public". | snappt.com, argyle.com, truework.com, findigs.com |

### Sources (accessed 2026-11-01 unless noted)
- [SmartMove pricing](https://www.mysmartmove.com/pricing)
- [SmartMove home](https://mysmartmove.com/)
- [Checkr Tenant (landlords)](https://tenant.checkr.com/landlords/start-screening)
- [Checkr Tenant sales](https://tenant.checkr.com/businesses/talk-to-sales)
- [Checkr pricing](https://checkr.com/pricing)
- [Checkr tenant launch](https://checkr.com/resources/articles/checkr-launches-tenant-screening-platform)
- [Experian Connect / Zillow](https://www.experian.com/connect/)
- [Experian rental property solutions](https://www.experian.com/rental-property-solutions/index)
- [RentSpree upgrade](https://www.rentspree.com/upgrade)
- [supergood RentSpree](https://supergood.ai/api-report-card/rentspree)
- [Avail screening](https://www.avail.com/landlords/online-tenant-screening)
- [VerticalRent](https://www.verticalrent.com/tenant-screening)
- [askdoss 2026](https://askdoss.com/best-tenant-screening-services/)
- [TransUnion ShareAble (CA)](https://www.transunion.ca/product/shareable-for-rentals)
- [TransUnion vendor FAQ](https://techservices.transunion.com/system-coding/vendor-channel-faq)
- [CRS tenant screening](https://crscreditapi.com/tenant-screening/)
- [Plaid billing docs](https://plaid.com/docs/account/billing)
- [Vendr Plaid](https://www.vendr.com/marketplace/plaid)
- [Certn 3P](https://zoftwarehub.com/products/certn/pricing)
- [Truework 3P](https://softwarefinder.com/hr/truework)
- [Snappt/TenantCloud](https://www.businesswire.com/news/home/20250910558211/en)
- [Rentec site inspection](https://help.rentecdirect.com/article/827-site-inspection-for-credit-reports)
- [FTC landlords](https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-landlords-need-know)
- [Fla. Stat. 83.425](https://www.flsenate.gov/Laws/Statutes/2025/83.425)
- [ezel.ai FL fee survey](https://ezel.ai/surveys/rental-application-screening-fee-requirements/florida)
- [Lemonade availability](https://www.lemonade.com/availability)
- [Lemonade legal](https://www.lemonade.com/legal-stuff)
- [Lemonade API](https://www.lemonade.com/api)
- [Lemonade partners](https://www.lemonade.com/partners-program)
- [Lemonade interested party](https://lemonade.com/renters/explained/interested-party)
- [LendingTree FL renters (Sep 2024)](https://www.lendingtree.com/renters-insurance/florida-renters-insurance/)
- [Sure renters](https://www.sureapp.com/md/products/renters)
- [Sure PM](https://www.sureapp.com/md/industries/property-management)
- [Sure TLL](https://www.sureapp.com/md/products/tenant-legal-liability)
- [Sure Verify launch](https://www.sureapp.com/md/newsroom/press-release-sure-launches-sure-verify-to-transform-insurance-coverage-verification-for-property-management-industry)
- [Sure/TurboTenant API](https://www.sureapp.com/md/newsroom/press-release-turbotenant-increases-renters-insurance-adoption-by-30-in-one-week-using-sures-api)
- [Sure–Assurant support article](https://support.sureapp.com/support/solutions/articles/156000157855-what-is-the-relationship-between-sure-and-assurant-)
- [Sure API catalog (3P)](https://raw.githubusercontent.com/api-evangelist/sure/refs/heads/main/apis.yml)
- [Lemonade API (3P)](https://supergood.ai/api-report-card/lemonade)
