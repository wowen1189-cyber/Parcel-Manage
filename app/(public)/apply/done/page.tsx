import { Logo } from "@/components/logo";
import { money } from "@/lib/format";
import { publicCompany } from "@/lib/public-leasing";

export const metadata = { title: "Application sent" };

export default async function DonePage({ searchParams }: PageProps<"/apply/done">) {
  const sp = await searchParams;
  const company = await publicCompany();
  const unpaid = sp.fee === "unpaid";
  return (
    <main className="mx-auto max-w-[640px] px-4 py-12">
      <div className="mb-6">
        <Logo companyName={company?.name} />
      </div>
      <h1 className="text-[28px] font-extrabold">{unpaid ? "Your application is saved" : "Application sent. Thank you!"}</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-muted">
        {unpaid
          ? `The fee${sp.total ? ` of ${money(Number(sp.total))}` : ""} wasn't paid, so we can't start screening yet. Contact ${company?.name ?? "the office"}${company?.office_phone ? ` at ${company.office_phone}` : ""} to finish.`
          : sp.fee === "office"
            ? `${company?.name ?? "The office"} will contact you to collect the application fee, then screening starts.`
            : "We'll review it and be in touch, usually within two business days. If others are applying with you, we've e-mailed each of them a link."}
      </p>
      <p className="mt-4 text-[15px] text-muted">The screening company may contact you to confirm your identity.</p>
    </main>
  );
}
