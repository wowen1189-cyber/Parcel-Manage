import Link from "next/link";
import { Logo } from "@/components/logo";

// Parcel Manage's privacy policy (public, parcelmanage.com/privacy). Written Nov 2, 2026, needed for Stripe
// Financial Connections registration. Plain words; the company should have an attorney review it.

export const metadata = { title: "Privacy policy" };

const EFFECTIVE = "November 2, 2026";
const CONTACT = "info@simrei.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/">
        <Logo />
      </Link>
      <h1 className="mt-10 text-[34px] font-extrabold leading-tight tracking-[-0.02em]">Privacy policy</h1>
      <p className="mt-2 text-muted">Effective {EFFECTIVE}</p>

      <Section title="Who we are">
        <p>
          Parcel Manage is property management software. Property management companies (our customers) use it to run their rentals: leases, rent, maintenance, leasing, accounting and owner reports. Tenants, applicants, owners and vendors use it through the
          portals their property manager gives them. This policy explains what information Parcel Manage handles and how.
        </p>
        <p>
          Your property manager decides what information goes into Parcel Manage about you and is responsible for it. If you have a question about your own records, start with them. You can also contact us at{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-accent underline">
            {CONTACT}
          </a>
          .
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>Account details: name, e-mail, phone and sign-in information for people who use Parcel Manage.</li>
          <li>Property records entered by property managers: properties, units, leases, tenants, owners, vendors, work orders, documents, photos, messages and notes.</li>
          <li>Payments: rent and fee payments are processed by Stripe. Parcel Manage doesn&apos;t store full card or bank account numbers; we keep only what&apos;s needed to show a payment, such as the amount, date and last four digits.</li>
          <li>
            Bank data a property management company chooses to link: when a company connects its own bank accounts through Stripe Financial Connections, we receive those accounts&apos; balances and transactions. We never see the bank sign-in.
          </li>
          <li>Tenant screening: applicants give their date of birth and Social Security number directly to our screening partner, Checkr. Parcel Manage doesn&apos;t receive or store them; it receives the screening results the applicant agreed to.</li>
          <li>Technical information: basic logs (like IP address, browser and pages used) to keep the service secure and working.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul className="list-disc space-y-2 pl-5">
          <li>To provide the service the property manager signed up for: billing rent, recording payments, handling maintenance, leasing, accounting, statements and notices.</li>
          <li>To send the messages that go with it, such as receipts, reminders, notices and statements.</li>
          <li>To keep the service secure, prevent fraud and fix problems.</li>
          <li>To meet legal requirements, such as Florida landlord-tenant law and fair-housing and consumer laws.</li>
        </ul>
        <p>We don&apos;t sell personal information, and we don&apos;t use it for advertising.</p>
      </Section>

      <Section title="Bank account data">
        <p>
          Bank data from Stripe Financial Connections is used only to show a property management company its own accounts&apos; balances and transactions and to reconcile its books. It isn&apos;t sold, shared with other companies, used for advertising, or
          used to decide anyone&apos;s credit. It is stored in the United States. The company can disconnect a bank account at any time, and we then stop receiving new data from it. Stripe&apos;s own handling of this data is described in{" "}
          <a href="https://stripe.com/legal/end-users" className="font-semibold text-accent underline">
            Stripe&apos;s privacy notice for end users
          </a>
          .
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>Only the service providers that run parts of Parcel Manage for us, each limited to what its job needs:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase (database and file storage, in the United States) and Vercel (hosting).</li>
          <li>Stripe (payments and bank connections), Resend (e-mail) and Checkr (tenant screening).</li>
          <li>The AI provider a property management company chooses to connect with its own key, for the AI features it turns on.</li>
        </ul>
        <p>We may also share information if the law requires it, or to protect people&apos;s safety or our rights.</p>
      </Section>

      <Section title="How we protect it">
        <p>
          Information is encrypted in transit and at rest. Each property management company can see only its own records, and tenants, owners and vendors see only theirs. Access by our team is limited to what&apos;s needed to support the service.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>We keep information while the property management company uses Parcel Manage and as long as needed for accounting, tax and legal records. When a company leaves, its information is deleted or returned, except what the law requires us to keep.</p>
      </Section>

      <Section title="Your choices">
        <p>
          You can ask your property manager, or us at{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-accent underline">
            {CONTACT}
          </a>
          , to see or correct your information. You can opt out of text messages by replying STOP. Parcel Manage isn&apos;t meant for children under 13.
        </p>
      </Section>

      <Section title="Changes">
        <p>If we change this policy, we&apos;ll update the date above. Big changes will be shown in the app.</p>
      </Section>
    </main>
  );
}
