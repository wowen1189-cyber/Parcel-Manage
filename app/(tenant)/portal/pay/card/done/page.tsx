import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { finishCardPayment } from "@/lib/card-payment";
import { leasePaymentAccount } from "@/lib/payment-account";
import { requireTenant } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Card payment" };

// Back from the card's bank (3-D Secure): record the payment if it went through.
export default async function CardDonePage({ searchParams }: PageProps<"/portal/pay/card/done">) {
  const sp = await searchParams;
  const { company, lease } = await requireTenant();
  const to = await leasePaymentAccount(createAdminClient(), company.id, lease.id);
  const r = to.ready && to.account && typeof sp.payment_intent === "string" ? await finishCardPayment(to.account, sp.payment_intent, company.id, lease.id) : { error: "That payment couldn't be found." };
  if ("paid" in r) redirect("/portal/payments?paid=1");
  if ("redirect" in r) redirect(r.redirect);
  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold">Payment not finished</h1>
      <Notice tone="warn">{r.error}</Notice>
      <Link href="/portal/pay" className="font-semibold text-accent">
        Back to Pay rent
      </Link>
    </div>
  );
}
