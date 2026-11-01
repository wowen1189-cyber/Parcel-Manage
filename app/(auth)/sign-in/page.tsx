import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { safeNext } from "@/lib/request";
import { getPublicCompany, getUser } from "@/lib/session";
import { SignInForm } from "../forms";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await getUser()) redirect(next);
  const company = await getPublicCompany();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-[-0.015em]">Sign in</h1>
        <p className="mt-1 text-muted">{company ? `to ${company.name}` : "to Parcel Manage"}</p>
      </div>
      {params.created && <Notice tone="success">Your company is ready. Sign in once more at its new address.</Notice>}
      {params.link === "expired" && <Notice tone="warn">That link has expired or was already used. Request a new one.</Notice>}
      <SignInForm next={next} />
      {!company && (
        <p className="text-center text-[13px] text-muted">
          New to Parcel Manage?{" "}
          <Link href="/sign-up" className="font-semibold text-accent hover:underline">
            Create your company
          </Link>
        </p>
      )}
    </div>
  );
}
