import { getPublicCompany, getUser } from "@/lib/session";
import { signOut } from "../actions";
import { Button } from "@/components/ui";

export const metadata = { title: "No access" };

// Signed in, but not a member of the company whose address this is.
export default async function NoAccessPage() {
  const [user, company] = await Promise.all([getUser(), getPublicCompany()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-[-0.015em]">You don&apos;t have access here</h1>
      <p className="text-muted">
        {user?.email ?? "This account"} isn&apos;t on the team at {company?.name ?? "this company"}. Ask one of its admins to
        invite you, or sign in with a different email.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
