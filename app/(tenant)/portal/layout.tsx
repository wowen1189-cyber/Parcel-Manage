import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireTenant } from "@/lib/portal";
import { signOut } from "../../(auth)/actions";
import { PortalNav } from "./nav";

export const metadata = { title: { template: "%s · Tenant portal", default: "Tenant portal" } };

// Phone-first shell for tenants: logo, the five portal sections, sign out.
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { company, me } = await requireTenant();
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[760px] px-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <Logo companyName={company.name} />
            <div className="flex items-center">
              <Link href="/set-password?next=/portal" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[13px] font-semibold text-muted hover:bg-surface-muted">
                Password
              </Link>
              <form action={signOut}>
                <button className="min-h-11 rounded-[var(--radius-control)] px-3 text-[13px] font-semibold text-muted hover:bg-surface-muted">Sign out</button>
              </form>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-subtle">Signed in as {[me.first_name, me.last_name].filter(Boolean).join(" ") || me.business_name}</p>
          <div className="mt-2 pb-2">
            <PortalNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-4 py-6">{children}</main>
    </div>
  );
}
