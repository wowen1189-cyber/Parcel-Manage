import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/request";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "../forms";

export const metadata = { title: "Password" };

// Choose a password: shown right after someone's first sign-in by e-mailed link (staff invites, tenants,
// owners), after "Forgot your password?", and from "Password" next to Sign out to change it any time.
export default async function SetPasswordPage({ searchParams }: PageProps<"/set-password">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect(`/sign-in?next=${encodeURIComponent("/set-password")}`);
  const { data: hasPassword } = await supabase.rpc("has_password");
  const mode = !hasPassword ? "first" : params.mode === "reset" ? "reset" : "change";
  const email = typeof claims.claims.email === "string" ? claims.claims.email : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-[-0.015em]">{mode === "first" ? "Choose a password" : mode === "reset" ? "Choose a new password" : "Change your password"}</h1>
        <p className="mt-1 text-muted">
          {mode === "first"
            ? "Next time, sign in with your e-mail and this password. E-mailed sign-in links still work too."
            : mode === "reset"
              ? "Your old password stops working once you save the new one."
              : "Choose a new password for your login."}
        </p>
        {email && <p className="mt-2 text-[13px] text-subtle">Signed in as {email}</p>}
      </div>
      <SetPasswordForm next={next} email={email} />
      <p className="text-center text-[14px]">
        <Link href={next} className="font-semibold text-muted hover:underline">
          {mode === "change" ? "Cancel" : "Not now"}
        </Link>
      </p>
    </div>
  );
}
