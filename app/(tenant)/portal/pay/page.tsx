import { Card, Notice } from "@/components/ui";
import { readBusinessRules } from "@/lib/business-rules";
import { money } from "@/lib/format";
import { buildLedger } from "@/lib/ledger";
import { leasePaymentAccount } from "@/lib/payment-account";
import { requireTenant } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { stopAutopay } from "./actions";
import { AutopayForm, PayForm } from "./pay-form";

export const metadata = { title: "Pay rent" };

export default async function PayPage({ searchParams }: PageProps<"/portal/pay">) {
  const sp = await searchParams;
  const { supabase, company, lease } = await requireTenant();
  const [{ data: c }, { data: charges }, { data: payments }, { data: full }] = await Promise.all([
    createAdminClient().from("company").select("settings").eq("id", company.id).single(),
    supabase.from("charge").select("id, charge_type, description, amount_cents, due_date, created_at").eq("lease_id", lease.id),
    supabase.from("payment").select("id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at").eq("lease_id", lease.id),
    supabase.from("lease").select("opening_balance_cents, opening_balance_as_of, certified_funds_only").eq("id", lease.id).single(),
  ]);
  const { data: autopay } = await supabase.from("autopay").select("bank_label, day_of_month, max_cents, last_result").eq("lease_id", lease.id).eq("active", true).maybeSingle();
  const rules = readBusinessRules(c?.settings);
  const online = (await leasePaymentAccount(createAdminClient(), company.id, lease.id)).ready;
  const { balanceCents } = buildLedger(charges ?? [], payments ?? [], { cents: full?.opening_balance_cents ?? null, asOf: full?.opening_balance_as_of ?? null });
  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold">Pay rent</h1>
      <p className="text-muted">You owe {money(Math.max(0, balanceCents))}.</p>
      {!online ? (
        rules.rent.onlineOnly ? (
          <Notice>Online payments are being set up. Contact {company.name}{company.office_phone ? ` at ${company.office_phone}` : ""} before your rent is due.</Notice>
        ) : (
          <Notice>Online payments aren&apos;t turned on yet. Pay by check or money order to {company.name}{company.office_phone ? `, or call ${company.office_phone}` : ""}.</Notice>
        )
      ) : full?.certified_funds_only ? (
        <Notice tone="warn">Your account requires payment by money order or cashier&apos;s check. Contact the office.</Notice>
      ) : (
        <Card className="p-5">
          <PayForm balanceCents={balanceCents} />
        </Card>
      )}
      {online && !full?.certified_funds_only && (
        <Card className="p-5">
          <h2 className="mb-3 text-[17px] font-bold">Autopay</h2>
          {sp.autopay && !autopay && <Notice>Your bank is being linked. This page will show autopay as on within a minute.</Notice>}
          {autopay ? (
            <div className="space-y-3 text-[15px]">
              <p>
                On. We draft {autopay.bank_label} on day {autopay.day_of_month} of each month for the balance due{autopay.max_cents ? `, up to ${money(autopay.max_cents)}` : ""}.
              </p>
              {autopay.last_result && <p className="text-[13px] text-subtle">Last run: {autopay.last_result}</p>}
              <form action={stopAutopay}>
                <button className="min-h-11 text-[14px] font-semibold text-danger">Turn off autopay</button>
              </form>
            </div>
          ) : (
            <AutopayForm companyName={company.name} />
          )}
        </Card>
      )}
    </div>
  );
}
