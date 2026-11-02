import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BILL_STATUS } from "@/lib/bills";
import { normalBalance, type AccountBalance } from "@/lib/books";
import { contactName, PROPERTY_TYPE_LABEL } from "@/lib/format";
import { APPLICATION_STATUS, GUEST_SOURCES, GUEST_STATUS } from "@/lib/leasing";
import { aging, cashFlow, type CashLine, type Column } from "@/lib/report-math";
import type { Database } from "@/lib/supabase/database.types";

// The reports library (docs/04-reports-and-metrics.md). Each report reads the same records and ledger as the
// app (never a copy) and returns columns and rows; the page renders them and exports CSV.

type Db = SupabaseClient<Database>;
export type Filters = { from: string; to: string; asOf: string; owner: string; property: string };
export type ReportResult = { columns: Column[]; rows: Record<string, unknown>[]; totals?: Record<string, unknown>; note?: string };
export type ReportDef = {
  id: string;
  group: string;
  title: string;
  replaces: string;
  filters: ("range" | "asOf" | "owner" | "property")[];
  /** Date range defaults to the next 12 months instead of the year so far. */
  forward?: boolean;
  run?: (db: Db, companyId: string, f: Filters) => Promise<ReportResult>;
  /** For a report that isn't built yet: the records it's waiting for. */
  needs?: string;
};

const sum = (rows: Record<string, unknown>[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
const unitLabel = (u: { label: string; property: { name: string } }) => (u.label === "Home" || u.label === "House" ? u.property.name : `${u.property.name} ${u.label}`);
const tenantsOf = (lt: { role: string; is_primary?: boolean; contact: Parameters<typeof contactName>[0] }[]) =>
  lt
    .filter((t) => t.role === "tenant")
    .map((t) => contactName(t.contact))
    .join(", ");

async function balances(db: Db, companyId: string, entityId: string, from: string, to: string) {
  const { data } = await db.rpc("account_balances", { p_company: companyId, p_entity: entityId, p_from: from, p_to: to });
  return ((data ?? []) as AccountBalance[]).filter((b) => Number(b.debit_cents) || Number(b.credit_cents));
}

async function leasesFor(db: Db, companyId: string, f: Filters, statuses = ["active", "notice"]) {
  let q = db
    .from("lease")
    .select(
      "id, status, start_date, end_date, move_out_on, rent_cents, deposit_cents, opening_balance_cents, unit!inner(label, kind, beds, baths, market_rent_cents, property!inner(id, name, entity_id)), lease_tenant(role, is_primary, contact(kind, first_name, last_name, business_name, email, mobile, phone)), autopay(active)",
    )
    .eq("company_id", companyId)
    .in("status", statuses);
  if (f.property) q = q.eq("unit.property.id", f.property);
  if (f.owner) q = q.eq("unit.property.entity_id", f.owner);
  const { data } = await q;
  return data ?? [];
}

const financial = (title: string): Pick<ReportDef, "group" | "title"> => ({ group: "Financial", title });

export const REPORTS: ReportDef[] = [
  {
    id: "income-statement",
    ...financial("Income statement"),
    replaces: "Income Statement, 12 Month, Comparative, Property Comparison, Date Range",
    filters: ["range", "owner"],
    run: async (db, companyId, f) => {
      if (!f.owner) return { columns: [], rows: [], note: "Choose an owner: each owner keeps its own books." };
      const rows = (await balances(db, companyId, f.owner, f.from, f.to))
        .filter((b) => b.type === "income" || b.type === "expense")
        .sort((a, b) => a.number.localeCompare(b.number))
        .map((b) => ({ type: b.type === "income" ? "Income" : "Expense", account: `${b.number} ${b.name}`, amount: normalBalance(b) }));
      const income = sum(rows.filter((r) => r.type === "Income"), "amount");
      const expense = sum(rows.filter((r) => r.type === "Expense"), "amount");
      return { columns: [{ key: "type", label: "Type" }, { key: "account", label: "Account" }, { key: "amount", label: "Amount", kind: "money" }], rows, totals: { account: "Net income", amount: income - expense } };
    },
  },
  {
    id: "balance-sheet",
    ...financial("Balance sheet"),
    replaces: "Balance Sheet, Comparative, Property Comparison",
    filters: ["asOf", "owner"],
    run: async (db, companyId, f) => {
      if (!f.owner) return { columns: [], rows: [], note: "Choose an owner: each owner keeps its own books." };
      const all = await balances(db, companyId, f.owner, "1900-01-01", f.asOf);
      const ni = all.filter((b) => b.type === "income").reduce((s, b) => s + normalBalance(b), 0) - all.filter((b) => b.type === "expense").reduce((s, b) => s + normalBalance(b), 0);
      const label: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Equity" };
      const rows: Record<string, unknown>[] = all
        .filter((b) => label[b.type])
        .sort((a, b) => a.number.localeCompare(b.number))
        .map((b) => ({ type: label[b.type], account: `${b.number} ${b.name}${b.is_trust ? " (trust)" : ""}`, amount: normalBalance(b) }));
      if (ni) rows.push({ type: "Equity", account: "Net income to date", amount: ni });
      const assets = sum(rows.filter((r) => r.type === "Assets"), "amount");
      const le = sum(rows.filter((r) => r.type !== "Assets"), "amount");
      return { columns: [{ key: "type", label: "Section" }, { key: "account", label: "Account" }, { key: "amount", label: "Amount", kind: "money" }], rows, note: assets === le ? "Assets equal liabilities plus equity." : "Out of balance: check recent entries.", totals: { account: "Total assets", amount: assets } };
    },
  },
  {
    id: "trial-balance",
    ...financial("Trial balance"),
    replaces: "Trial Balance, Trial Balance by Property, Chart of Accounts",
    filters: ["asOf", "owner"],
    run: async (db, companyId, f) => {
      if (!f.owner) return { columns: [], rows: [], note: "Choose an owner: each owner keeps its own books." };
      const rows = (await balances(db, companyId, f.owner, "1900-01-01", f.asOf))
        .sort((a, b) => a.number.localeCompare(b.number))
        .map((b) => {
          const net = Number(b.debit_cents) - Number(b.credit_cents);
          return { account: `${b.number} ${b.name}`, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
        });
      return { columns: [{ key: "account", label: "Account" }, { key: "debit", label: "Debit", kind: "money" }, { key: "credit", label: "Credit", kind: "money" }], rows, totals: { account: "Totals", debit: sum(rows, "debit"), credit: sum(rows, "credit") } };
    },
  },
  {
    id: "general-ledger",
    ...financial("General ledger"),
    replaces: "General Ledger, Journal Entry Register, Account Totals",
    filters: ["range", "owner", "property"],
    run: async (db, companyId, f) => {
      if (!f.owner) return { columns: [], rows: [], note: "Choose an owner: each owner keeps its own books." };
      let q = db
        .from("journal_line")
        .select("debit_cents, credit_cents, memo, property_id, journal_entry!inner(entry_date, source, memo, entity_id, status), gl_account!inner(number, name), property(name)")
        .eq("company_id", companyId)
        .eq("journal_entry.entity_id", f.owner)
        .in("journal_entry.status", ["posted", "reversed"])
        .gte("journal_entry.entry_date", f.from)
        .lte("journal_entry.entry_date", f.to)
        .limit(5000);
      if (f.property) q = q.eq("property_id", f.property);
      const { data } = await q;
      const rows = (data ?? [])
        .map((l) => ({ date: l.journal_entry.entry_date, account: `${l.gl_account.number} ${l.gl_account.name}`, property: l.property?.name ?? "", source: l.journal_entry.source, memo: l.memo ?? l.journal_entry.memo ?? "", debit: Number(l.debit_cents), credit: Number(l.credit_cents) }))
        .sort((a, b) => a.account.localeCompare(b.account) || a.date.localeCompare(b.date));
      return {
        columns: [{ key: "account", label: "Account" }, { key: "date", label: "Date", kind: "date" }, { key: "property", label: "Property" }, { key: "source", label: "Source" }, { key: "memo", label: "Memo" }, { key: "debit", label: "Debit", kind: "money" }, { key: "credit", label: "Credit", kind: "money" }],
        rows,
        totals: { account: "Totals", debit: sum(rows, "debit"), credit: sum(rows, "credit") },
      };
    },
  },
  {
    id: "cash-flow",
    ...financial("Cash flow"),
    replaces: "Cash Flow, 12 Month, Property Comparison, Cash Flow Detail",
    filters: ["range", "owner", "property"],
    run: async (db, companyId, f) => {
      if (!f.owner) return { columns: [], rows: [], note: "Choose an owner: each owner keeps its own books." };
      // Cash is the operating and trust bank accounts (1000 and 1010).
      const { data } = await db
        .from("journal_line")
        .select("journal_entry_id, debit_cents, credit_cents, property_id, journal_entry!inner(entry_date, entity_id, status), gl_account!inner(number, name)")
        .eq("company_id", companyId)
        .eq("journal_entry.entity_id", f.owner)
        .in("journal_entry.status", ["posted", "reversed"])
        .gte("journal_entry.entry_date", f.from)
        .lte("journal_entry.entry_date", f.to)
        .limit(20000);
      const entries = new Map<string, (CashLine & { property: string | null })[]>();
      for (const l of data ?? []) {
        const list = entries.get(l.journal_entry_id) ?? [];
        list.push({ account: `${l.gl_account.number} ${l.gl_account.name}`, cash: ["1000", "1010"].includes(l.gl_account.number), debit: Number(l.debit_cents), credit: Number(l.credit_cents), property: l.property_id });
        entries.set(l.journal_entry_id, list);
      }
      const picked = [...entries.values()].filter((lines) => !f.property || lines.some((l) => l.property === f.property));
      const rows = cashFlow(picked).map((r) => ({ account: r.account, cashIn: r.cashIn, cashOut: r.cashOut, net: r.net }));
      return {
        columns: [{ key: "account", label: "Where the cash came from or went" }, { key: "cashIn", label: "Cash in", kind: "money" }, { key: "cashOut", label: "Cash out", kind: "money" }, { key: "net", label: "Net", kind: "money" }],
        rows,
        totals: { account: "Net change in cash", cashIn: sum(rows, "cashIn"), cashOut: sum(rows, "cashOut"), net: sum(rows, "net") },
        note: "Cash is the operating and trust bank accounts. Moves between them aren't counted. Rent shows against Rent receivable because rent posts as a charge first.",
      };
    },
  },
  { id: "budget", ...financial("Budget vs actual and forecast"), replaces: "Annual Budget Comparative, Budget Comparative, Budget Detail", filters: ["range", "owner"], needs: "Budgets: an annual budget for each owner, by account and month." },
  {
    id: "expenses-by-vendor",
    ...financial("Expenses by vendor and category"),
    replaces: "Expense Register, Expense Distribution, Credit Card Expense Detail",
    filters: ["range", "owner", "property"],
    run: async (db, companyId, f) => {
      let q = db.from("bill").select("amount_cents, expense_account, invoice_date, status, memo, vendor(contact(kind, first_name, last_name, business_name)), property(name)").eq("company_id", companyId).in("status", ["approved", "paid"]).gte("invoice_date", f.from).lte("invoice_date", f.to);
      if (f.owner) q = q.eq("entity_id", f.owner);
      if (f.property) q = q.eq("property_id", f.property);
      const { data } = await q;
      const rows = (data ?? []).map((b) => ({ date: b.invoice_date, vendor: contactName(b.vendor?.contact), account: b.expense_account, property: b.property?.name ?? "", memo: b.memo ?? "", amount: b.amount_cents })).sort((a, b) => a.vendor.localeCompare(b.vendor));
      return { columns: [{ key: "vendor", label: "Vendor" }, { key: "date", label: "Invoice date", kind: "date" }, { key: "account", label: "Account" }, { key: "property", label: "Property" }, { key: "memo", label: "What for" }, { key: "amount", label: "Amount", kind: "money" }], rows, totals: { vendor: "Total", amount: sum(rows, "amount") } };
    },
  },
  { id: "loans", ...financial("Loans and debt service"), replaces: "Loans", filters: ["owner"], needs: "Loan records for each property: lender, balance, rate and monthly payment." },
  { id: "fixed-assets", ...financial("Fixed assets and depreciation"), replaces: "Fixed Assets", filters: ["owner"], needs: "Fixed asset records: what was bought, when, the cost and how it's depreciated." },

  {
    id: "bank-activity",
    group: "Banking",
    title: "Bank account activity",
    replaces: "Bank Account Activity, Deposit Register, Check Register",
    filters: ["range", "owner"],
    run: async (db, companyId, f) => {
      let q = db
        .from("bank_transaction")
        .select("posted_on, description, amount_cents, status, bank_account!inner(name, last4, entity_id, entity(name))")
        .eq("company_id", companyId)
        .gte("posted_on", f.from)
        .lte("posted_on", f.to)
        .order("posted_on")
        .limit(10000);
      if (f.owner) q = q.eq("bank_account.entity_id", f.owner);
      const { data } = await q;
      const STATUS: Record<string, string> = { matched: "Matched", unmatched: "Not matched yet", ignored: "Ignored" };
      const rows = (data ?? []).map((t) => ({
        date: t.posted_on,
        account: `${t.bank_account.entity?.name ?? ""} · ${t.bank_account.name}${t.bank_account.last4 ? ` …${t.bank_account.last4}` : ""}`,
        description: t.description,
        deposit: t.amount_cents > 0 ? t.amount_cents : null,
        withdrawal: t.amount_cents < 0 ? -t.amount_cents : null,
        status: STATUS[t.status] ?? t.status,
      }));
      return {
        columns: [{ key: "date", label: "Date", kind: "date" }, { key: "account", label: "Bank account" }, { key: "description", label: "Description" }, { key: "deposit", label: "Deposit", kind: "money" }, { key: "withdrawal", label: "Withdrawal", kind: "money" }, { key: "status", label: "Matched to the books" }],
        rows,
        totals: { description: "Totals", deposit: sum(rows, "deposit"), withdrawal: sum(rows, "withdrawal") },
        note: rows.length ? undefined : "No bank lines in this range. Import a statement in Accounting › Bank accounts (live bank feeds arrive with Plaid).",
      };
    },
  },
  {
    id: "trust-reconciliation",
    group: "Banking",
    title: "Security deposit trust reconciliation",
    replaces: "Trust Account Balance, Trust Account Detail, Security Deposit Funds Detail",
    filters: ["asOf"],
    run: async (db, companyId, f) => {
      const { data: owners } = await db.from("entity").select("id, name").eq("company_id", companyId).order("name");
      const rows = [];
      for (const o of owners ?? []) {
        const b = await balances(db, companyId, o.id, "1900-01-01", f.asOf);
        const trust = b.filter((x) => x.is_trust && x.type === "asset").reduce((s, x) => s + normalBalance(x), 0);
        const held = b.filter((x) => x.number === "2100").reduce((s, x) => s + normalBalance(x), 0);
        if (trust || held) rows.push({ owner: o.name, trust, held, difference: trust - held });
      }
      return {
        columns: [{ key: "owner", label: "Owner" }, { key: "trust", label: "Trust cash", kind: "money" }, { key: "held", label: "Deposits held", kind: "money" }, { key: "difference", label: "Difference", kind: "money" }],
        rows,
        note: rows.every((r) => r.difference === 0) ? "Trust cash equals deposits held for every owner (Fla. Stat. 83.49)." : "A difference means trust cash doesn't match deposits held. Fix it before the next statement (Fla. Stat. 83.49).",
      };
    },
  },

  {
    id: "rent-roll",
    group: "Rent and collections",
    title: "Rent roll",
    replaces: "Rent Roll, Rent Roll (Commercial), Rent Roll (Itemized), Gross Potential Rent",
    filters: ["owner", "property"],
    run: async (db, companyId, f) => {
      let q = db.from("unit").select("label, kind, beds, baths, sqft, market_rent_cents, status, property!inner(id, name, entity_id), lease(status, start_date, end_date, rent_cents, deposit_cents, lease_tenant(role, is_primary, contact(kind, first_name, last_name, business_name)))").eq("company_id", companyId);
      if (f.property) q = q.eq("property.id", f.property);
      if (f.owner) q = q.eq("property.entity_id", f.owner);
      const { data } = await q;
      const rows = (data ?? [])
        .map((u) => {
          const l = u.lease.find((x) => x.status === "active" || x.status === "notice");
          return { unit: unitLabel(u), kind: u.kind === "commercial" ? "Commercial" : "Residential", status: l ? (l.status === "notice" ? "On notice" : "Occupied") : "Vacant", tenant: l ? tenantsOf(l.lease_tenant) : "", start: l?.start_date ?? null, end: l?.end_date ?? null, market: u.market_rent_cents ?? 0, rent: l?.rent_cents ?? 0, deposit: l?.deposit_cents ?? 0 };
        })
        .sort((a, b) => a.unit.localeCompare(b.unit, undefined, { numeric: true }));
      const occupied = rows.filter((r) => r.status !== "Vacant").length;
      return {
        columns: [{ key: "unit", label: "Unit" }, { key: "status", label: "Status" }, { key: "tenant", label: "Tenant" }, { key: "start", label: "Start", kind: "date" }, { key: "end", label: "End", kind: "date" }, { key: "market", label: "Market rent", kind: "money" }, { key: "rent", label: "Lease rent", kind: "money" }, { key: "deposit", label: "Deposit", kind: "money" }],
        rows,
        totals: { unit: `${rows.length} units, ${occupied} occupied`, market: sum(rows, "market"), rent: sum(rows, "rent"), deposit: sum(rows, "deposit") },
        note: `Gross potential rent ${(sum(rows, "market") / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}/month.`,
      };
    },
  },
  {
    id: "aged-receivables",
    group: "Rent and collections",
    title: "Aged receivables and delinquency",
    replaces: "Delinquency, Delinquency (As Of), Aged Receivable Detail, Tenant Unpaid Charges, Unpaid Balances by Month",
    filters: ["asOf", "owner", "property"],
    run: async (db, companyId, f) => {
      const leases = await leasesFor(db, companyId, f, ["active", "notice", "ended"]);
      const ids = leases.map((l) => l.id);
      const [{ data: charges }, { data: payments }] = ids.length
        ? await Promise.all([
            db.from("charge").select("lease_id, amount_cents, due_date").in("lease_id", ids).lte("due_date", f.asOf),
            db.from("payment").select("lease_id, amount_cents, received_on, status, purpose").in("lease_id", ids).lte("received_on", f.asOf),
          ])
        : [{ data: [] }, { data: [] }];
      const rows = leases
        .map((l) => {
          const paid = (payments ?? []).filter((p) => p.lease_id === l.id && p.purpose !== "deposit" && p.status === "succeeded").reduce((s, p) => s + p.amount_cents, 0);
          const a = aging((charges ?? []).filter((c) => c.lease_id === l.id && c.amount_cents > 0), paid, f.asOf);
          return { tenant: tenantsOf(l.lease_tenant), unit: unitLabel(l.unit), status: l.status === "ended" ? "Past tenant" : "Current", ...a };
        })
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total);
      return {
        columns: [{ key: "tenant", label: "Tenant" }, { key: "unit", label: "Unit" }, { key: "status", label: "Status" }, { key: "current", label: "0–30 days", kind: "money" }, { key: "d30", label: "31–60", kind: "money" }, { key: "d60", label: "61–90", kind: "money" }, { key: "d90", label: "Over 90", kind: "money" }, { key: "total", label: "Total", kind: "money" }],
        rows,
        totals: { tenant: "Total", current: sum(rows, "current"), d30: sum(rows, "d30"), d60: sum(rows, "d60"), d90: sum(rows, "d90"), total: sum(rows, "total") },
        note: "Payments pay the oldest charges first. Balances carried over from your old software count once they're posted at cutover.",
      };
    },
  },
  {
    id: "payments-received",
    group: "Rent and collections",
    title: "Payments received",
    replaces: "Receivables Activity, Income Register",
    filters: ["range", "owner", "property"],
    run: async (db, companyId, f) => {
      const leases = await leasesFor(db, companyId, f, ["active", "notice", "ended", "draft", "pending_signature"]);
      const byId = new Map(leases.map((l) => [l.id, l]));
      const { data } = byId.size ? await db.from("payment").select("lease_id, amount_cents, received_on, method, status, purpose, reference, returned_on").in("lease_id", [...byId.keys()]).gte("received_on", f.from).lte("received_on", f.to) : { data: [] };
      const rows = (data ?? []).map((p) => ({ date: p.received_on, tenant: tenantsOf(byId.get(p.lease_id)!.lease_tenant), unit: unitLabel(byId.get(p.lease_id)!.unit), method: p.method, purpose: p.purpose === "deposit" ? "Deposit" : "Rent and charges", reference: p.reference ?? "", status: p.status === "returned" ? `Returned ${p.returned_on ?? ""}` : "Cleared", amount: p.status === "returned" ? 0 : p.amount_cents })).sort((a, b) => a.date.localeCompare(b.date));
      return { columns: [{ key: "date", label: "Date", kind: "date" }, { key: "tenant", label: "Tenant" }, { key: "unit", label: "Unit" }, { key: "method", label: "Method" }, { key: "purpose", label: "For" }, { key: "reference", label: "Reference" }, { key: "status", label: "Status" }, { key: "amount", label: "Amount", kind: "money" }], rows, totals: { date: "Total", amount: sum(rows, "amount") } };
    },
  },
  {
    id: "charges-and-fees",
    group: "Rent and collections",
    title: "Charges and fees",
    replaces: "Charge Detail, Additional Fees, Late Fee Policy Comparison",
    filters: ["range", "owner", "property"],
    run: async (db, companyId, f) => {
      const leases = await leasesFor(db, companyId, f, ["active", "notice", "ended", "draft", "pending_signature"]);
      const byId = new Map(leases.map((l) => [l.id, l]));
      const { data } = byId.size ? await db.from("charge").select("lease_id, amount_cents, due_date, charge_type, description").in("lease_id", [...byId.keys()]).gte("due_date", f.from).lte("due_date", f.to) : { data: [] };
      const rows = (data ?? []).map((c) => ({ date: c.due_date, tenant: tenantsOf(byId.get(c.lease_id)!.lease_tenant), unit: unitLabel(byId.get(c.lease_id)!.unit), type: c.charge_type.replace(/_/g, " "), description: c.description, amount: c.amount_cents })).sort((a, b) => a.date.localeCompare(b.date));
      return { columns: [{ key: "date", label: "Due", kind: "date" }, { key: "tenant", label: "Tenant" }, { key: "unit", label: "Unit" }, { key: "type", label: "Type" }, { key: "description", label: "Description" }, { key: "amount", label: "Amount", kind: "money" }], rows, totals: { date: "Total", amount: sum(rows, "amount") } };
    },
  },
  { id: "tenant-ledger", group: "Rent and collections", title: "Tenant ledger", replaces: "Tenant Ledger, Tenant Transactions Summary", filters: [], run: async () => ({ columns: [], rows: [], note: "Open any tenant and use Export CSV on their ledger." }) },
  { id: "payment-plans", group: "Rent and collections", title: "Payment plans", replaces: "Payment Plans", filters: [], needs: "Payment plans, which arrive with the collections agent." },
  {
    id: "collections",
    group: "Rent and collections",
    title: "Collections and write-offs",
    replaces: "Debt Collections Status, Eligible Debt Summary",
    filters: ["asOf", "owner", "property"],
    run: async (db, companyId, f) => {
      // Past tenants who still owe, and current tenants over 30 days behind, with the notices on file.
      const leases = await leasesFor(db, companyId, f, ["active", "notice", "ended"]);
      const ids = leases.map((l) => l.id);
      const [{ data: charges }, { data: payments }, { data: notices }, { data: moveOuts }] = ids.length
        ? await Promise.all([
            db.from("charge").select("lease_id, amount_cents, due_date").in("lease_id", ids).lte("due_date", f.asOf),
            db.from("payment").select("lease_id, amount_cents, received_on, status, purpose").in("lease_id", ids).lte("received_on", f.asOf),
            db.from("message").select("lease_id, template_id, created_at").in("lease_id", ids).in("template_id", ["three-day", "past-due", "deposit-claim"]),
            db.from("move_out").select("lease_id, vacated_on, forwarding_address").in("lease_id", ids),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
      const NOTICE: Record<string, string> = { "three-day": "3-day notice", "past-due": "Past-due letter", "deposit-claim": "Deposit claim" };
      const rows = leases
        .map((l) => {
          const mine = (payments ?? []).filter((p) => p.lease_id === l.id && p.purpose !== "deposit" && p.status === "succeeded");
          const a = aging((charges ?? []).filter((c) => c.lease_id === l.id && c.amount_cents > 0), mine.reduce((s, p) => s + p.amount_cents, 0), f.asOf);
          const last = mine.map((p) => p.received_on).sort().at(-1) ?? null;
          const sent = (notices ?? []).filter((n) => n.lease_id === l.id).sort((x, y) => y.created_at.localeCompare(x.created_at));
          const mo = (moveOuts ?? []).find((m) => m.lease_id === l.id);
          const past = l.status === "ended";
          return {
            tenant: tenantsOf(l.lease_tenant),
            unit: unitLabel(l.unit),
            status: past ? "Past tenant" : "Current",
            owed: a.total,
            over30: a.d30 + a.d60 + a.d90,
            lastPayment: last,
            notice: sent[0] ? `${NOTICE[sent[0].template_id ?? ""] ?? "Letter"} ${sent[0].created_at.slice(0, 10)}` : "",
            movedOut: mo?.vacated_on ?? null,
            forwarding: mo?.forwarding_address ? "On file" : past ? "Missing" : "",
            include: past ? a.total > 0 : a.d30 + a.d60 + a.d90 > 0,
          };
        })
        .filter((r) => r.include)
        .map((r) => {
          const row: Record<string, unknown> = { ...r };
          delete row.include;
          return row as Omit<typeof r, "include">;
        })
        .sort((a, b) => Number(b.status === "Past tenant") - Number(a.status === "Past tenant") || b.owed - a.owed);
      return {
        columns: [
          { key: "tenant", label: "Tenant" },
          { key: "unit", label: "Unit" },
          { key: "status", label: "Status" },
          { key: "owed", label: "Owed", kind: "money" },
          { key: "over30", label: "Over 30 days", kind: "money" },
          { key: "lastPayment", label: "Last payment", kind: "date" },
          { key: "notice", label: "Last notice" },
          { key: "movedOut", label: "Moved out", kind: "date" },
          { key: "forwarding", label: "Forwarding address" },
        ],
        rows,
        totals: { tenant: "Total", owed: sum(rows, "owed"), over30: sum(rows, "over30") },
        note: "Past tenants who still owe after the deposit was applied, and current tenants more than 30 days behind. Writing off a balance is a reversing entry in Accounting; sending a debt to a collection agency follows the Florida Consumer Collection Practices Act (Fla. Stat. 559.72).",
      };
    },
  },

  {
    id: "tenant-directory",
    group: "Tenants and leases",
    title: "Tenant directory",
    replaces: "Tenant Directory, Tenant Vehicle Info, Insurance Enforcement",
    filters: ["owner", "property"],
    run: async (db, companyId, f) => {
      const leases = await leasesFor(db, companyId, f);
      const rows = leases.flatMap((l) =>
        l.lease_tenant
          .filter((t) => t.role === "tenant")
          .map((t) => ({ name: contactName(t.contact), unit: unitLabel(l.unit), email: t.contact?.email ?? "", phone: t.contact?.mobile ?? t.contact?.phone ?? "", end: l.end_date, autopay: l.autopay.some((a) => a.active) ? "Yes" : "No" })),
      );
      rows.sort((a, b) => a.unit.localeCompare(b.unit, undefined, { numeric: true }));
      return { columns: [{ key: "name", label: "Tenant" }, { key: "unit", label: "Unit" }, { key: "email", label: "E-mail" }, { key: "phone", label: "Phone" }, { key: "end", label: "Lease ends", kind: "date" }, { key: "autopay", label: "Autopay" }], rows };
    },
  },
  {
    id: "lease-expirations",
    group: "Tenants and leases",
    title: "Lease expirations and renewals",
    replaces: "Lease Expiration Detail by Month, Renewal Summary, Tenant Tickler",
    filters: ["range", "owner", "property"],
    forward: true,
    run: async (db, companyId, f) => {
      const rows = (await leasesFor(db, companyId, f))
        .filter((l) => l.end_date && l.end_date >= f.from && l.end_date <= f.to)
        .map((l) => ({ month: l.end_date!.slice(0, 7), end: l.end_date, tenant: tenantsOf(l.lease_tenant), unit: unitLabel(l.unit), rent: l.rent_cents, market: l.unit.market_rent_cents ?? 0, status: l.status === "notice" ? "Moving out" : "Undecided" }))
        .sort((a, b) => a.end!.localeCompare(b.end!));
      return { columns: [{ key: "month", label: "Month" }, { key: "end", label: "Ends", kind: "date" }, { key: "tenant", label: "Tenant" }, { key: "unit", label: "Unit" }, { key: "status", label: "Status" }, { key: "rent", label: "Rent", kind: "money" }, { key: "market", label: "Market", kind: "money" }], rows };
    },
  },
  {
    id: "move-ins-outs",
    group: "Tenants and leases",
    title: "Move-ins and move-outs",
    replaces: "Lease History (move dates), Unit Turn Detail",
    filters: ["range", "owner", "property"],
    run: async (db, companyId, f) => {
      const leases = await leasesFor(db, companyId, f, ["active", "notice", "ended"]);
      const rows = [
        ...leases.filter((l) => l.start_date >= f.from && l.start_date <= f.to).map((l) => ({ date: l.start_date, kind: "Move-in", tenant: tenantsOf(l.lease_tenant), unit: unitLabel(l.unit) })),
        ...leases.filter((l) => l.move_out_on && l.move_out_on >= f.from && l.move_out_on <= f.to).map((l) => ({ date: l.move_out_on!, kind: "Move-out", tenant: tenantsOf(l.lease_tenant), unit: unitLabel(l.unit) })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      return { columns: [{ key: "date", label: "Date", kind: "date" }, { key: "kind", label: "Event" }, { key: "tenant", label: "Tenant" }, { key: "unit", label: "Unit" }], rows };
    },
  },
  { id: "surveys", group: "Tenants and leases", title: "Resident surveys", replaces: "Survey Responses", filters: [], needs: "Resident surveys, sent after move-in and after repairs." },

  {
    id: "vacancy",
    group: "Leasing",
    title: "Vacancy and availability",
    replaces: "Unit Vacancy Detail, Occupancy Summary, Historical Advertised Rent",
    filters: ["owner", "property"],
    run: async (db, companyId, f) => {
      let q = db.from("unit").select("label, status, market_rent_cents, property!inner(id, name, entity_id), listing(status, rent_cents, available_on, published_at)").eq("company_id", companyId).in("status", ["vacant", "notice", "listed", "down"]);
      if (f.property) q = q.eq("property.id", f.property);
      if (f.owner) q = q.eq("property.entity_id", f.owner);
      const { data } = await q;
      const rows = (data ?? []).map((u) => ({ unit: unitLabel(u), status: u.status === "notice" ? "On notice" : u.status === "down" ? "Down" : "Vacant", listing: u.listing?.status === "published" ? "Published" : u.listing ? "Draft" : "Not listed", available: u.listing?.available_on ?? null, asking: u.listing?.rent_cents ?? u.market_rent_cents ?? 0 }));
      return { columns: [{ key: "unit", label: "Unit" }, { key: "status", label: "Status" }, { key: "listing", label: "Listing" }, { key: "available", label: "Available", kind: "date" }, { key: "asking", label: "Asking rent", kind: "money" }], rows };
    },
  },
  {
    id: "leasing-funnel",
    group: "Leasing",
    title: "Leasing funnel",
    replaces: "Guest Card Inquiries, Leasing Funnel Performance, Leasing Summary, Showings",
    filters: ["range"],
    run: async (db, companyId, f) => {
      const [{ data: g }, { data: apps }, { data: shows }] = await Promise.all([
        db.from("guest_card").select("source, status").eq("company_id", companyId).gte("created_at", `${f.from}T00:00:00Z`).lte("created_at", `${f.to}T23:59:59Z`),
        db.from("application").select("status, guest_card_id").eq("company_id", companyId).gte("created_at", `${f.from}T00:00:00Z`).lte("created_at", `${f.to}T23:59:59Z`),
        db.from("showing").select("status").eq("company_id", companyId).gte("starts_at", `${f.from}T00:00:00Z`).lte("starts_at", `${f.to}T23:59:59Z`),
      ]);
      const rows = Object.entries(GUEST_SOURCES)
        .map(([k, label]) => {
          const cards = (g ?? []).filter((x) => x.source === k);
          return { source: label, inquiries: cards.length, applied: cards.filter((x) => x.status === "applied").length, lost: cards.filter((x) => x.status === "lost").length };
        })
        .filter((r) => r.inquiries);
      const signed = (apps ?? []).filter((a) => a.status === "signed").length;
      return {
        columns: [{ key: "source", label: "Source" }, { key: "inquiries", label: "Inquiries", kind: "number" }, { key: "applied", label: "Applied", kind: "number" }, { key: "lost", label: `${GUEST_STATUS.lost}`, kind: "number" }],
        rows,
        totals: { source: "Total", inquiries: sum(rows, "inquiries"), applied: sum(rows, "applied"), lost: sum(rows, "lost") },
        note: `${(shows ?? []).filter((s) => s.status === "done").length} showings held, ${(apps ?? []).length} applications, ${signed} leases signed in this period.`,
      };
    },
  },
  {
    id: "applications",
    group: "Leasing",
    title: "Applications and screening",
    replaces: "Rental Applications, Screening Assessments, Screening Usage",
    filters: ["range"],
    run: async (db, companyId, f) => {
      const { data } = await db
        .from("application")
        .select("status, decision, submitted_at, created_at, rent_cents, deposit_cents, fees_paid_cents, adverse_action_sent_at, unit(label, property(name)), application_member(role, first_name, last_name)")
        .eq("company_id", companyId)
        .gte("created_at", `${f.from}T00:00:00Z`)
        .lte("created_at", `${f.to}T23:59:59Z`);
      const rows = (data ?? []).map((a) => ({ applied: a.submitted_at?.slice(0, 10) ?? null, applicants: a.application_member.filter((m) => m.role !== "guarantor").map((m) => `${m.first_name} ${m.last_name}`.trim()).join(", "), unit: unitLabel(a.unit), status: APPLICATION_STATUS[a.status]?.label ?? a.status, deposit: a.deposit_cents ?? 0, fees: a.fees_paid_cents, adverse: a.adverse_action_sent_at ? "Sent" : "" }));
      return { columns: [{ key: "applied", label: "Submitted", kind: "date" }, { key: "applicants", label: "Applicants" }, { key: "unit", label: "Unit" }, { key: "status", label: "Status" }, { key: "deposit", label: "Deposit", kind: "money" }, { key: "fees", label: "Fees paid", kind: "money" }, { key: "adverse", label: "Adverse action notice" }], rows };
    },
  },
  { id: "leasing-agent", group: "Leasing", title: "AI leasing agent", replaces: "New", filters: ["range"], needs: "The AI leasing agent, which needs Twilio texting and Google Calendar connected." },

  {
    id: "work-orders",
    group: "Maintenance and vendors",
    title: "Work orders",
    replaces: "Work Order, Billable Detail, Labor Summary, Recurring Work Order",
    filters: ["range", "property"],
    run: async (db, companyId, f) => {
      let q = db.from("work_order").select("number, title, priority, status, created_at, completed_at, cost_cents, property(name), unit(label), vendor(contact(kind, first_name, last_name, business_name))").eq("company_id", companyId).gte("created_at", `${f.from}T00:00:00Z`).lte("created_at", `${f.to}T23:59:59Z`);
      if (f.property) q = q.eq("property_id", f.property);
      const { data } = await q;
      const rows = (data ?? []).map((w) => ({ number: w.number, opened: w.created_at.slice(0, 10), title: w.title, property: `${w.property?.name ?? ""}${w.unit && w.unit.label !== "Home" ? ` ${w.unit.label}` : ""}`, priority: w.priority, status: w.status, vendor: w.vendor ? contactName(w.vendor.contact) : "", days: w.completed_at ? Math.max(0, Math.round((Date.parse(w.completed_at) - Date.parse(w.created_at)) / 86_400_000)) : null, cost: w.cost_cents ?? 0 }));
      return { columns: [{ key: "number", label: "#" }, { key: "opened", label: "Opened", kind: "date" }, { key: "title", label: "What" }, { key: "property", label: "Where" }, { key: "priority", label: "Priority" }, { key: "status", label: "Status" }, { key: "vendor", label: "Vendor" }, { key: "days", label: "Days to complete", kind: "number" }, { key: "cost", label: "Cost", kind: "money" }], rows, totals: { number: "Total", cost: sum(rows, "cost") } };
    },
  },
  {
    id: "inspections",
    group: "Maintenance and vendors",
    title: "Inspections and unit turns",
    replaces: "Inspection Detail, Unit Inspection, Unit Turn Detail",
    filters: ["range", "property"],
    run: async (db, companyId, f) => {
      const { data } = await db
        .from("inspection")
        .select("kind, inspected_on, rooms, lease!inner(unit!inner(label, property!inner(id, name)), lease_tenant(role, is_primary, contact(kind, first_name, last_name, business_name)), move_out(decision, closed_at, refund_cents))")
        .eq("company_id", companyId)
        .gte("inspected_on", f.from)
        .lte("inspected_on", f.to)
        .order("inspected_on", { ascending: false });
      const rows = (data ?? [])
        .filter((i) => !f.property || i.lease.unit.property.id === f.property)
        .map((i) => {
          const rooms = Array.isArray(i.rooms) ? (i.rooms as { condition?: string; photos?: unknown[] }[]) : [];
          const mo = i.lease.move_out;
          return {
            date: i.inspected_on,
            kind: i.kind === "move_in" ? "Move-in" : "Move-out",
            tenant: tenantsOf(i.lease.lease_tenant),
            unit: unitLabel(i.lease.unit),
            rooms: rooms.length,
            damaged: rooms.filter((r) => r.condition === "damaged" || r.condition === "missing").length,
            photos: rooms.reduce((s, r) => s + (Array.isArray(r.photos) ? r.photos.length : 0), 0),
            deposit: i.kind === "move_out" && mo ? (mo.closed_at ? (mo.decision === "claim" ? "Claim settled" : "Returned in full") : mo.decision === "claim" ? "Claim in progress" : "Open") : "",
          };
        });
      return {
        columns: [{ key: "date", label: "Date", kind: "date" }, { key: "kind", label: "Inspection" }, { key: "tenant", label: "Tenant" }, { key: "unit", label: "Unit" }, { key: "rooms", label: "Rooms", kind: "number" }, { key: "damaged", label: "Damaged or missing", kind: "number" }, { key: "photos", label: "Photos", kind: "number" }, { key: "deposit", label: "Deposit" }],
        rows,
        totals: { date: "Total", rooms: sum(rows, "rooms"), damaged: sum(rows, "damaged"), photos: sum(rows, "photos") },
      };
    },
  },
  {
    id: "vendor-compliance",
    group: "Maintenance and vendors",
    title: "Vendor directory and compliance",
    replaces: "Vendor Directory (+ W-9 and insurance status)",
    filters: ["asOf"],
    run: async (db, companyId, f) => {
      const { data } = await db.from("vendor").select("trade, is_active, is_1099, w9_on_file, coi_expires_on, workers_comp_expires_on, license_expires_on, last_paid_on, contact(kind, first_name, last_name, business_name, email, phone, mobile)").eq("company_id", companyId).eq("is_active", true);
      const exp = (d: string | null) => (!d ? "Missing" : d < f.asOf ? `Expired ${d}` : d);
      const rows = (data ?? []).map((v) => ({ vendor: contactName(v.contact), trade: v.trade ?? "", phone: v.contact?.mobile ?? v.contact?.phone ?? "", w9: v.w9_on_file ? "On file" : "Missing", coi: exp(v.coi_expires_on), wc: v.workers_comp_expires_on ? exp(v.workers_comp_expires_on) : "", canPay: v.w9_on_file || !v.is_1099 ? "Yes" : "No (needs W-9)" })).sort((a, b) => a.vendor.localeCompare(b.vendor));
      return { columns: [{ key: "vendor", label: "Vendor" }, { key: "trade", label: "Trade" }, { key: "phone", label: "Phone" }, { key: "w9", label: "W-9" }, { key: "coi", label: "Liability insurance" }, { key: "wc", label: "Workers' comp" }, { key: "canPay", label: "Can be paid" }], rows };
    },
  },
  {
    id: "vendor-spend",
    group: "Maintenance and vendors",
    title: "Vendor spend",
    replaces: "Vendor Ledger, Vendor Ledger (Enhanced)",
    filters: ["range", "owner"],
    run: async (db, companyId, f) => {
      let q = db.from("bill").select("amount_cents, status, vendor_id, vendor(contact(kind, first_name, last_name, business_name))").eq("company_id", companyId).in("status", ["approved", "paid"]).gte("invoice_date", f.from).lte("invoice_date", f.to);
      if (f.owner) q = q.eq("entity_id", f.owner);
      const { data } = await q;
      const by = new Map<string, { vendor: string; bills: number; billed: number; paid: number }>();
      for (const b of data ?? []) {
        const r = by.get(b.vendor_id ?? "none") ?? { vendor: contactName(b.vendor?.contact), bills: 0, billed: 0, paid: 0 };
        r.bills++;
        r.billed += b.amount_cents;
        if (b.status === "paid") r.paid += b.amount_cents;
        by.set(b.vendor_id ?? "none", r);
      }
      const rows = [...by.values()].sort((a, b) => b.billed - a.billed);
      return { columns: [{ key: "vendor", label: "Vendor" }, { key: "bills", label: "Bills", kind: "number" }, { key: "billed", label: "Billed", kind: "money" }, { key: "paid", label: "Paid", kind: "money" }], rows, totals: { vendor: "Total", bills: sum(rows, "bills"), billed: sum(rows, "billed"), paid: sum(rows, "paid") } };
    },
  },
  {
    id: "aged-payables",
    group: "Maintenance and vendors",
    title: "Bills and aged payables",
    replaces: "Aged Payables Summary, Bill Detail",
    filters: ["asOf", "owner"],
    run: async (db, companyId, f) => {
      let q = db.from("bill").select("amount_cents, due_date, invoice_date, invoice_number, status, memo, vendor(contact(kind, first_name, last_name, business_name)), property(name)").eq("company_id", companyId).in("status", ["received", "approved", "scheduled"]);
      if (f.owner) q = q.eq("entity_id", f.owner);
      const { data } = await q;
      const rows = (data ?? []).map((b) => {
        const days = b.due_date ? Math.round((Date.parse(`${f.asOf}T12:00:00Z`) - Date.parse(`${b.due_date}T12:00:00Z`)) / 86_400_000) : 0;
        return { vendor: contactName(b.vendor?.contact), invoice: b.invoice_number ?? "", property: b.property?.name ?? "", status: BILL_STATUS[b.status]?.label ?? b.status, due: b.due_date, late: days > 0 ? `${days} days` : "Not yet due", amount: b.amount_cents };
      });
      return { columns: [{ key: "vendor", label: "Vendor" }, { key: "invoice", label: "Invoice" }, { key: "property", label: "Property" }, { key: "status", label: "Status" }, { key: "due", label: "Due", kind: "date" }, { key: "late", label: "Past due" }, { key: "amount", label: "Amount", kind: "money" }], rows, totals: { vendor: "Total", amount: sum(rows, "amount") } };
    },
  },
  { id: "projects", group: "Maintenance and vendors", title: "Projects and purchase orders", replaces: "Project Budget Detail, Project Directory, Purchase Order", filters: [], needs: "Projects and purchase orders." },
  { id: "inventory", group: "Maintenance and vendors", title: "Inventory and keys", replaces: "Inventory Status, Inventory Usage, Keys Detail", filters: [], needs: "Inventory and key tracking." },

  {
    id: "properties",
    group: "Properties and owners",
    title: "Properties and units",
    replaces: "Property Directory, Unit Directory, Amenities by Property",
    filters: ["owner"],
    run: async (db, companyId, f) => {
      let q = db.from("property").select("name, property_type, address_line1, city, state, postal_code, entity(name), unit(status)").eq("company_id", companyId).order("name");
      if (f.owner) q = q.eq("entity_id", f.owner);
      const { data } = await q;
      const rows = (data ?? []).map((p) => ({ property: p.name, owner: p.entity?.name ?? "", address: [p.address_line1, p.city, p.state, p.postal_code].filter(Boolean).join(", "), type: PROPERTY_TYPE_LABEL[p.property_type ?? ""] ?? p.property_type ?? "", units: p.unit.length, occupied: p.unit.filter((u) => u.status === "occupied" || u.status === "notice").length, occupancy: p.unit.length ? p.unit.filter((u) => u.status === "occupied" || u.status === "notice").length / p.unit.length : 0 }));
      return { columns: [{ key: "property", label: "Property" }, { key: "owner", label: "Owner" }, { key: "address", label: "Address" }, { key: "type", label: "Type" }, { key: "units", label: "Units", kind: "number" }, { key: "occupied", label: "Occupied", kind: "number" }, { key: "occupancy", label: "Occupancy", kind: "percent" }], rows, totals: { property: "Total", units: sum(rows, "units"), occupied: sum(rows, "occupied") } };
    },
  },
  { id: "owner-statements", group: "Properties and owners", title: "Owner statements", replaces: "Owner Statement, Owner Statement (Enhanced), Owner Withholdings", filters: [], run: async () => ({ columns: [], rows: [], note: "Owner statements are made in Owners › Monthly close, with a PDF for each owner." }) },
  {
    id: "owner-directory",
    group: "Properties and owners",
    title: "Owner directory",
    replaces: "Owner Directory",
    filters: [],
    run: async (db, companyId) => {
      const { data } = await db.from("entity").select("name, entity_type, email, phone, mailing_address, property(name)").eq("company_id", companyId).eq("is_manager", false).order("name");
      const rows = (data ?? []).map((o) => ({ owner: o.name, type: o.entity_type ?? "", email: o.email ?? "", phone: o.phone ?? "", address: o.mailing_address ?? "", properties: o.property.map((p) => p.name).join(", ") }));
      return { columns: [{ key: "owner", label: "Owner" }, { key: "type", label: "Type" }, { key: "email", label: "E-mail" }, { key: "phone", label: "Phone" }, { key: "address", label: "Mailing address" }, { key: "properties", label: "Properties" }], rows };
    },
  },
  { id: "property-insurance", group: "Properties and owners", title: "Property insurance", replaces: "Owner Insurance, Owner Insurance Audit", filters: [], needs: "Each property's insurance policy: carrier, coverage and renewal date." },

  {
    id: "1099",
    group: "Tax",
    title: "1099s (vendors)",
    replaces: "Owner/Vendor 1099 Detail and Summary",
    filters: ["range", "owner"],
    run: async (db, companyId, f) => {
      let q = db.from("bill").select("amount_cents, paid_on, vendor_id, vendor!inner(is_1099, w9_on_file, contact(kind, first_name, last_name, business_name))").eq("company_id", companyId).eq("status", "paid").eq("vendor.is_1099", true).gte("paid_on", f.from).lte("paid_on", f.to);
      if (f.owner) q = q.eq("entity_id", f.owner);
      const { data } = await q;
      const by = new Map<string, { vendor: string; w9: string; paid: number }>();
      for (const b of data ?? []) {
        const r = by.get(b.vendor_id ?? "none") ?? { vendor: contactName(b.vendor.contact), w9: b.vendor.w9_on_file ? "On file" : "Missing", paid: 0 };
        r.paid += b.amount_cents;
        by.set(b.vendor_id ?? "none", r);
      }
      // IRS 1099-NEC: nonemployee compensation of $600 or more in the calendar year (thresholds change; check the IRS instructions).
      const rows = [...by.values()].map((r) => ({ ...r, needs1099: r.paid >= 60000 ? "Yes" : "No" })).sort((a, b) => b.paid - a.paid);
      return { columns: [{ key: "vendor", label: "Vendor" }, { key: "w9", label: "W-9" }, { key: "paid", label: "Paid in period", kind: "money" }, { key: "needs1099", label: "1099 likely needed" }], rows, note: "Use the calendar year. Check the IRS 1099-NEC threshold for the year you're filing." };
    },
  },
  {
    id: "schedule-e",
    group: "Tax",
    title: "Schedule E by property",
    replaces: "New: rental income and expenses by property for tax prep",
    filters: ["range", "owner"],
    run: async (db, companyId, f) => {
      if (!f.owner) return { columns: [], rows: [], note: "Choose an owner: each owner keeps its own books." };
      const { data } = await db
        .from("journal_line")
        .select("debit_cents, credit_cents, property(name), journal_entry!inner(entity_id, entry_date), gl_account!inner(number, name, type)")
        .eq("company_id", companyId)
        .eq("journal_entry.entity_id", f.owner)
        .in("journal_entry.status", ["posted", "reversed"])
        .gte("journal_entry.entry_date", f.from)
        .lte("journal_entry.entry_date", f.to)
        .in("gl_account.type", ["income", "expense"])
        .limit(10000);
      const by = new Map<string, { property: string; account: string; type: string; amount: number }>();
      for (const l of data ?? []) {
        const key = `${l.property?.name ?? "(no property)"}|${l.gl_account.number}`;
        const r = by.get(key) ?? { property: l.property?.name ?? "(no property)", account: `${l.gl_account.number} ${l.gl_account.name}`, type: l.gl_account.type === "income" ? "Income" : "Expense", amount: 0 };
        r.amount += normalBalance({ type: l.gl_account.type, debit_cents: Number(l.debit_cents), credit_cents: Number(l.credit_cents) });
        by.set(key, r);
      }
      const rows = [...by.values()].sort((a, b) => a.property.localeCompare(b.property) || a.account.localeCompare(b.account));
      return { columns: [{ key: "property", label: "Property" }, { key: "type", label: "Type" }, { key: "account", label: "Account" }, { key: "amount", label: "Amount", kind: "money" }], rows, note: "Give this to your tax preparer with the year's statements. Depreciation isn't included." };
    },
  },

  {
    id: "users",
    group: "Admin",
    title: "Users and permissions",
    replaces: "Users, User Roles and Permissions",
    filters: [],
    run: async (db, companyId) => {
      const { data } = await db.from("membership").select("role, title, status, all_properties, created_at, profile(full_name, email)").eq("company_id", companyId);
      const rows = (data ?? []).map((m) => ({ name: m.profile?.full_name ?? "", email: m.profile?.email ?? "", role: m.role.replace(/_/g, " "), title: m.title ?? "", access: m.all_properties ? "All properties" : "Some properties", status: m.status, since: m.created_at.slice(0, 10) }));
      return { columns: [{ key: "name", label: "Name" }, { key: "email", label: "E-mail" }, { key: "role", label: "Role" }, { key: "title", label: "Title" }, { key: "access", label: "Access" }, { key: "status", label: "Status" }, { key: "since", label: "Added", kind: "date" }], rows };
    },
  },
  {
    id: "delivery-log",
    group: "Admin",
    title: "Delivery and import log",
    replaces: "Email Delivery Errors, Import Variances, Merge Variances",
    filters: ["range"],
    run: async (db, companyId, f) => {
      const end = `${f.to}T23:59:59.999Z`;
      const [{ data: messages }, { data: imports }] = await Promise.all([
        db.from("message").select("created_at, channel, subject, status, delivery, legal, contact(kind, first_name, last_name, business_name)").eq("company_id", companyId).eq("direction", "outbound").gte("created_at", f.from).lte("created_at", end).order("created_at", { ascending: false }).limit(5000),
        db.from("import_batch").select("created_at, kind, file_name, summary, undone_at").eq("company_id", companyId).gte("created_at", f.from).lte("created_at", end).order("created_at", { ascending: false }),
      ]);
      const STATUS: Record<string, string> = { queued: "Waiting to send", sent: "Sent", delivered: "Delivered", opened: "Opened", failed: "Failed", simulated: "Not sent (e-mail not set up)" };
      const rows = [
        ...(messages ?? []).map((m) => ({
          date: m.created_at.slice(0, 10),
          what: `${m.legal ? "Legal notice" : m.channel === "letter" ? "Letter" : m.channel === "email" ? "E-mail" : m.channel === "sms" ? "Text" : "Portal message"}${m.subject ? `: ${m.subject}` : ""}`,
          to: contactName(m.contact),
          status: STATUS[m.status] ?? m.status,
          detail: m.delivery ?? "",
          problem: ["failed", "simulated", "queued"].includes(m.status) ? "Check" : "",
        })),
        ...(imports ?? []).map((b) => ({ date: b.created_at.slice(0, 10), what: `Import: ${b.kind.replace(/_/g, " ")}${b.file_name ? ` (${b.file_name})` : ""}`, to: "", status: b.undone_at ? `Undone ${b.undone_at.slice(0, 10)}` : "Imported", detail: b.summary ?? "", problem: "" })),
      ].sort((a, b) => Number(Boolean(b.problem)) - Number(Boolean(a.problem)) || b.date.localeCompare(a.date));
      return {
        columns: [{ key: "date", label: "Date", kind: "date" }, { key: "what", label: "What" }, { key: "to", label: "To" }, { key: "status", label: "Status" }, { key: "detail", label: "How it was delivered / result" }, { key: "problem", label: "Needs a look" }],
        rows,
        note: "Problems first: anything that failed, is still waiting, or wasn't sent because e-mail isn't set up.",
      };
    },
  },
];

export const reportById = (id: string) => REPORTS.find((r) => r.id === id);
