import { Button } from "@/components/ui";
import { safeNext } from "@/lib/request";
import { getPublicCompany } from "@/lib/session";
import { confirmEmailLink } from "../actions";

export const metadata = { title: "Continue" };

// Landing page for emailed links. The token is only used when the person taps the button,
// so an email scanner opening the link doesn't use it up.
export default async function ContinuePage({ searchParams }: PageProps<"/continue">) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = typeof params.type === "string" ? params.type : "";
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const company = await getPublicCompany();
  const label = type === "recovery" ? "Continue to reset your password" : type === "signup" || type === "email_change" ? "Confirm my email" : "Sign in";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-[-0.015em]">One more tap</h1>
        <p className="mt-1 text-muted">{company ? `to finish signing in to ${company.name}` : "to finish signing in to Parcel Manage"}</p>
      </div>
      <form action={confirmEmailLink} className="space-y-3">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <Button type="submit" className="w-full">
          {label}
        </Button>
      </form>
    </div>
  );
}
