import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { date, money } from "@/lib/format";
import { adverseActionText, unitName } from "@/lib/leasing";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Adverse action notice" };

/** Printable FCRA adverse action notice, one page per adult, for mailing. */
export default async function NoticePage({ params }: PageProps<"/leasing/applications/[id]/notice">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data: a } = await supabase
    .from("application")
    .select("decision, deposit_cents, decided_at, adverse_agency, unit(label, property(name)), application_member(role, first_name, last_name, answers, screening_report(credit_score, received_at))")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!a?.adverse_agency) notFound();
  const agency = a.adverse_agency as { name: string; address: string; phone: string };
  const adults = a.application_member.filter((m) => m.role !== "guarantor" || m.screening_report);
  return (
    <main className="mx-auto max-w-[720px] px-4 py-8 print:p-0">
      <div className="mb-6 print:hidden">
        <PrintButton />
      </div>
      {adults.map((m) => {
        const name = `${m.first_name} ${m.last_name}`.trim();
        const address = (m.answers as Record<string, string> | null)?.current_address ?? "";
        return (
          <article key={name} className="mb-12 break-after-page space-y-4 text-[15px] leading-relaxed">
            <header>
              <p className="font-bold">{company.name}</p>
              {company.address && <p>{company.address}</p>}
              <p className="mt-4">{date(a.decided_at)}</p>
              <p className="mt-4">{name}</p>
              {address && <p>{address}</p>}
            </header>
            <h1 className="text-[18px] font-bold">Notice of adverse action</h1>
            {adverseActionText({
              applicant: name,
              company: company.name,
              unit: unitName(a.unit),
              action: a.decision === "decline" ? "decline" : "higher_deposit",
              depositText: a.deposit_cents ? money(a.deposit_cents) : undefined,
              agency,
              score: m.screening_report?.credit_score ? { value: m.screening_report.credit_score, date: date(m.screening_report.received_at) } : null,
              reasons: [],
            }).map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="pt-6">{company.name}</p>
          </article>
        );
      })}
    </main>
  );
}
