import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import type { DocText } from "@/lib/documents/text";
import { CONSENT_TEXT } from "@/lib/esign";
import { getRequestSubdomain } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/vendor-requests";
import { SignForm } from "./sign-form";

export const metadata: Metadata = { title: "Review and sign", robots: { index: false, follow: false } };

// The signer's page: the frozen documents, then consent and a typed signature. No account; the link is theirs.
export default async function SignPage({ params }: PageProps<"/sign/[token]">) {
  const { token } = await params;
  const db = createAdminClient();
  const subdomain = await getRequestSubdomain();
  const { data: s } = await db
    .from("signature_signer")
    .select("id, company_id, request_id, name, role, status, signature_request!inner(id, title, status, snapshot, management_agreement_id, company(name, subdomain))")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  const ok = s && s.signature_request.status === "sent" && s.signature_request.company.subdomain === subdomain && s.status !== "signed" && s.status !== "declined";
  if (!ok) {
    return (
      <main className="mx-auto max-w-[760px] px-4 py-10">
        <Logo />
        <h1 className="mt-8 text-[26px] font-extrabold">This link no longer works</h1>
        <p className="mt-2 text-muted">It may already be signed, or replaced by a newer e-mail. Contact the office if you need help.</p>
      </main>
    );
  }
  if (s.status !== "viewed") {
    await db.from("signature_signer").update({ status: "viewed" }).eq("id", s.id);
    await db.from("signature_event").insert({ company_id: s.company_id, request_id: s.request_id, signer_id: s.id, kind: "viewed" });
  }
  const docs = s.signature_request.snapshot as DocText[];
  // Leases have initials on every page; a management agreement only has signatures.
  const initials = !s.signature_request.management_agreement_id;

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[820px] px-4 py-8">
        <Logo companyName={s.signature_request.company.name} />
        <h1 className="mt-6 text-[28px] font-extrabold leading-tight">{s.signature_request.title}</h1>
        <p className="mt-1 text-muted">
          For {s.name}. Read everything below, then sign at the bottom.{initials ? " Your initials apply to every initials line." : ""}
        </p>
        <article className="mt-6 space-y-8 rounded-[var(--radius-card)] border border-line bg-surface p-6 font-serif text-[15px] leading-relaxed sm:p-10">
          {docs.map((d, i) => (
            <section key={i}>
              <h2 className="text-center font-sans text-[20px] font-extrabold">{d.title}</h2>
              {d.sections.map((sec, j) => (
                <div key={j} className="mt-5">
                  {sec.heading && <h3 className="font-sans text-[15px] font-bold">{sec.heading}</h3>}
                  {sec.paragraphs.map((p, k) => (
                    <p key={k} className="mt-2 whitespace-pre-wrap">
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </article>
        <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <h2 className="text-[18px] font-bold">Sign</h2>
          <div className="mt-3">
            <SignForm token={token} name={s.name} consentText={CONSENT_TEXT} initials={initials} />
          </div>
        </section>
      </div>
    </main>
  );
}
