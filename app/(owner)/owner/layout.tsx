import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireOwner } from "@/lib/portal";
import { signOut } from "../../(auth)/actions";

export const metadata = { title: { template: "%s · Owner portal", default: "Owner portal" } };

export default async function OwnerLayout({ children }: LayoutProps<"/owner">) {
  const { company } = await requireOwner();
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-4 py-4">
          <Link href="/owner">
            <Logo companyName={company.name} />
          </Link>
          <form action={signOut}>
            <button className="min-h-11 rounded-[var(--radius-control)] px-3 text-[13px] font-semibold text-muted hover:bg-surface-muted">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-[960px] px-4 py-6">{children}</main>
    </div>
  );
}
