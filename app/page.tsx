import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { getRequestSubdomain } from "@/lib/session";

export default async function Home() {
  // On a company's own address, go straight to its app (sign-in first if needed).
  if (await getRequestSubdomain()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <Logo />
      <h1 className="mt-10 text-[40px] font-extrabold leading-tight tracking-[-0.02em]">Property management, all in one place.</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">
        Rent, maintenance, leasing, accounting and owner payouts, with AI that drafts and people who approve.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/sign-up" className={buttonClass("primary")}>
          Create your company
        </Link>
        <Link href="/sign-in" className={buttonClass("secondary")}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
