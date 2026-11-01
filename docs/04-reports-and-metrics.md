# 04 — Reports and Metrics

## Principles
- **One report, many views.** Each report has options instead of separate variants: date range or "as of" date, 12-month columns, compare to a prior period or budget, by property / by entity / portfolio, summary or detail, cash or accrual (financial). This replaces roughly 115 AppFolio reports with 41.
- Every report: filters, drill-down to the transaction or record, export PDF / Excel / CSV, **Schedule email**, and shows "Replaces in AppFolio: …".
- Custom report builder: pick a data source (rent roll, accounts by entity, bills, work orders, tenants; add more sources over time), columns, group by, filter, sort; save to "My reports". The AI assistant can build one on request.
- Reports read from the same ledger and records as the app; never a separate copy of the data.

## Library (41)
| Group | Report | Replaces in AppFolio |
|---|---|---|
| Financial | Income statement | Income Statement, 12 Month, Comparative, Property Comparison, Date Range |
| | Balance sheet | Balance Sheet, Comparative, Property Comparison |
| | Cash flow | Cash Flow, 12 Month, Property Comparison, Cash Flow Detail |
| | General ledger | General Ledger, Journal Entry Register, Account Totals |
| | Trial balance | Trial Balance, Trial Balance by Property, Chart of Accounts |
| | Budget vs actual and forecast | Annual Budget Comparative, Annual Budget Forecast, Budget Comparative, Budget Property Comparison, Budget Detail |
| | Expenses by vendor and category | Expense Register, Expense Distribution, Credit Card Expense Detail |
| | Loans and debt service | Loans |
| | Fixed assets and depreciation | Fixed Assets |
| Banking | Bank account activity | Bank Account Activity, Directory, Association, Deposit Register, Check Register (all three) |
| | Security deposit trust reconciliation | Trust Account Balance, Trust Account Detail, Security Deposit Funds Detail |
| Rent and collections | Rent roll | Rent Roll, Rent Roll (Commercial), Rent Roll (Itemized), Gross Potential Rent |
| | Aged receivables and delinquency | Delinquency, Delinquency (As Of), Aged Receivable Detail, Tenant Unpaid Charges (+ Summary), Unpaid Balances by Month |
| | Tenant ledger | Tenant Ledger, Tenant Transactions Summary, Resident Financial Activity |
| | Payments received | Receivables Activity, Income Register |
| | Charges and fees | Charge Detail, Additional Fees, Late Fee Policy Comparison |
| | Payment plans | Payment Plans |
| | Collections and write-offs | Debt Collections Status, Eligible Debt Summary |
| Tenants and leases | Tenant directory | Tenant Directory, Tenant Vehicle Info, Insurance Enforcement (+ emergency contacts, text opt-in, tag numbers, parking permits) |
| | Lease expirations and renewals | Lease Expiration Detail by Month, Renewal Summary, Tenant Tickler, Lease History |
| | Move-ins and move-outs | Lease History (move dates), Unit Turn Detail (turn time) |
| | Resident surveys | Survey Responses |
| Leasing | Vacancy and availability | Unit Vacancy Detail, Occupancy Summary, Historical Advertised Rent |
| | Leasing funnel | Guest Card Inquiries, Guest Card Interests, Inactive Guest Card Interests, Leasing Funnel Performance, Leasing Summary, Showings, Leasing Agent Performance |
| | Applications and screening | Rental Applications, Screening Assessments, Screening Usage |
| | AI leasing agent | New |
| Maintenance and vendors | Work orders | Work Order, Billable Detail, Labor Summary, Recurring Work Order |
| | Inspections and unit turns | Inspection Detail, Unit Inspection, Unit Turn Detail |
| | Vendor directory and compliance | Vendor Directory (+ W-9 and insurance status) |
| | Vendor spend | Vendor Ledger, Vendor Ledger (Enhanced) |
| | Bills and aged payables | Aged Payables Summary, Bill Detail |
| | Projects and purchase orders | Project Budget Detail, Project Directory, Purchase Order |
| | Inventory and keys | Inventory Status, Inventory Usage, Keys Detail |
| Properties and owners | Properties and units | Property Directory, Property Group Directory, Unit Directory, Amenities by Property, Rentable Items |
| | Owner statements | Owner Statement, Owner Statement (Enhanced), Owner Withholdings |
| | Owner directory | Owner Directory |
| | Property insurance | Owner Insurance, Owner Insurance Audit |
| Tax | 1099s (owners and vendors) | Owner/Vendor 1099 Detail and Summary |
| | Schedule E by property | New: rental income and expenses by property for tax prep |
| Admin | Users and permissions | Users, User Roles and Permissions |
| | Delivery and import log | Email Delivery Errors, Import Variances, Merge Variances |

**Dropped on purpose:** AppFolio billing/usage diagnostics (Stack Usage, CheckSend, eCheck usage, Online Payables Payment Detail, Resident eCheck Fee Coverage, Insurance Marketing Credits, Insurance Usage, Premium Listing Billing Detail); Property Performance and Activities Summary (covered by Metrics). **Later, for selling to third-party managers:** corporate (management company) books — Corporate Property Transactions, Corporate Aged Receivable Detail, Customer Ledger — as an optional module with management-fee billing.

## Scheduled emails
Fields: report (any library report, saved custom report, or "Metrics summary"), properties (all or one), frequency (Daily, Weekly on Monday, Monthly on the 1st/5th/10th, Quarterly), format (PDF, Excel, CSV), recipients (team members, owners, or plain email addresses — no login needed), on/pause, remove. Email has the attachment and a secure link (expiring, read-only) to view live. SIM REI seeds: Owner statements → Grove Tower partners monthly on the 10th; Metrics summary → Wesley weekly; Aged receivables → Wesley and Nikki weekly; Income statement → bookkeeper monthly on the 5th.

## Metrics page
Each metric shows the current value (toggle: This month / Last 12 months), the company's target, status (On target / Watch within 10% / Off target), a 12-month bar trend, and a one-line explanation. **Targets and alert on/off are editable per company** (Edit targets and alerts). Off-target metrics with alerts on show a banner and notify the chosen people by email and text the day a metric turns red. Filter by property/entity.

| Group | Metric | Formula | Default target |
|---|---|---|---|
| Occupancy and leasing | Physical occupancy | leased units ÷ total units | ≥ 95% |
| | Average days vacant | mean days from move-out to next move-in (units turned in period) | ≤ 21 days |
| | Lead-to-lease conversion | signed leases ÷ new guest cards in period | ≥ 10% |
| | Renewal rate | renewals ÷ leases that reached end date | ≥ 70% |
| | Rent below market (loss to lease) | (market rent − lease rent) ÷ market rent, leased units | ≤ 3% |
| Rent and collections | Rent collected by the 5th | rent paid by the 5th ÷ rent charged for the month | ≥ 95% |
| | Delinquency | open rent balance ÷ monthly scheduled rent | ≤ 2% |
| | Autopay adoption | tenants with autopay ÷ active tenants | ≥ 75% |
| | Bad debt written off | write-offs YTD | ≤ $2,500 |
| Maintenance | Average days to complete | mean(completed_at − created_at), non-recurring | ≤ 3 days |
| | Emergency response time | mean(tech_arrived_at − created_at), emergency priority | ≤ 4 hrs |
| | Open work orders | count not completed | ≤ 5 |
| | Fixed by tenant self-check | requests closed via "That fixed it" ÷ requests started | ≥ 15% |
| | Repair cost per unit | repair GL spend YTD ÷ units | ≤ $700 |
| Financial | NOI (per property) | operating income − operating expenses | set per property |
| | Debt service coverage | NOI ÷ debt service | ≥ 1.25× |
| | Operating expense ratio | operating expenses ÷ operating income | ≤ 45% |
| | Cash in operating accounts | sum of operating bank balances | ≥ $50,000 |
| Residents and compliance | Renters insurance on file | tenants with active policy ÷ active tenants | 100% |
| | Emergency contact on file | tenants with ≥1 contact ÷ active tenants | 100% |
| | Opted in to texts | opted-in tenants ÷ active tenants | ≥ 80% |
| | Portal adoption | tenants who logged in within 90 days ÷ active tenants | ≥ 90% |
| AI leasing agent | Median first reply | median seconds to first agent reply | ≤ 60 sec |
| | Inquiries handled without staff | conversations never escalated ÷ conversations | ≥ 80% |
| | Showings booked by the agent | count in period | ≥ 4 / month |

Store daily snapshots of each metric (`metric_snapshot`) so trends are fast and history is preserved.
