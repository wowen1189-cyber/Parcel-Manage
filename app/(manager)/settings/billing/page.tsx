import { Card, CardHeader, Notice } from "@/components/ui";
import { readBillingSettings } from "@/lib/billing-run";
import { readBusinessRules } from "@/lib/business-rules";
import { isAdmin, requireCompany } from "@/lib/session";
import { oldSystemName } from "@/lib/switch-over";
import { BillingStartForm, OpeningBalancesForm, RunBillingButton } from "./forms";

export const metadata = { title: "Billing" };

export default async function BillingSettingsPage() {
  const { supabase, company, membership } = await requireCompany();
  const billing = readBillingSettings(company.settings);
  const rules = readBusinessRules(company.settings);
  const canEdit = isAdmin(membership);
  const old = oldSystemName(company.settings);
  const { data: asOf } = await supabase.from("lease").select("opening_balance_as_of").eq("company_id", company.id).not("opening_balance_as_of", "is", null).limit(1);

  return (
    <div className="max-w-3xl space-y-6">
      {!canEdit && <Notice>Only admins can change billing.</Notice>}
      <Card>
        <CardHeader
          title="Automatic billing"
          description={
            billing.startsOn
              ? `On from ${billing.startsOn.slice(0, 7)}. Rent and monthly charges post on day ${rules.rent.dueDay}; late fees post when rent is still unpaid on the late day (each lease's own terms, or $${rules.rent.lateFeeCents / 100} on day ${rules.rent.lateFeeDay}).`
              : `Off. While ${old} still bills your tenants, leave this off so nobody is billed twice.`
          }
        />
        <div className="space-y-4 px-5 py-4">
          <BillingStartForm startsMonth={billing.startsOn?.slice(0, 7) ?? ""} canEdit={canEdit} />
          {billing.startsOn && <RunBillingButton canEdit={canEdit} />}
          <p className="text-[13px] text-subtle">Runs every morning. Each charge posts once, as a balanced entry in the owner&apos;s books.</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Switch over from your old software" description={`Bring each tenant's balance from ${old} onto their ledger as of the cutover date, so ledgers continue where ${old} left off. Each lease is posted once; running it again skips leases already done.`} />
        <div className="px-5 py-4">
          <OpeningBalancesForm defaultDate={asOf?.[0]?.opening_balance_as_of ?? ""} canEdit={canEdit} old={old} />
        </div>
      </Card>
    </div>
  );
}
