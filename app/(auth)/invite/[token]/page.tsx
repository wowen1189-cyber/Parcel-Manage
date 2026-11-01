import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { getPublicCompany, getUser } from "@/lib/session";
import { AcceptInviteForm } from "../../forms";

export const metadata = { title: "Join your team" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const [user, company] = await Promise.all([getUser(), getPublicCompany()]);
  const next = `/invite/${encodeURIComponent(token)}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-[-0.015em]">Join {company?.name ?? "your team"}</h1>
        <p className="mt-1 text-muted">
          {user ? `You're signed in as ${user.email}. The invite must have been sent to this email.` : "Sign in or create an account with the email the invite was sent to."}
        </p>
      </div>
      {user ? (
        <AcceptInviteForm token={token} />
      ) : (
        <div className="grid gap-3">
          <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className={buttonClass("primary")}>
            Create an account
          </Link>
          <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className={buttonClass("secondary")}>
            I already have an account
          </Link>
        </div>
      )}
    </div>
  );
}
