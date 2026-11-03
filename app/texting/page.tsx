import Link from "next/link";
import { Logo } from "@/components/logo";
import { getRequestSubdomain } from "@/lib/session";
import { smsConsentText, vendorSmsConsentText } from "@/lib/sms-consent";
import { createAdminClient } from "@/lib/supabase/admin";

// Texting terms (public, /texting on parcelmanage.com and on each company's address). Carriers check this page
// during A2P 10DLC registration: who texts, how people agree, what they get, STOP/HELP, and that numbers aren't
// shared for marketing. Written Nov 3, 2026; the company should have an attorney review it.

export const metadata = { title: "Texting terms" };

const EFFECTIVE = "November 3, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default async function TextingTermsPage() {
  const subdomain = await getRequestSubdomain();
  const { data: company } = subdomain ? await createAdminClient().from("company").select("name, office_phone, office_email").eq("subdomain", subdomain).maybeSingle() : { data: null };
  const name = company?.name ?? "your property manager";
  const sender = company?.name ?? "Each property management company that uses Parcel Manage";
  const contact = [company?.office_phone, company?.office_email].filter(Boolean).join(" or ");
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/">
        <Logo companyName={company?.name} />
      </Link>
      <h1 className="mt-10 text-[34px] font-extrabold leading-tight tracking-[-0.02em]">Texting terms</h1>
      <p className="mt-2 text-muted">Effective {EFFECTIVE}</p>

      <Section title="Who sends the texts">
        <p>
          {sender} sends text messages through Parcel Manage, its property management software, to the tenants and vendors it works with. Texts come from the company&apos;s own local number{company ? "" : ", and each message starts with the company's name"}.
        </p>
      </Section>

      <Section title="What the texts are about">
        <ul className="list-disc space-y-2 pl-5">
          <li>Tenants: their account and rent, repair requests and repair visits, building notices, and replies to their messages.</li>
          <li>Vendors: new jobs and work orders, with a link to accept and schedule them.</li>
          <li>Office staff: alerts about emergency repair requests.</li>
        </ul>
        <p>These are service messages. We don&apos;t send marketing or advertising texts. Legal notices are not sent by text.</p>
      </Section>

      <Section title="How people agree to texts">
        <p>Nobody gets texts unless they agree themselves. Office staff can&apos;t turn texts on for anyone.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Tenants sign in to their tenant portal, open My lease, enter their mobile number and check a box next to this statement:</li>
        </ul>
        <blockquote className="rounded-[12px] border border-line bg-surface-muted px-4 py-3 text-[14px]">{smsConsentText(company?.name ?? "[Company name]")}</blockquote>
        <ul className="list-disc space-y-2 pl-5">
          <li>Vendors open the private job link the company sends them, enter their mobile number and check a box next to this statement:</li>
        </ul>
        <blockquote className="rounded-[12px] border border-line bg-surface-muted px-4 py-3 text-[14px]">{vendorSmsConsentText(company?.name ?? "[Company name]")}</blockquote>
        <p>The date and time each person agreed is kept on their record. Agreeing is never a condition of renting or of getting work.</p>
      </Section>

      <Section title="How often, and what it costs">
        <p>Message frequency varies with your account and your repairs. Message and data rates may apply. Carriers aren&apos;t liable for delayed or undelivered messages.</p>
      </Section>

      <Section title="Stopping texts, and help">
        <p>
          Reply <strong>STOP</strong> to any text to stop all texts. You&apos;ll get one message confirming it, then no more. Reply <strong>START</strong> to turn texts back on. Tenants can also turn texts off in the portal.
        </p>
        <p>
          Reply <strong>HELP</strong> for help{contact ? `, or contact ${name} at ${contact}` : `, or contact ${name}`}.
        </p>
      </Section>

      <Section title="Privacy">
        <p>
          Mobile numbers and text consent are never shared with or sold to third parties or affiliates for marketing or promotional purposes. Text messages are handled by our texting provider, Twilio, only to deliver them. See our{" "}
          <Link href="/privacy" className="font-semibold text-accent underline">
            privacy policy
          </Link>
          .
        </p>
      </Section>
    </main>
  );
}
