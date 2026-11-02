import { Button, Card, CardHeader, Notice, Pill } from "@/components/ui";
import { readBusinessRules } from "@/lib/business-rules";
import { stripeConfigured } from "@/lib/integrations/stripe/client";
import { isAdmin, requireCompany } from "@/lib/session";
import { connectStripe, refreshStripe } from "./actions";

export const metadata = { title: "Payments" };

export default async function PaymentsSettingsPage({ searchParams }: PageProps<"/settings/payments">) {
  const { company, membership } = await requireCompany();
  const sp = await searchParams;
  if (sp.return && company.stripe_account_id && isAdmin(membership)) await refreshStripe();
  const rules = readBusinessRules(company.settings);
  const platform = stripeConfigured();
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader
          title="Online rent payments"
          description={`Tenants pay from their portal by bank transfer (free to them) or card (debit cards free; credit cards pay your processing cost of ${rules.rent.cardCostPercent}% + $${(rules.rent.cardCostFixedCents / 100).toFixed(2)}, never more than 3%, shown before they pay). Money goes to your own Stripe account and out to your bank.`}
          action={company.stripe_charges_enabled ? <Pill tone="success">On</Pill> : company.stripe_account_id ? <Pill tone="warn">Setup not finished</Pill> : <Pill>Off</Pill>}
        />
        <div className="space-y-3 px-5 py-4">
          {typeof sp.error === "string" && <Notice tone="danger">Stripe couldn&apos;t start the setup: {sp.error}</Notice>}
          {!platform ? (
            <Notice tone="warn">Parcel Manage&apos;s Stripe platform account isn&apos;t connected yet, so online payments can&apos;t be turned on. Until then, tenants are told to contact the office (or, if you take checks, how to pay by check or money order).</Notice>
          ) : !isAdmin(membership) ? (
            <Notice>Only an admin can set up payments.</Notice>
          ) : (
            <>
              <form action={connectStripe}>
                <Button type="submit">{company.stripe_account_id ? (company.stripe_charges_enabled ? "Update Stripe details" : "Finish Stripe setup") : "Connect Stripe"}</Button>
              </form>
              {company.stripe_account_id && (
                <form action={refreshStripe}>
                  <Button type="submit" small variant="ghost">
                    Check status
                  </Button>
                </form>
              )}
            </>
          )}
          <p className="text-[13px] text-subtle">The credit card fee is a company setting (Settings → Business rules). Returned bank payments are reversed on the ledger and the lease&apos;s returned-payment fee is charged.</p>
        </div>
      </Card>
    </div>
  );
}
