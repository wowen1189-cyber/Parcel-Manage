import { redirect } from "next/navigation";
import { ROOT_DOMAIN } from "@/lib/env";
import { getRequestSubdomain, getUser, resolveCompanyAccess } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { companyUrl } from "@/lib/tenant";
import { CompanyForm } from "../forms";

export const metadata = { title: "Set up your company" };

// First sign-in: a user who belongs to no company creates one and becomes its admin.
export default async function WelcomePage() {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/welcome");
  // New companies are set up on the main site, never on another company's address.
  // The dashboard sends members in and everyone else to "You don't have access here".
  if (await getRequestSubdomain()) redirect("/dashboard");
  const access = await resolveCompanyAccess(await createClient(), user.id, null);
  if (access.status === "ok") {
    redirect(access.company.subdomain ? companyUrl(access.company.subdomain, ROOT_DOMAIN, "/dashboard") : "/dashboard");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-[-0.015em]">Set up your company</h1>
        <p className="mt-1 text-muted">You&apos;ll be its admin. You can invite your team next.</p>
      </div>
      <CompanyForm rootDomain={ROOT_DOMAIN} />
    </div>
  );
}
