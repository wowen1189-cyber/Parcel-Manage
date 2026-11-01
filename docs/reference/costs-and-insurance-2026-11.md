# Parcel Manage: Direct-Provider Costs vs AppFolio, and Renters Insurance Integration

Prepared for SIM REI Property Management (about 60 units, Eustis FL). Research date: **2026-11-01**.

How the prices are labelled:
- **[Vendor, fetched 2026-11-01]**: read from the vendor's own pricing page or docs today.
- **[3rd-party, date]**: from a review or aggregator site. Treat these as indicative only.
- **Contact sales / not public**: the vendor publishes no price.

No numbers were guessed. Where only a range or an old price exists, the table says so.

---

## 1. Line-by-line: AppFolio vs running it yourself

### 1.1 FolioScreen ID Verification: AppFolio 1 × $8.00 = **$8.00**

| Provider | Price per check | Source / date | Monthly cost at 1 check | Notes |
|---|---|---|---|---|
| **Stripe Identity** (recommended) | $1.50 per document + selfie verification. Optional SSN lookup is +$0.50. | stripe.com/identity and stripe.com/pricing [Vendor, fetched 2026-11-01] | **$1.50** ($2.00 with SSN lookup) | No monthly minimum. Charged only when a verification completes. Already in your Stripe stack. |
| Veriff Essential | About $0.80 per check with a **$49/mo minimum** | Several 3rd-party sources [3rd-party, 2026]. TrustRadius lists $1.49 instead. I could not load veriff.com/pricing. | **$49** (the minimum dominates) | Poor fit at 1 to 5 checks a month. |
| Persona | Not public. One blog says about $1–2 per check. Aggregators list an "Essential" plan at about $250/mo. | withpersona.com/pricing returned 403. [3rd-party, Jun 2026] | Contact sales | Not worth it at this volume. |
| Plaid Identity Verification | Not public. Pricing page says "Included" on Pay-as-you-go but gives no dollar amount. | plaid.com/pricing [Vendor, fetched 2026-11-01] | Contact sales | Only consider if you end up on Plaid for everything else. |

**Recommendation:** Stripe Identity at about $1.50 per applicant.

### 1.2 FolioScreen Trusted Renter Essential: AppFolio 3 × $22.00 = **$66.00**

| Provider | Price per report | Source / date | Monthly cost at 3 reports | Notes |
|---|---|---|---|---|
| **TransUnion SmartMove** (recommended) | SmartCheck Basic $25 (ResidentScore + criminal). **SmartCheck Plus $42** (adds credit + eviction, so it matches AppFolio's bundle). SmartCheck Premium $49 (adds income and ID). | mysmartmove.com/pricing [Vendor, fetched 2026-11-01] | **$0 if the applicant pays** (SmartMove lets you "choose who pays (where permitted)"). **$126** if you pay at the $42 tier. | This is a hosted flow, not an API. You send the applicant an invite link from your app and store the result. |
| TransUnion ShareAble for Rentals (API) | Not public | transunion product page. No pricing found. | Contact sales | Real API, but gated behind partner credentialing. Overkill for 60 units. |
| RentPrep (now delivered via Stessa) | $49 credit + background (Oct 2024). About $55 full package, tenant-paid (2026 3rd-party). | rentprep.com reviews page (Oct 2024). Baselane and Work-club [3rd-party, 2026]. | $0 if the tenant pays. $147–165 if you pay. | Pricing page URL is gone, so the price is unconfirmed. |
| Experian Connect | $35 paid by the renter (Experian's Zillow-branded page). Older 3rd-party figure: $14.95. | experian.com/connect [Vendor, undated]. ButterflyMX [3rd-party, undated] | $0 to the landlord | The Experian Connect API exists, but its pricing is not public. |
| CRS Credit API | Not public. CRS says it has "no monthly minimums for most products". | crscreditapi.com [Vendor, undated] | Contact sales | Raw bureau data. You would need to build the adjudication yourself, and it brings FCRA compliance duties. |

**Key finding:** at retail, direct screening costs **more** per report ($42–49) than AppFolio's $22 wholesale rate. The do-it-yourself version only beats AppFolio if the **applicant pays** the screening fee directly to TransUnion or Experian. Most landlords already do this, and in your case it is likely already covered by the application fee AppFolio collects.

**Recommendation:** SmartMove SmartCheck Plus with applicant-pay. Experian Connect is the second choice.

### 1.3 "Risk Mitigation Services" (LLIP, recoverable from residents): AppFolio 16 × $10.50 = **$168.00**

AppFolio's version is FolioGuard "Smart Ensure", formerly the Liability to Landlord Insurance Program. To participate, the PM must hold a qualifying liability-to-landlord policy, for example through Stern Risk Partners (AppFolio pages, 2022).

| Provider | Price | Source / date | Monthly cost at 16 units | Notes |
|---|---|---|---|---|
| **Sure: Tenant Legal Liability** (recommended to quote) | Sample checkout shows **$12.00 per enrolled unit per month**: $100K per occurrence, $0 deductible. Sample portfolio: $10,422/mo for 940 units, which works out to about $11.09 per unit. | sureapp.com/products/tenant-legal-liability [Vendor, fetched 2026-11-01]. The page uses a "yourbrand.com" placeholder, so these are **example prices, not a quote**. | **About $192** at $12. About $177 at $11.09. | Filed in all 50 states **including FL**. Two pathways: (a) PM-placed, billed to the resident ledger, so the cost passes to the tenant; (b) landlord blanket, where "cannot be passed to the tenant". Includes Verify AI compliance tracking. No API or revenue share is described. |
| Broker market range | $8–12 per door per month charged to tenants | The Horton Group (broker) [3rd-party, undated] | $128–192 | Use this range to judge any quote. |
| Second Nature (Resident Benefits Package) | Residents pay **$20–80/mo** for the whole bundle, which includes master-policy insurance. The PM sets the price and keeps the margin. | secondnature.com/pricing [Vendor, via search 2026] | Not comparable. It is a bundle the resident pays. | Auto-enrolls residents in the master policy when their own policy lapses. This is the main **revenue** model in the market. |
| Effective Coverage / LeaseTrack (MSI) | Not public. LeaseTrack charges "a flat fee per enrolled unit"; the amount isn't given. | Rent Manager integration page [3rd-party, 2026] | Contact sales | |
| Assurant, Rhino/Jetty, Obie, Foremost, LeaseLock | No public LLIP price for independent landlords | | Contact sales | Obie and Steadily sell **owner** (landlord) policies, not LLIP. |

Revenue share benchmark: Propertyware's AssetProtect claims "about $36 per insured unit per year" of ancillary revenue (Propertyware marketing, 3rd-party).

**Recommendation:** get written quotes from Sure TLL and Effective Coverage/LeaseTrack, and ask a local broker for a liability-to-landlord policy. Keep charging residents who aren't insured a recoverable fee. Whether you may charge them **more** than the premium is a Florida question for counsel (see 3.3).

### 1.4 Owner / Vendor eCheck (ACH payouts): AppFolio 40 × $0.50 = **$20.00**

| Provider | Price | Source / date | Monthly cost at 40 | Notes |
|---|---|---|---|---|
| **Stripe Global Payouts (with Treasury)** | **First 50 domestic payouts a month included.** After that: ACH next-day $0.50, same-day $1.00, RTP $2.50, Fedwire $25. Platform fee is 0.05% only above $1M a month. | stripe.com/pricing [Vendor, fetched 2026-11-01]. An older docs page showed $1.50 for US local payouts, so confirm the price on your account. | **$0** (40 + 8 bill pays = 48, which is under the 50 allowance) | Requires a Stripe Treasury financial account. **See open question 3 on Florida trust/escrow rules** before holding owner funds there. |
| **Increase** | ACH origination $0.50 next-day or $2.00 same-day. Return $5, unauthorized return $15. | increase.com/pricing [Vendor, fetched 2026-11-01] | **$20** plus a monthly fee ("varies by use case", contact sales) | A real bank (Increase is a bank). Fits a trust-account model. |
| Stripe Connect payouts ("you handle pricing") | $2 per active account a month + **0.25% + $0.25 per payout** | stripe.com/connect/pricing [Vendor, fetched 2026-11-01] | A $5,000 owner draw costs $12.75 + $2. **Avoid for owner distributions.** | |
| Dwolla | Not public: "tailored to your transaction volume" | dwolla.com/pricing [Vendor, fetched 2026-11-01] | Contact sales | |
| Plaid Transfer | Not public. "Not included" on Pay-as-you-go. | plaid.com/pricing [Vendor, fetched 2026-11-01] | Contact sales | |
| Modern Treasury, Column | Not checked or not public | | Contact sales | Built for much larger volumes. |
| Your own bank (ACH origination / NACHA file) | Varies by bank | | Ask your bank | Often the cheapest option when you already hold trust accounts there. |

**Recommendation:** use your own trust bank's ACH origination or Increase ($0.50 each). Use Stripe Global Payouts if Treasury is acceptable for trust funds.

### 1.5 CheckSend (printed and mailed checks): AppFolio 8 × $1.85 = **$14.80**

| Provider | Price per check (incl. print + postage) | Source / date | Monthly cost at 8 | Notes |
|---|---|---|---|---|
| **Lob** (recommended) | Developer plan: $0/mo, checks **from $1.19**. Startup plan ($260/mo) brings the check price to $1.04. | lob.com/pricing [Vendor, fetched 2026-11-01] | **$9.52** | Prints checks drawn on **your** bank account. You still fund the account and should set up positive pay. |
| PostGrid | Starter plan: $0/mo, **$1.18** per check (8.5×11 MICR), + $0.21 per extra page. Up to 50 checks a month. | postgrid.com/pricing-print-mail [Vendor, fetched 2026-11-01] | **$9.44** | Equivalent to Lob. |
| Increase | $3.00 per check + $1.00 per extra page | increase.com/pricing [Vendor, fetched 2026-11-01] | $24.00 | Simplest if Increase is already your bank. |
| Stripe paper checks (Outbound Payments) | **Price not listed.** Feature is in preview. | docs.stripe.com paper-checks [Vendor, fetched 2026-11-01] | Unknown | |
| Checkbook.io | Business plan $2,000/mo. Per-item fees not public. | checkbook.io/pricing [Vendor, fetched 2026-11-01] | Not viable | |
| Treasury Prime, Deluxe | Not public | | Contact sales | |

### 1.6 Bill Pay: AppFolio 8 × $0.80 = **$6.40**

Bill Pay is just an outbound payment to a payee, so it uses the same rails as 1.4 (or 1.5 when the payee needs a paper check).
- Stripe Global Payouts: **$0** (inside the 50-payout allowance).
- Increase ACH: 8 × $0.50 = **$4.00**.
- By paper check: Lob at 8 × $1.19 = $9.52.

### 1.7 Premium Listings: AppFolio 3 × $10 − 1 refunded = **$20.00**

| Channel | Price | Source / date | Notes |
|---|---|---|---|
| **Zillow Rentals feed (for PMS vendors)** | **Free**: "There is no cost to participate in the program." | zillowgroup.com/developers rentals-feed-integrations [Vendor, fetched 2026-11-01] | Needs approval from Zillow's Rentals Integrations team, an XML feed (Zillow spec or MITS), and 4–6 weeks of testing. Reaches Zillow, Trulia and HotPads. |
| Zillow Rental Manager standard listing | Free | Zillow Rentals User Terms [Vendor] | |
| Zillow premium listing upgrade | One-time fee per listing. 3rd-party sources say $29.99 (older) or **$39.99 for up to 90 days**. | rfp.wiki and others [3rd-party, Jun 2026]. Zillow's own page does not state the amount. | More than AppFolio's $10, so only boost when a unit sits vacant. |
| Apartments.com | The feed is for **paid advertisers only**. The Digital Feeds Program requires approval and a contract. | Apartments.com help article on Buildium; apis.io [3rd-party, 2026] | Not free. |
| Zumper | "Free-to-market" ILS. Syndication goes through partners such as MRI VaultWare. | MRI press release [3rd-party, undated] | |
| Rentler | Not researched in depth | | |

**Estimated monthly cost: $0** with the free Zillow feed plus a self-hosted listings page. Optional boosts cost about $40 per listing.

### 1.8 Resident Per Unit eCheck Fees (tenant ACH rent): AppFolio 60 × $1.00 = **$60.00**

Assumptions: rent is $1,250, with about 60 payments a month.

| Provider | Per-payment cost on $1,250 | Source / date | Monthly cost (60 payments) | Notes |
|---|---|---|---|---|
| Stripe ACH Direct Debit | 0.8% = $10.00, **capped at $5.00** | stripe.com/pricing [Vendor, fetched 2026-11-01] | **$300.00** | **5× AppFolio.** One-time instant bank verification is $1.50 per tenant (micro-deposits are free). Failed payment $4 and dispute $15 come from 3rd-party sources, Oct 2026. |
| Stripe Connect (Stripe handles pricing) | Same $5.00. No extra platform fee. | stripe.com/connect/pricing [Vendor, fetched 2026-11-01] | $300.00 | |
| Stripe Connect (you handle pricing) | $5.00 + payout 0.25% + $0.25 ($3.375) + $2 per active account a month | stripe.com/connect/pricing [Vendor, fetched 2026-11-01] | About $500+ | Avoid. |
| **Increase ACH origination** (recommended) | **$0.50** next-day | increase.com/pricing [Vendor, fetched 2026-11-01] | **$30.00** + monthly fee (contact sales) | The page lists "ACH origination" without a separate debit price, so **confirm debits are priced the same.** Returns cost $5, or $15 if unauthorized. |
| Plaid Auth + Transfer | Not public | plaid.com/pricing [Vendor, fetched 2026-11-01] | Contact sales | Plaid's generic guide says ACH costs "$0.05–$5" per transaction. |
| Dwolla | Not public | dwolla.com/pricing [Vendor, fetched 2026-11-01] | Contact sales | |
| Own bank ACH origination | Varies (usually a per-file fee plus a per-item fee) | Ask your bank | Likely under $30 | Requires bank approval for ACH debit origination and a NACHA file. Account verification would come from Plaid Auth or Stripe Financial Connections ($1.50 per tenant once). |

**Key finding:** Stripe's capped ACH Direct Debit costs **$300 a month** for this portfolio, against AppFolio's flat $60. Use a per-item ACH originator (Increase or your bank) for rent. Stripe can stay for card payments and for Identity.

---

## 2. Totals (September 2026 invoice volumes)

| Line | AppFolio | DIY Scenario B: Increase/bank rails (recommended) | DIY Scenario A: all-Stripe |
|---|---|---|---|
| ID verification (1) | $8.00 | $1.50 (Stripe Identity) | $1.50 |
| Screening (3) | $66.00 | $0 (applicant pays SmartMove). $126 if landlord pays. | $0 / $126 |
| LLIP, recoverable (16) | $168.00 | ~$192 (Sure sample $12; market $8–12 → $128–192) | ~$192 |
| Owner/vendor ACH (40) | $20.00 | $20.00 (Increase) | $0 (Global Payouts allowance) |
| CheckSend (8) | $14.80 | $9.52 (Lob) | $9.52 (Lob; Stripe check price unknown) |
| Bill Pay (8) | $6.40 | $4.00 | $0 (allowance) |
| Premium listings | $20.00 | $0 (Zillow free feed) | $0 |
| Resident ACH (60) | $60.00 | $30.00 | $300.00 |
| **Total** | **$363.20** | **≈ $257** (+ Increase monthly fee, not public) | **≈ $503** |
| **Total excluding LLIP pass-through** | **$195.20** | **≈ $65** | **≈ $311** |

Notes on the totals:
- The DIY totals leave out the one-time $1.50 bank verification per new tenant (if instant verification is used) and any return fees.
- If screening is landlord-paid, add $126 to both DIY columns.
- The LLIP line is a pass-through in both cases: tenants reimburse it.
- Savings on the payments and fees lines (excluding LLIP) are about **$130/month (~$1,560/yr)** under Scenario B. That excludes AppFolio's base subscription, which was not on these lines.

---

## 3. Renters insurance integration options

Goal: a tenant buys a policy in the portal, the landlord is auto-listed as interested party, and proof is tracked.

| Provider | Florida availability | API / partner program | What the landlord earns or pays | Effort to integrate |
|---|---|---|---|---|
| **Lemonade** | **Yes**: live in FL (Sarasota Magazine May 2026; Lemonade FL city pages, Jan 2026). FL eligibility loosened from 4 Aug 2026 (Coverager). | Partner program has a "Property Managers" track and offers "tracking links or our APIs" (lemonade.com/partners-program, fetched 2026-11-01). The quote/bind/pay API is behind the partner portal. | **Not public**: "competitive partnership terms and commissions". Affiliate per-sale payouts range from **$2.40 to $25.50** depending on network (3rd-party). One tracker (affi.io) says renters traffic **from FL is excluded** from its affiliate payout. | Low with a tracking link; medium with the API. Interested-party auto-listing is **not documented**, so ask. |
| **Sure** | Yes (TLL filed in FL). Renters $14/mo, or $9 liability-only (sample). | Embeddable quote in PM platforms. Verify AI compliance tracking, auto-placement when a policy lapses, lapse alerts. Has an MCP; no public REST docs found. | Revenue share not stated | Medium. Best single vendor for HO4 + TLL + verification. |
| **Assurant** (Cover360 / multifamily) | Yes (national) | Integrated with Entrata, Yardi and RealPage. 3rd-party directory lists an "Assurant Global Housing API". | Not public | High. Built for large PMS vendors. |
| **Rhino + Jetty** (merged Feb 2025) | Yes. Jetty FL policies are underwritten by National Specialty Ins. Co. Rhino's renters coverage is via Cover Genius/Markel, from $12.50/mo. | Partner model with notifications when a tenant buys. No public API docs. | Jetty: PM "can receive marketing and promotional fees" | Medium. Unique URL per property. |
| **Second Nature (RBP)** | Yes (FL PMs use it) | Turnkey bundle. Master policy plus auto-enroll on lapse. | Resident pays $20–80/mo for the bundle. **PM keeps the margin.** | Low (outsourced). Mostly billing integration. |
| **Effective Coverage / LeaseTrack** (via MSI) | Yes (national) | Compliance tracking plus a master policy. Integrates with Rent Manager. | Flat fee per enrolled unit (amount not public) | Medium |
| **Obie / Steadily** | Yes (Steadily: $312M insured in FL) | APIs or partner landing pages | Steadily pays PMs referral compensation **per landlord referred** | These sell **landlord/owner** policies, **not renters**. Relevant for owner clients, not tenants. |
| Toggle, Rein | No useful results found | | | |
| **AppFolio FolioGuard** (for comparison) | Yes | Built in. Underwritten by Century-National, Cypress P&C, Trisura or Spinnaker by state. Sold by AppFolio Insurance Services, Inc. (a licensed agency). | AppFolio keeps the commission | n/a |

### 3.1 Compliance tracking (verifying tenants' own policies)

These products verify policies tenants buy elsewhere:
- **Sure Verify AI**: compliance dashboard, statuses, audit log.
- **LeaseTrack/MSI**
- **Second Nature**: auto-enrolls on lapse.
- **Assurant**: automatic coverage tracking in Entrata.
- **Beagle**: claims "~$15+/unit/mo" to the PM. That figure is the vendor's own marketing.

None of them publish verification-only pricing. "Renters Shield", "Sircon" (a Vertafore licensing database, not tenant verification) and "ChimneyTop" returned no relevant tenant-verification product.

**Low-cost DIY alternative:**
1. Require residents to list "SIM REI Property Management" as interested party.
2. Collect the declarations page as an upload.
3. Track the expiry date in Parcel Manage, with reminders.
4. Auto-enroll the tenant in the LLIP and bill the recoverable fee when no valid proof is on file.

This replicates what AppFolio does today.

### 3.2 Can Lemonade auto-list the landlord as interested party?

Not documented publicly. Lemonade consumer policies generally allow adding an interested party, but whether the partner API can set it is unverified. Ask Lemonade partnerships.

### 3.3 Florida licensing (**for the owner's attorney / insurance advisor to confirm. This is not legal advice.**)

- **§ 626.112(1)(a), F.S.**: no person may "be, act as, or advertise or hold himself or herself out to be an insurance agent… unless… currently licensed by the department and appointed" (flsenate.gov, fetched 2026-11-01).
  - Selling, quoting or "recommending" a specific policy for compensation risks being treated as unlicensed agent activity.
- **§ 626.112(8)**: a licensee may not pay "any fee or other consideration to an unlicensed person other than an insurance agency for the referral of prospective purchasers… which is in any way dependent upon whether the referral results in the purchase of an insurance product."
  - In practice, **per-sale commissions or CPA affiliate payouts to an unlicensed landlord or software company for FL renters policies appear prohibited.**
  - A DFS summary (Radey Law, 2016) says **non-contingent** referral payments (a flat fee not tied to a sale) may be permissible.
- **§ 626.9541** (unfair trade practices / inducements): a 2008 Department statement called payments for insurance referrals an illegal inducement. That statement is old, so check current enforcement.
- **Practical paths:**
  - (a) Take no insurance compensation and offer the integration as a tenant convenience.
  - (b) Accept only flat, non-contingent marketing fees (the model Jetty describes).
  - (c) Form or partner with a **licensed agency**. Payments to an "insurance agency" are excepted, which is how AppFolio Insurance Services and Second Nature Insurance Services operate.
- **Also for counsel:** whether marking up the LLIP recoverable charge above the actual premium is permissible in FL.

---

## 4. Recommendation

1. **Rent collection:** do **not** use Stripe ACH Direct Debit for rent. At the $5 cap it is $300/mo against AppFolio's $60. Use Increase (ACH at $0.50, ≈$30/mo) or your current trust bank's ACH origination. Use Plaid Auth or Stripe Financial Connections ($1.50 once per tenant) for bank verification. Keep Stripe for card payments (if offered, fee passed to the tenant where lawful) and for Stripe Identity.
2. **Payouts and bill pay:** use the same ACH rail (Increase or bank, about $0.50 each). Use Stripe Global Payouts (50 a month free) only if a Stripe Treasury account is acceptable for Florida trust funds.
3. **Checks:** use Lob or PostGrid at about $1.18–1.19 each, drawn on your trust account, with positive pay.
4. **ID verification:** Stripe Identity at $1.50.
5. **Screening:** TransUnion SmartMove SmartCheck Plus ($42), **applicant-paid**, launched via an invite link from the application flow.
6. **Listings:** apply for Zillow's free rentals feed now (4–6 week certification). Skip Apartments.com unless you pay to advertise there.
7. **LLIP:** get written quotes from Sure (TLL plus Verify AI) and Effective Coverage/LeaseTrack before cancelling AppFolio, so uninsured units are never uncovered. Continue the recoverable charge.
8. **Renters insurance in the portal:** start with a **no-compensation** Lemonade or Sure link plus the DIY proof-of-insurance tracker (upload, expiry, interested party, auto-enroll in LLIP). Add revenue only through a licensed-agency structure after counsel signs off.

Expected result: about **$65/mo** in transaction costs against AppFolio's **$195/mo** for the same lines (excluding the LLIP pass-through). The Increase monthly fee and screening payer are still unknown.

## 5. Open questions

1. **Increase:** what is the monthly platform fee for this use case, and are ACH **debits** priced at the $0.50 origination rate?
2. **Your current bank** (trust accounts): does it offer ACH debit origination, and at what per-file and per-item fees? This may beat every vendor.
3. **Florida trust/escrow rules** (FREC / Ch. 475 for broker-managed funds): can tenant and owner funds sit in a Stripe Treasury financial account or at Increase, or must they stay in a Florida bank trust account? This decides the Stripe Global Payouts option.
4. **Screening payer:** does SIM REI currently charge applicants an application fee that covers the $22 AppFolio screening? Are there Florida limits on application or screening fees to confirm?
5. **LLIP:** actual written quotes (Sure, Effective Coverage, broker). Is any markup over premium on the recoverable charge permissible in FL?
6. **Lemonade:** partner terms for FL property managers. Can the API auto-add an interested party? Is FL excluded from affiliate payouts, as one tracker reports?
7. **Stripe:** price of paper checks via Outbound Payments (currently unlisted, preview). Confirm the $0.50 ACH payout and 50-payout allowance on your account; an older docs page showed $1.50.
8. **Zillow:** confirm the current premium listing price inside Rental Manager ($29.99 vs $39.99 reported).
9. Veriff, Persona, Plaid, Dwolla, ShareAble for Rentals and CRS: all are contact-sales only. Only worth pursuing if volume grows.
10. **Florida § 626.112 / § 626.9541:** attorney or insurance advisor to confirm what, if any, compensation SIM REI or Parcel Manage may receive.

### Main sources (all accessed 2026-11-01 unless noted)
- [stripe.com/pricing](https://stripe.com/pricing)
- [stripe.com/connect/pricing](https://stripe.com/connect/pricing)
- [stripe.com/identity](https://stripe.com/identity)
- [stripe.com/financial-connections](https://stripe.com/financial-connections)
- [docs.stripe.com paper checks](https://docs.stripe.com/global-payouts/send-money/paper-checks)
- [increase.com/pricing](https://increase.com/pricing)
- [lob.com/pricing](https://www.lob.com/pricing)
- [postgrid.com/pricing-print-mail](https://www.postgrid.com/pricing-print-mail/)
- [checkbook.io/pricing](https://checkbook.io/pricing/)
- [dwolla.com/pricing](https://www.dwolla.com/pricing)
- [plaid.com/pricing](https://plaid.com/pricing/)
- [mysmartmove.com/pricing](https://www.mysmartmove.com/pricing)
- [Experian Connect](https://www.experian.com/connect/index)
- [RentPrep reviews (Oct 2024)](https://rentprep.com/rentprep-reviews/)
- [Baselane RentPrep alternatives](https://www.baselane.com/resources/rentprep-alternatives)
- [Veriff third-party pricing (didit.me)](https://didit.me/blog/didit-vs-veriff-differences/)
- [Zillow rentals feed](https://www.zillowgroup.com/developers/api/rentals/rentals-feed-integrations/)
- [Apartments.com feed via Buildium](https://propertyhelp.apartments.com/article/1177-how-do-i-connect-my-listing-to-apartments-com-using-buildium)
- [Sure TLL](https://sureapp.com/products/tenant-legal-liability)
- [Sure PM](https://www.sureapp.com/industries/property-management)
- [Horton Group TLL](https://www.thehortongroup.com/resources/tenant-legal-liability-why-would-i-care/)
- [Second Nature pricing](https://secondnature.com/pricing)
- [AppFolio insurance](https://www.appfolio.com/services/insurance)
- [Lemonade partners](https://www.lemonade.com/partners-program)
- [Sarasota Magazine FL renters 2026](https://www.sarasotamagazine.com/advantagepoint/2026/05/2026s-best-renters-insurance-plans-in-florida)
- [affi.io Lemonade](https://affi.io/m/lemonade)
- [Rhino/Jetty merger](https://coverager.com/rhino-and-jetty-merge/)
- [Steadily partners](https://www.steadily.com/partners)
- [Assurant/Entrata](https://assurant.com/newsroom-detail/NewsReleases/2019/April/assurant-renters-insurance-now-integrated-with-entrata-s-software-offering-for-property-managers)
- [Rent Manager renters insurance](https://www.rentmanager.com/renters-insurance/)
- [Fla. Stat. 626.112](https://www.flsenate.gov/Laws/Statutes/2025/626.112)
- [Radey Law DFS referral summary](https://www.radeylaw.com/2016/10/05/dfs-summarizes-referral-fee-restrictions/)
