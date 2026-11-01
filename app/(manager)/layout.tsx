import { AppShell } from "@/components/shell";
import { requireCompany } from "@/lib/session";
import { signOut } from "../(auth)/actions";

export default async function ManagerLayout({ children }: LayoutProps<"/">) {
  const { user, supabase, company, membership } = await requireCompany();
  const { data: profile } = await supabase.from("profile").select("full_name, email").eq("id", user.id).single();

  return (
    <AppShell
      companyName={company.name}
      userName={profile?.full_name || profile?.email || user.email || "You"}
      userTitle={membership.title}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
