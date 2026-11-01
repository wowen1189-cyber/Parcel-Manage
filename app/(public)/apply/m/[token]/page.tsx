import { Logo } from "@/components/logo";
import { AUTHORIZATION, sectionsFor } from "@/lib/application-form";
import { money } from "@/lib/format";
import { unitName } from "@/lib/leasing";
import { feeText, publicCompany } from "@/lib/public-leasing";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/vendor-requests";
import { ApplicationForm } from "../../application-form";

export const metadata = { title: "Rental application" };

const ROLE: Record<string, string> = { applicant: "", co_applicant: "Co-applicant · ", guarantor: "Guarantor · " };

/** A personal application link (sent by the office, or by the main applicant for other adults). */
export default async function InvitedApplyPage({ params }: PageProps<"/apply/m/[token]">) {
  const { token } = await params;
  const company = await publicCompany();
  const db = createAdminClient();
  const { data: m } = company
    ? await db
        .from("application_member")
        .select("id, role, first_name, last_name, email, phone, status, opened_at, application(kind, status, rent_cents, unit(label, property(name)))")
        .eq("token_hash", hashToken(token))
        .eq("company_id", company.id)
        .maybeSingle()
    : { data: null };
  const closed = !m || m.status === "applied" || ["declined", "withdrawn", "signed"].includes(m.application.status);
  if (m && !m.opened_at) await db.from("application_member").update({ opened_at: new Date().toISOString() }).eq("id", m.id);
  const kind = m?.application.kind === "commercial" ? "commercial" : "residential";
  return (
    <main className="mx-auto max-w-[760px] px-4 py-8 sm:py-12">
      <div className="mb-6">
        <Logo companyName={company?.name} />
      </div>
      {closed || !company ? (
        <>
          <h1 className="text-[28px] font-extrabold">This link isn&apos;t active</h1>
          <p className="mt-3 text-[17px] text-muted">{m?.status === "applied" ? "You've already sent your application. Thank you!" : `It may have been replaced by a newer link. Contact ${company?.name ?? "the office"}${company?.office_phone ? ` at ${company.office_phone}` : ""}.`}</p>
        </>
      ) : (
        <>
          <h1 className="text-[28px] font-extrabold leading-tight">{kind === "commercial" ? "Commercial rental application" : "Rental application"}</h1>
          <p className="mt-1 mb-8 text-[16px] text-muted">
            {ROLE[m.role]}
            {unitName(m.application.unit)} · {money(m.application.rent_cents)}/month
          </p>
          <ApplicationForm
            mode="invited"
            hidden={{ token }}
            sections={sectionsFor(kind, m.role)}
            defaults={{ first_name: m.first_name, last_name: m.last_name, email: m.email ?? "", phone: m.phone ?? "" }}
            inviteOthers={m.role === "applicant" && kind === "residential"}
            feeText={feeText(company.settings, m.role, Boolean(company.stripe_charges_enabled))}
            authorization={AUTHORIZATION}
          />
        </>
      )}
    </main>
  );
}
