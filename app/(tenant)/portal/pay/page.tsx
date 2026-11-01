import { Card, Notice } from "@/components/ui";
import { readBusinessRules } from "@/lib/business-rules";
import { money } from "@/lib/format";
import { buildLedger } from "@/lib/ledger";
import { requireTenant } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { PayForm } from "./pay-form";

export const metadata = { title: "Pay rent" };

export default async function PayPage() {
  const { supabase, company, lease } = await requireTenant();
  const [{ data: c }, { data: charges }, { data: payments }, { data: full }] = await Promise.all([
    createAdminClient().from("company").select("settings, stripe_charges_enabled").eq("id", company.id).single(),
    supabase.from("charge").select("id, charge_type, description, amount_cents, due_date, created_at").eq("lease_id", lease.id),
    supabase.from("payment").select("id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at").eq("lease_id", lease.id),
    supabase.from("lease").select("opening_balance_cents, opening_balance_as_of, certified_funds_only").eq("id", lease.id).single(),
  ]);
  const { balanceCents } = buildLedger(charges ?? [], payments ?? [], { cents: full?.opening_balance_cents ?? null, asOf: full?.opening_balance_as_of ?? null });
  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold">Pay rent</h1>
      <p className="text-muted">You owe {money(Math.max(0, balanceCents))}.</p>
      {!c?.stripe_charges_enabled ? (
        <Notice>Online payments aren&apos;t turned on yet. Pay by check or money order to {company.name}{company.office_phone ? `, or call ${company.office_phone}` : ""}.</Notice>
      ) : full?.certified_funds_only ? (
        <Notice tone="warn">Your account requires payment by money order or cashier&apos;s check. Contact the office.</Notice>
      ) : (
        <Card className="p-5">
          <PayForm balanceCents={balanceCents} feePercent={readBusinessRules(c.settings).rent.cardFeePercent} />
        </Card>
      )}
    </div>
  );
}
