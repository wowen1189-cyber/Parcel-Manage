import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, PageHeader, Pill } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { date } from "@/lib/format";
import { DELIVERY_LABEL, letterById } from "@/lib/letters";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Letter" };

export default async function LetterPage({ params, searchParams }: PageProps<"/communications/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company } = await requireCompany();
  const { data: m } = await supabase.from("message").select("id, subject, body, delivery, channel, legal, status, sender_name, sender_title, created_at, template_id, lease_id").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!m) notFound();
  const template = m.template_id ? letterById(m.template_id) : undefined;
  const print = m.delivery && ["posted", "hand_delivered", "mail", "certified_mail", "print"].includes(m.delivery);

  return (
    <>
      <div className="print:hidden">
        <p className="mb-2 text-[13px]">
          <Link href="/communications" className="font-semibold text-accent hover:underline">
            ← Communications
          </Link>
          {m.lease_id && (
            <>
              {" · "}
              <Link href={`/tenants/${m.lease_id}`} className="font-semibold text-accent hover:underline">
                Tenant
              </Link>
            </>
          )}
        </p>
        <PageHeader
          title={m.subject ?? "Message"}
          subtitle={`${DELIVERY_LABEL[m.delivery ?? m.channel] ?? m.channel} · ${date(m.created_at.slice(0, 10))} · ${[m.sender_name, m.sender_title].filter(Boolean).join(", ")}`}
          action={print ? <PrintButton /> : m.legal ? <Pill tone="warn">Legal notice</Pill> : undefined}
        />
        {sp.sent && <Notice tone="success">{print ? "Saved and filed. Print it now, then deliver it as you chose." : m.status === "failed" ? "Saved, but the e-mail didn't send. Try printing it instead." : "Sent and filed on the tenant's record."}</Notice>}
        {m.legal && print && (
          <Notice tone="warn">
            Keep proof of delivery: note the date, time and how you delivered it{m.delivery === "certified_mail" ? ", and keep the certified mail receipt" : ""}. Deadlines count from delivery.
          </Notice>
        )}
      </div>
      <Card className="mx-auto mt-4 max-w-[760px] p-10 print:border-0 print:p-0">
        <p className="text-[13px] text-subtle">{company.legal_name ?? company.name}</p>
        <p className="text-[13px] text-subtle">{[company.address, company.office_phone].filter(Boolean).join(" · ")}</p>
        <p className="mt-6 text-[14px]">{date(m.created_at.slice(0, 10))}</p>
        <h1 className="mt-4 text-[18px] font-bold">{m.subject}</h1>
        {template?.cite && <p className="text-[12px] text-subtle">{template.cite}</p>}
        <div className="mt-4 space-y-3 font-serif text-[15px] leading-relaxed">
          {m.body.split("\n\n").map((x, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {x}
            </p>
          ))}
        </div>
      </Card>
    </>
  );
}
