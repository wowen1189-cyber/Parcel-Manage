import Link from "next/link";
import { Card, EmptyState, Notice } from "@/components/ui";
import { date, money, todayIn } from "@/lib/format";
import { requireTenant } from "@/lib/portal";
import { choiceSchema, describeChoice } from "@/lib/renewal-offers";
import { RenewalAnswer } from "./answer";

export const metadata = { title: "Renewal" };

// The tenant's renewal offer: the options the office sent, to choose from.
export default async function PortalRenewalPage() {
  const { supabase, company, lease } = await requireTenant();
  const { data: offer } = await supabase.from("renewal_offer").select("id, status, options, message, respond_by, chosen_option").eq("lease_id", lease.id).in("status", ["sent", "accepted", "applied", "declined"]).order("sent_at", { ascending: false }).limit(1).maybeSingle();
  const options = ((offer?.options as unknown[]) ?? []).map((raw) => choiceSchema.safeParse(raw)).flatMap((r) => (r.success ? [r.data] : []));
  const open = offer?.status === "sent" && offer.respond_by >= todayIn(company.time_zone);
  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold">Renew your lease</h1>
      {!offer ? (
        <Card>
          <EmptyState title="No renewal offer yet">The office will send your options before your lease ends{lease.end_date ? ` on ${date(lease.end_date)}` : ""}.</EmptyState>
        </Card>
      ) : open ? (
        <Card className="space-y-4 p-5">
          <p className="text-muted">Your lease ends {lease.end_date ? date(lease.end_date) : "soon"}. Choose one option by <strong className="text-ink">{date(offer.respond_by)}</strong>.</p>
          {offer.message && <p className="whitespace-pre-wrap rounded-[var(--radius-control)] bg-surface-muted px-4 py-3 text-[14px]">{offer.message}</p>}
          <RenewalAnswer
            offerId={offer.id}
            options={options.map((c) => ({
              title: c.kind === "mtm" ? `Month-to-month: ${money(c.rentCents)} a month` : `${c.months}-month lease: ${money(c.rentCents)} a month`,
              detail: describeChoice(c, money, date),
            }))}
          />
        </Card>
      ) : offer.status === "declined" ? (
        <Notice>You told the office you won&apos;t renew. Questions? Contact {company.name}.</Notice>
      ) : offer.status === "sent" ? (
        <Notice tone="warn">Your renewal offer closed on {date(offer.respond_by)}. Please contact {company.name}.</Notice>
      ) : (
        <Notice tone="success">
          You chose: {offer.chosen_option != null && options[offer.chosen_option] ? describeChoice(options[offer.chosen_option], money, date) : "an option"}.{" "}
          {offer.chosen_option != null && options[offer.chosen_option]?.kind === "mtm" ? "The office will confirm your month-to-month terms." : "The office will send your renewal lease to sign."}
        </Notice>
      )}
      <p className="text-[14px]">
        <Link href="/portal/messages" className="font-semibold text-accent">
          Message the office
        </Link>
      </p>
    </div>
  );
}
