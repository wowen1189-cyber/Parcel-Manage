import Link from "next/link";
import { Card, Notice } from "@/components/ui";
import { readCardChoice } from "@/lib/card-payment";
import { money } from "@/lib/format";
import { leasePaymentAccount } from "@/lib/payment-account";
import { requireTenant } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmCardForm } from "../pay-form";

export const metadata = { title: "Confirm card payment" };

// After Stripe saved the card: the exact total, with the fee only for a credit card, before anything is charged.
export default async function ConfirmCardPage({ searchParams }: PageProps<"/portal/pay/card">) {
  const sp = await searchParams;
  const { company, lease } = await requireTenant();
  const to = await leasePaymentAccount(createAdminClient(), company.id, lease.id);
  const choice = to.ready && to.account && typeof sp.session === "string" ? await readCardChoice(to.account, sp.session, company.id, lease.id) : null;
  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold">Confirm your payment</h1>
      {!choice ? (
        <Notice tone="warn">
          That card couldn&apos;t be found.{" "}
          <Link href="/portal/pay" className="font-semibold underline">
            Start again
          </Link>
        </Notice>
      ) : (
        <Card className="space-y-4 p-5">
          <p className="font-semibold">{choice.label}</p>
          <div className="rounded-[var(--radius-control)] bg-surface-muted px-4 py-3 text-[15px]">
            <p className="flex justify-between">
              <span>Payment</span>
              <span>{money(choice.amountCents)}</span>
            </p>
            <p className="flex justify-between">
              <span>{choice.feeCents ? "Credit card fee" : "Card fee"}</span>
              <span>{choice.feeCents ? money(choice.feeCents) : "None"}</span>
            </p>
            <p className="mt-1 flex justify-between border-t border-line pt-1 font-bold">
              <span>Total charged</span>
              <span>{money(choice.amountCents + choice.feeCents)}</span>
            </p>
          </div>
          <p className="text-[13px] text-subtle">
            {choice.feeCents
              ? "Credit cards pay what card processing costs us, never more than 3%. Debit cards and bank payments have no fee."
              : choice.funding === "credit"
                ? "No fee on this payment."
                : "Debit and prepaid cards have no fee."}
          </p>
          <ConfirmCardForm sessionId={choice.sessionId} totalLabel={money(choice.amountCents + choice.feeCents)} />
          <p className="text-center text-[14px]">
            <Link href="/portal/pay" className="font-semibold text-muted hover:underline">
              Use a different card or my bank account
            </Link>
          </p>
        </Card>
      )}
    </div>
  );
}
