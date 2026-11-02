import Link from "next/link";
import { Button, Card, Field, Input, PageHeader, Pill } from "@/components/ui";
import { readAutomationSettings } from "@/lib/automation-rules";
import { readBillingSettings } from "@/lib/billing-run";
import { date } from "@/lib/format";
import { isAdmin, requireCompany } from "@/lib/session";
import { CUTOVER_DEPOSIT_REFS, PREVIOUS_SOFTWARE, oldSystemName, previousSoftware } from "@/lib/switch-over";
import { setPreviousSoftware, toggleStep } from "./actions";

export const metadata = { title: "Switch-over checklist" };

// docs/08 Phase 4: the steps to leave the company's old software (AppFolio, Buildium, Yardi, ...) safely. Most tick themselves off from the data.
export default async function SwitchOverPage() {
  const { supabase, company, membership } = await requireCompany();
  const [{ count: leases }, { count: opened }, { count: deposits }, { data: banks }, { count: autopays }, { count: owners }] = await Promise.all([
    supabase.from("lease").select("id", { count: "exact", head: true }).eq("company_id", company.id).in("status", ["active", "notice"]),
    supabase.from("charge").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("charge_type", "opening_balance"),
    supabase.from("payment").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("purpose", "deposit").in("reference", CUTOVER_DEPOSIT_REFS),
    supabase.from("bank_account").select("id, name, reconciliation(completed_at)").eq("company_id", company.id),
    supabase.from("autopay").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("active", true),
    supabase.from("entity").select("id", { count: "exact", head: true }).eq("company_id", company.id),
  ]);
  const billing = readBillingSettings(company.settings).startsOn;
  const manual = ((company.settings as Record<string, unknown> | null)?.switchOver ?? {}) as Record<string, string | null>;
  const reconciled = (banks ?? []).filter((b) => b.reconciliation.some((r) => r.completed_at)).length;
  const admin = isAdmin(membership);
  const from = previousSoftware(company.settings);
  const old = oldSystemName(company.settings);
  const importHow =
    from === "AppFolio"
      ? "AppFolio's Rent Roll, Tenant Directory, Vendor Directory and Owner Directory read directly."
      : "Exports from any other software or a spreadsheet go through Import data (being built), which matches the columns.";
  const steps: { title: string; detail: string; needs: string[]; done: boolean; when?: string | null; href?: string; manual?: string }[] = [
    { title: `Import the final data from ${old}`, detail: `Rent roll, tenants, vendors and owners as of the last day on ${old}. ${importHow} ${leases ?? 0} current leases and ${owners ?? 0} owners are in Parcel Manage now.`, needs: ["Rent roll export (CSV or Excel), run on the cutover date, with each tenant's balance and deposit", "Tenant directory or contact list (phones, e-mails, co-signers)", "Vendor directory (with W-9 and insurance details if you have them)", "Owner directory (each owner or LLC and the properties it owns)"], done: (leases ?? 0) > 0, href: from === "AppFolio" ? undefined : "/import" },
    { title: "Post tenant balances as of the cutover date", detail: `${opened ?? 0} balances posted. Settings › Billing › Cutover.`, needs: ["The rent roll above: each tenant's balance comes from it", `Aged receivables (who owes what) from ${old} as of the cutover date, to check the total matches`], done: (opened ?? 0) > 0, href: "/settings/billing" },
    { title: "Post security deposits held", detail: `${deposits ?? 0} deposits moved into trust books (Fla. Stat. 83.49).`, needs: ["The rent roll above: each lease's deposit comes from it", `The security deposit report from ${old} as of the cutover date, to check the total`, "The trust bank statement for the cutover month", "If deposits move to a different bank or account: a letter to each tenant within 30 days naming the new bank and its address (Fla. Stat. 83.49(2); not needed under 5 units)"], done: (deposits ?? 0) > 0, href: "/settings/billing" },
    { title: "Turn on billing from the first Parcel Manage month", detail: billing ? `Billing starts ${date(billing)}.` : "Not set yet.", needs: [`The last month ${old} billed (its charges report), so Parcel Manage starts the month after`], done: Boolean(billing), href: "/settings/billing" },
    { title: "Connect online payments (Stripe)", detail: company.stripe_charges_enabled ? "Connected." : "Not connected yet.", needs: ["Typed into Stripe's own page, not here: legal business name and EIN", "Business address and phone", "Bank routing and account number for payouts", "Your date of birth and last 4 of your SSN (Stripe verifies the business owner)"], done: Boolean(company.stripe_charges_enabled), href: "/settings/payments" },
    { title: "Tell tenants how to pay and set up autopay", detail: `Send portal invites and ask tenants on autopay with ${old} to re-enroll. ${autopays ?? 0} on autopay so far.`, needs: ["Tenant e-mail addresses (from the tenant directory)", `The list of tenants on autopay in ${old}`, `A short letter: how to pay now, the portal link, the date ${old} stops taking payments`, "If the address for notices or rent changes: say so in the same letter (Fla. Stat. 83.50)"], done: Boolean(manual.tenants_told), when: manual.tenants_told, manual: "tenants_told" },
    { title: "Run one month side by side", detail: `Run Parcel Manage and ${old} together for a month and compare rent posted, payments and owner statements.`, needs: [`Rent roll, receivables and owner statements from ${old} for the month`, "The same reports from Parcel Manage (Reports)"], done: Boolean(manual.parallel_run), when: manual.parallel_run, manual: "parallel_run" },
    { title: "Reconcile every bank and trust account", detail: `${reconciled} of ${(banks ?? []).length} bank accounts reconciled at least once. Trust must equal deposits held (Reports › Security deposit trust reconciliation).`, needs: ["Bank statements for every operating and trust account, for the cutover month", `The last bank reconciliation from ${old} for each account`, "Your monthly broker escrow reconciliation, if you keep one outside your software"], done: (banks ?? []).length > 0 && reconciled === (banks ?? []).length, href: "/bank-accounts" },
    { title: "Owner and partner sign-off", detail: "Owners (and any partners) review the first Parcel Manage statement and agree it matches.", needs: [`The last owner statement from ${old} and the first Parcel Manage statement, for each owner`, "A written OK from each owner and partner (an e-mail reply is fine)"], done: Boolean(manual.owner_signoff), when: manual.owner_signoff, manual: "owner_signoff" },
    { title: "Turn on automations", detail: "Rent reminders, insurance reminders and To do items.", needs: [`Nothing to gather. Turn off the reminders in ${old} the same day so tenants don't hear twice`], done: readAutomationSettings(company.settings).enabled, href: "/settings/automations" },
    { title: `Cancel ${old}`, detail: "Only after everything above is done. Download any reports you want to keep first.", needs: ["Downloads to keep: general ledger, owner statements, tenant ledgers, bank reconciliations and 1099s for past years", "Lease files, signed documents and work order history", `Your ${from ?? "software"} contract, to see how much written notice it needs to cancel`], done: Boolean(manual.appfolio_canceled), when: manual.appfolio_canceled, manual: "appfolio_canceled" },
  ];
  return (
    <>
      <PageHeader title="Switch-over checklist" subtitle={`${steps.filter((s) => s.done).length} of ${steps.length} done. Leaving ${old} safely, in order.`} />
      {admin && (
        <Card className="mb-4">
          <form action={setPreviousSoftware} className="flex flex-wrap items-end gap-3 px-5 py-4">
            <Field label="Moving from" hint="The software (or spreadsheet) you're leaving. The checklist uses its name.">
              <Input name="from" list="previous-software" defaultValue={from ?? ""} placeholder="AppFolio, Buildium, Rent Manager…" className="w-72" />
            </Field>
            <datalist id="previous-software">
              {PREVIOUS_SOFTWARE.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <Button type="submit" small variant="secondary">
              Save
            </Button>
          </form>
        </Card>
      )}
      <Card>
        <ol className="divide-y divide-line">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-wrap items-start gap-4 px-5 py-4">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${s.done ? "bg-accent text-white" : "bg-surface-sunk text-muted"}`}>{s.done ? "✓" : i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {s.title} {s.done && <Pill tone="success">Done{s.when ? ` ${date(s.when)}` : ""}</Pill>}
                </p>
                <p className="text-[14px] text-muted">{s.detail}</p>
                {s.done ? (
                  <details className="mt-1 text-[14px] text-muted">
                    <summary className="min-h-11 cursor-pointer py-2 font-semibold">What you needed</summary>
                    <Needs items={s.needs} />
                  </details>
                ) : (
                  <div className="mt-2 text-[14px]">
                    <p className="font-semibold">You&apos;ll need</p>
                    <Needs items={s.needs} />
                  </div>
                )}
              </div>
              {s.href && (
                <Link href={s.href} className="min-h-11 text-[14px] font-semibold text-accent">
                  Open
                </Link>
              )}
              {s.manual && admin && (
                <form action={toggleStep}>
                  <input type="hidden" name="step" value={s.manual} />
                  <button className="min-h-11 text-[14px] font-semibold text-accent">{s.done ? "Undo" : "Mark done"}</button>
                </form>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}

function Needs({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
      {items.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}
