import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/request";
import { getUser } from "@/lib/session";
import { SignUpForm } from "../forms";

export const metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null, "/welcome");
  if (await getUser()) redirect(next);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-[-0.015em]">Create your account</h1>
        <p className="mt-1 text-muted">Next, you&apos;ll set up your company.</p>
      </div>
      <SignUpForm next={next} />
      <p className="text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-semibold text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
