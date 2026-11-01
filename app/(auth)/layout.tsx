import { Logo } from "@/components/logo";
import { getPublicCompany } from "@/lib/session";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const company = await getPublicCompany();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Logo companyName={company?.name} />
        </div>
        <div className="rounded-[var(--radius-dialog)] border border-line bg-surface p-6 sm:p-8">{children}</div>
        {company?.office_phone && (
          <p className="mt-4 text-center text-[13px] text-subtle">
            Questions? Call {company.name} at {company.office_phone}.
          </p>
        )}
      </div>
    </main>
  );
}
